import { useEffect, useRef } from 'react'
import { useEventsStore } from '../store/eventsStore'
import { useUIStore } from '../store/uiStore'
import { fetchEvents, fetchWazeAlerts, fetchReports, fetchEVStations, fetchRiskZones } from '../services/api'
import { wsService } from '../services/websocket'
import { BoundingBox, LatLng } from '../types'

const LIVE_INTERVAL    = 10_000   // 10s  — Waze + cameras (location-dependent, fast-changing)
const REPORTS_INTERVAL = 60_000   // 60s  — user reports (location-independent, slow-changing)
const EV_INTERVAL      = 300_000  // 5min — EV stations (static data)

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
  const { mapCenter, setEvents, setReports, setEVStations, setRiskZones, setLoading, setError } = useEventsStore()
  const { layers } = useUIStore()
  const liveTimer    = useRef<ReturnType<typeof setInterval> | null>(null)
  const reportsTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const evTimer      = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCenter   = useRef<LatLng | null>(null)

  // ── Live data: Waze + cameras — re-runs on map move ────────────────────────
  useEffect(() => {
    const center = mapCenter
    const bbox   = getBBox(center.lat, center.lng)

    const moved = !lastCenter.current ||
      Math.abs(center.lat - lastCenter.current.lat) > 0.01 ||
      Math.abs(center.lng - lastCenter.current.lng) > 0.01

    if (moved) {
      lastCenter.current = center
      wsService.updateBBox(bbox)
    }

    const fetchLiveData = async () => {
      try {
        setLoading(true)
        const [alerts, cameras] = await Promise.allSettled([
          fetchWazeAlerts(getBBox(center.lat, center.lng)),
          fetchEvents(getBBox(center.lat, center.lng)),
        ])
        setEvents([
          ...(alerts.status  === 'fulfilled' ? alerts.value  : []),
          ...(cameras.status === 'fulfilled' ? cameras.value : []),
        ])
        setError(null)
      } catch (err) {
        setError('Failed to fetch events')
        console.error('[DataPolling] Live error:', err)
      } finally {
        setLoading(false)
      }
    }

    const fetchEVData = async () => {
      const evLayer = layers.find(l => l.id === 'ev_station')
      if (!evLayer?.enabled) return
      try {
        const stations = await fetchEVStations(getBBox(center.lat, center.lng, 20))
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

    fetchLiveData()
    fetchEVData()
    fetchRiskData()

    if (liveTimer.current) clearInterval(liveTimer.current)
    if (evTimer.current)   clearInterval(evTimer.current)

    liveTimer.current = setInterval(fetchLiveData, LIVE_INTERVAL)
    evTimer.current   = setInterval(fetchEVData,   EV_INTERVAL)

    return () => {
      if (liveTimer.current) clearInterval(liveTimer.current)
      if (evTimer.current)   clearInterval(evTimer.current)
    }
  }, [mapCenter.lat, mapCenter.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reports: independent slow poll — not tied to map position ──────────────
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const reports = await fetchReports(getBBox(0, 0, 999)) // bbox ignored server-side
        setReports(reports)
      } catch (err) {
        console.error('[DataPolling] Reports error:', err)
      }
    }

    fetchReportData()
    reportsTimer.current = setInterval(fetchReportData, REPORTS_INTERVAL)

    return () => {
      if (reportsTimer.current) clearInterval(reportsTimer.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
