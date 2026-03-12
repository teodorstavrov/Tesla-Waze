import { useEffect, useRef } from 'react'
import { useEventsStore } from '../store/eventsStore'
import { useUIStore } from '../store/uiStore'
import { fetchEvents, fetchEVStations, fetchRiskZones } from '../services/api'
import { wsService } from '../services/websocket'
import { BoundingBox, LatLng } from '../types'

const WAZE_INTERVAL  = 10_000   // 10s
const EV_INTERVAL    = 300_000  // 5min

function getBBox(lat: number, lng: number, radiusKm = 15): BoundingBox {
  const delta = radiusKm / 111
  return {
    north: lat + delta,
    south: lat - delta,
    east:  lng + delta / Math.cos((lat * Math.PI) / 180),
    west:  lng - delta / Math.cos((lat * Math.PI) / 180),
  }
}

export function useDataPolling() {
  const { mapCenter, setEvents, setEVStations, setRiskZones, setLoading, setError } = useEventsStore()
  const { layers } = useUIStore()
  const wazeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const evTimer   = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCenter = useRef<LatLng | null>(null)

  useEffect(() => {
    // Always poll — uses GPS position when available, map center as fallback
    const center = mapCenter
    const bbox = getBBox(center.lat, center.lng)

    // Re-subscribe WebSocket only when center moves ~1km+
    const moved = !lastCenter.current ||
      Math.abs(center.lat - lastCenter.current.lat) > 0.01 ||
      Math.abs(center.lng - lastCenter.current.lng) > 0.01

    if (moved) {
      lastCenter.current = center
      wsService.updateBBox(bbox)
    }

    const fetchWazeData = async () => {
      try {
        setLoading(true)
        const events = await fetchEvents(getBBox(center.lat, center.lng))
        setEvents(events)
        setError(null)
      } catch (err) {
        setError('Failed to fetch events')
        console.error('[DataPolling] Events error:', err)
      } finally {
        setLoading(false)
      }
    }

    const fetchEVData = async () => {
      const evLayer = layers.find(l => l.id === 'ev_station')
      if (!evLayer?.enabled) return
      try {
        const stations = await fetchEVStations(getBBox(center.lat, center.lng, 10))
        setEVStations(stations)
      } catch (err) {
        console.error('[DataPolling] EV error:', err)
      }
    }

    const fetchRiskData = async () => {
      const riskLayer = layers.find(l => l.id === 'risk_zones')
      if (!riskLayer?.enabled) return
      try {
        const zones = await fetchRiskZones(getBBox(center.lat, center.lng))
        setRiskZones(zones)
      } catch (err) {
        console.error('[DataPolling] Risk error:', err)
      }
    }

    // Initial fetch
    fetchWazeData()
    fetchEVData()
    fetchRiskData()

    if (wazeTimer.current) clearInterval(wazeTimer.current)
    if (evTimer.current)   clearInterval(evTimer.current)

    wazeTimer.current = setInterval(fetchWazeData, WAZE_INTERVAL)
    evTimer.current   = setInterval(fetchEVData, EV_INTERVAL)

    return () => {
      if (wazeTimer.current) clearInterval(wazeTimer.current)
      if (evTimer.current)   clearInterval(evTimer.current)
    }
  }, [mapCenter.lat, mapCenter.lng]) // eslint-disable-line react-hooks/exhaustive-deps
}
