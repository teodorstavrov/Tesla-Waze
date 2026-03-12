import { useEffect, useRef } from 'react'
import { useEventsStore } from '../store/eventsStore'
import { useUIStore } from '../store/uiStore'
import { fetchEvents, fetchEVStations, fetchRiskZones } from '../services/api'
import { wsService } from '../services/websocket'
import { BoundingBox } from '../types'

const WAZE_INTERVAL = 10_000   // 10s
const TRAFFIC_INTERVAL = 30_000 // 30s
const EV_INTERVAL = 300_000    // 5min

function getBBox(lat: number, lng: number, radiusKm = 15): BoundingBox {
  const delta = radiusKm / 111
  return {
    north: lat + delta,
    south: lat - delta,
    east: lng + delta / Math.cos((lat * Math.PI) / 180),
    west: lng - delta / Math.cos((lat * Math.PI) / 180)
  }
}

export function useDataPolling() {
  const { userPosition, setEvents, setEVStations, setRiskZones, setLoading, setError } = useEventsStore()
  const { layers } = useUIStore()
  const wazeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const trafficTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const evTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastBBox = useRef<BoundingBox | null>(null)

  useEffect(() => {
    if (!userPosition) return

    const bbox = getBBox(userPosition.lat, userPosition.lng)
    lastBBox.current = bbox

    // Subscribe WebSocket to bbox
    wsService.updateBBox(bbox)

    const fetchWazeData = async () => {
      try {
        setLoading(true)
        const events = await fetchEvents(bbox)
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
        const stations = await fetchEVStations(bbox)
        setEVStations(stations)
      } catch (err) {
        console.error('[DataPolling] EV error:', err)
      }
    }

    const fetchRiskData = async () => {
      const riskLayer = layers.find(l => l.id === 'risk_zones')
      if (!riskLayer?.enabled) return
      try {
        const zones = await fetchRiskZones(bbox)
        setRiskZones(zones)
      } catch (err) {
        console.error('[DataPolling] Risk error:', err)
      }
    }

    // Initial fetch
    fetchWazeData()
    fetchEVData()
    fetchRiskData()

    // Polling intervals
    wazeTimer.current = setInterval(fetchWazeData, WAZE_INTERVAL)
    trafficTimer.current = setInterval(fetchWazeData, TRAFFIC_INTERVAL)
    evTimer.current = setInterval(fetchEVData, EV_INTERVAL)

    return () => {
      if (wazeTimer.current) clearInterval(wazeTimer.current)
      if (trafficTimer.current) clearInterval(trafficTimer.current)
      if (evTimer.current) clearInterval(evTimer.current)
    }
  }, [userPosition?.lat, userPosition?.lng]) // eslint-disable-line react-hooks/exhaustive-deps
}
