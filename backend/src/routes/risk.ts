import { Router, Request, Response } from 'express'
import { computeRiskZones } from '../services/riskPrediction'

const router = Router()

// GET /api/risk/zones?north=&south=&east=&west=
router.get('/zones', async (req: Request, res: Response) => {
  try {
    const { north, south, east, west } = req.query as Record<string, string>

    if (!north || !south || !east || !west) {
      return res.status(400).json({ error: 'Missing bbox parameters' })
    }

    const bbox = {
      north: parseFloat(north), south: parseFloat(south),
      east:  parseFloat(east),  west:  parseFloat(west),
    }

    const zones = await computeRiskZones(bbox)
    return res.json({ zones, total: zones.length })
  } catch (err) {
    console.error('[Risk] Zones error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
