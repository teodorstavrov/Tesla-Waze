import { create } from 'zustand'
import { TrafficEvent, EVStation, RiskZone, EventType, LatLng } from '../types'

interface EventsState {
  events: TrafficEvent[]
  evStations: EVStation[]
  riskZones: RiskZone[]
  userPosition: LatLng | null
  mapCenter: LatLng           // map center — used as fallback when no GPS
  userHeading: number
  userSpeed: number // km/h
  lastUpdated: number
  isLoading: boolean
  error: string | null

  // Derived
  nearbyEvents: TrafficEvent[]   // within 2km
  nextPolice: TrafficEvent | null
  nextCamera: TrafficEvent | null

  setEvents: (events: TrafficEvent[]) => void
  setReports: (reports: TrafficEvent[]) => void
  addEvent: (event: TrafficEvent) => void
  removeEvent: (id: string) => void
  setEVStations: (stations: EVStation[]) => void
  setRiskZones: (zones: RiskZone[]) => void
  setUserPosition: (pos: LatLng, heading?: number, speed?: number) => void
  setMapCenter: (pos: LatLng) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  computeNearby: () => void

  selectedEVStation: (EVStation & { _dist: number; _brand: string; _routeDist?: number; _routeDur?: number }) | null
  setSelectedEVStation: (s: EventsState['selectedEVStation']) => void
  recenterRequested: boolean
  requestRecenter: () => void
  clearRecenterRequest: () => void
}

function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sin1 = Math.sin(dLat / 2)
  const sin2 = Math.sin(dLng / 2)
  const aa = sin1 * sin1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sin2 * sin2
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  evStations: [],
  riskZones: [],
  userPosition: null,
  mapCenter: { lat: 42.698, lng: 23.322 }, // default Sofia — replaced on first GPS/map move
  userHeading: 0,
  userSpeed: 0,
  lastUpdated: 0,
  isLoading: false,
  error: null,
  nearbyEvents: [],
  nextPolice: null,
  nextCamera: null,
  selectedEVStation: null,
  recenterRequested: false,

  setEvents: (events) => {
    // Keep existing user_report events — they are managed by setReports, not this poll
    const existing = get().events
    const reports  = existing.filter(e => e.source === 'user_report')
    const newIds   = new Set(events.map(e => e.id))
    const keepReports = reports.filter(e => !newIds.has(e.id))
    set({ events: [...events, ...keepReports], lastUpdated: Date.now() })
    get().computeNearby()
  },

  setReports: (reports) => {
    // Replace only user_report events, leave live events untouched
    set(s => ({
      events: [...s.events.filter(e => e.source !== 'user_report'), ...reports]
    }))
    get().computeNearby()
  },

  addEvent: (event) => {
    set(s => ({ events: [...s.events.filter(e => e.id !== event.id), event] }))
    get().computeNearby()
  },

  removeEvent: (id) => {
    set(s => ({ events: s.events.filter(e => e.id !== id) }))
    get().computeNearby()
  },

  setEVStations: (evStations) => set({ evStations }),

  setRiskZones: (riskZones) => set({ riskZones }),

  setUserPosition: (pos, heading = 0, speed = 0) => {
    set({ userPosition: pos, mapCenter: pos, userHeading: heading, userSpeed: speed })
    get().computeNearby()
  },

  setMapCenter: (mapCenter) => set({ mapCenter }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSelectedEVStation: (selectedEVStation) => set({ selectedEVStation }),
  requestRecenter: () => set({ recenterRequested: true }),
  clearRecenterRequest: () => set({ recenterRequested: false }),

  computeNearby: () => {
    const { events, userPosition } = get()
    if (!userPosition) return

    const withDistance = events.map(e => ({
      ...e,
      distance: distanceMeters(userPosition, e.position)
    }))

    const nearby = withDistance
      .filter(e => (e.distance ?? Infinity) < 5000)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))

    const nextPolice = nearby.find(e => e.type === 'police') ?? null
    const nextCamera = nearby.find(e => e.type === 'speed_camera') ?? null

    set({ nearbyEvents: nearby, nextPolice, nextCamera })
  }
}))
