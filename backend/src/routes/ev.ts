import { Router, Request, Response } from 'express'
import { fetchEVStations } from '../services/evService'
import { db } from '../db'

const router = Router()

// GET /api/ev/stations?north=&south=&east=&west=
router.get('/stations', async (req: Request, res: Response) => {
  try {
    const { north, south, east, west } = req.query as Record<string, string>

    if (!north || !south || !east || !west) {
      return res.status(400).json({ error: 'Missing bbox parameters' })
    }

    const bbox = {
      north: parseFloat(north), south: parseFloat(south),
      east:  parseFloat(east),  west:  parseFloat(west),
    }

    const stations = await fetchEVStations(bbox)
    return res.json({ stations, total: stations.length })
  } catch (err) {
    console.error('[EV] Stations error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/ev/stations/:id
router.get('/stations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { rows } = await db.query(`
      SELECT
        s.id, s.name, s.operator,
        ST_Y(s.position::geometry) AS lat,
        ST_X(s.position::geometry) AS lng,
        s.total_ports, s.available_ports, s.is_tesla,
        s.price_per_kwh, s.price_per_30min, s.rating, s.amenities,
        json_agg(json_build_object(
          'type', c.plug_type, 'powerKw', c.power_kw,
          'available', c.available, 'total', c.total
        )) AS connectors
      FROM ev_stations s
      LEFT JOIN ev_connectors c ON c.station_id = s.id
      WHERE s.id = $1 OR s.external_id = $1
      GROUP BY s.id
    `, [id])

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Station not found' })
    }

    const row = rows[0]
    return res.json({
      station: {
        id: row.id, name: row.name, operator: row.operator,
        position: { lat: row.lat, lng: row.lng },
        connectors: row.connectors,
        totalPorts: row.total_ports, availablePorts: row.available_ports,
        isTesla: row.is_tesla, pricePerKwh: row.price_per_kwh,
        pricePer30min: row.price_per_30min, rating: row.rating,
        amenities: row.amenities ?? [],
      }
    })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
