import { Router, Request, Response } from 'express'
import { calculateRoutes, geocodeAddress } from '../services/routeService'

const router = Router()

// POST /api/routes/calculate
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { origin, destination, modes } = req.body as {
      origin: { lat: number; lng: number }
      destination: { lat: number; lng: number }
      modes?: string[]
    }

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({ error: 'Invalid origin or destination' })
    }

    const allowedModes = ['fastest', 'least_traffic', 'least_cameras', 'lowest_risk']
    const requestedModes = (modes ?? allowedModes).filter(m => allowedModes.includes(m))

    const routes = await calculateRoutes(origin, destination, requestedModes)

    return res.json({ routes, total: routes.length })
  } catch (err) {
    console.error('[Routes] Calculate error:', err)
    return res.status(500).json({ error: 'Route calculation failed' })
  }
})

// GET /api/routes/geocode?q=&lat=&lng=
router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { q, lat, lng } = req.query as Record<string, string>

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query too short' })
    }

    const near = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined
    const results = await geocodeAddress(q, near)

    return res.json({ results })
  } catch (err) {
    console.error('[Routes] Geocode error:', err)
    return res.status(500).json({ error: 'Geocoding failed' })
  }
})

export default router
