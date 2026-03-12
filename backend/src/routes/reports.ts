import { Router, Request, Response } from 'express'
import { db } from '../db'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// POST /api/reports
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, position } = req.body as {
      type: string
      position: { lat: number; lng: number }
    }

    const allowedTypes = ['police', 'accident', 'speed_camera', 'hazard']
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' })
    }

    if (!position?.lat || !position?.lng) {
      return res.status(400).json({ error: 'Invalid position' })
    }

    // Rate limiting by session (simple IP-based)
    const sessionId = req.ip ?? 'unknown'

    // Check for recent duplicate (~500m radius using degree approximation)
    const latDelta = 500 / 111000
    const { rows: existing } = await db.query(`
      SELECT id FROM user_reports
      WHERE
        type = $1
        AND session_id = $2
        AND lat BETWEEN $3 AND $4
        AND lng BETWEEN $5 AND $6
        AND created_at > NOW() - INTERVAL '10 minutes'
      LIMIT 1
    `, [type, sessionId,
        position.lat - latDelta, position.lat + latDelta,
        position.lng - latDelta, position.lng + latDelta])

    if (existing.length > 0) {
      return res.status(429).json({ error: 'Duplicate report too soon' })
    }

    const id = uuidv4()
    const { rows } = await db.query(`
      INSERT INTO user_reports (id, type, lat, lng, session_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, type, upvotes, downvotes, confirmed, created_at, expires_at
    `, [id, type, position.lat, position.lng, sessionId])

    return res.status(201).json({ report: rows[0] })
  } catch (err) {
    console.error('[Reports] POST error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/reports/:id/vote
router.post('/:id/vote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { vote } = req.body as { vote: 'up' | 'down' }
    const sessionId = req.ip ?? 'unknown'

    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote' })
    }

    // Upsert vote
    await db.query(`
      INSERT INTO report_votes (report_id, session_id, vote)
      VALUES ($1, $2, $3)
      ON CONFLICT (report_id, session_id) DO UPDATE SET vote = $3
    `, [id, sessionId, vote])

    // Recount votes
    const { rows } = await db.query(`
      UPDATE user_reports r
      SET
        upvotes = (SELECT COUNT(*) FROM report_votes WHERE report_id = $1 AND vote = 'up'),
        downvotes = (SELECT COUNT(*) FROM report_votes WHERE report_id = $1 AND vote = 'down'),
        confirmed = (
          SELECT COUNT(*) FROM report_votes WHERE report_id = $1 AND vote = 'up'
        ) >= 3
      WHERE id = $1
      RETURNING upvotes, downvotes, confirmed
    `, [id])

    return res.json({ success: true, ...rows[0] })
  } catch (err) {
    console.error('[Reports] Vote error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/reports?north=&south=&east=&west=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { north, south, east, west } = req.query as Record<string, string>

    const { rows } = await db.query(`
      SELECT id, type, lat, lng, upvotes, downvotes, confirmed, created_at, expires_at
      FROM user_reports
      WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 100
    `, [parseFloat(south), parseFloat(north), parseFloat(west), parseFloat(east)])

    return res.json({ reports: rows })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
