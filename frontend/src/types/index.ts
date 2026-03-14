// ─── Coordinates ────────────────────────────────────────────────────────────
export interface LatLng {
  lat: number
  lng: number
}

export interface BoundingBox {
  north: number
  south: number
  east: number
  west: number
}

// ─── Events ─────────────────────────────────────────────────────────────────
export type EventType =
  | 'police'
  | 'speed_camera'
  | 'accident'
  | 'traffic'
  | 'hazard'
  | 'construction'
  | 'ev_station'
  | 'road_closure'

export type EventSource = 'waze' | 'user_report' | 'government' | 'osm' | 'traffic_api'

export interface TrafficEvent {
  id: string
  type: EventType
  position: LatLng
  title: string
  description?: string
  severity: 1 | 2 | 3 | 4 | 5 // 1=low, 5=critical
  confidence: number // 0–100
  votes: number
  source: EventSource
  reportedAt: string // ISO
  expiresAt?: string
  speed?: number // km/h if speed camera
  direction?: number // degrees 0–360
  distance?: number // meters from user (computed)
}

// ─── EV Charging ────────────────────────────────────────────────────────────
export type PlugType = 'CCS' | 'CHAdeMO' | 'Type2' | 'Tesla' | 'J1772' | 'CCS2'

export interface Connector {
  type: PlugType
  powerKw: number
  available: boolean
  total: number
}

export interface EVStation {
  id: string
  name: string
  operator: string
  position: LatLng
  connectors: Connector[]
  pricePerKwh?: number
  pricePer30min?: number
  rating?: number
  totalPorts: number
  availablePorts: number
  isTesla: boolean
  amenities: string[]
  distance?: number
  etaMinutes?: number
}

// ─── Routes ──────────────────────────────────────────────────────────────────
export type RouteMode = 'fastest' | 'least_traffic' | 'least_cameras' | 'lowest_risk'

export interface RouteWaypoint {
  position: LatLng
  label?: string
}

export interface RouteAlertSummary {
  policeCount: number
  cameraCount: number
  accidentCount: number
  hazardCount: number
  constructionCount: number
  nextPoliceDistance?: number   // meters
  nextCameraDistance?: number
  trafficLevel: 'none' | 'light' | 'moderate' | 'heavy' | 'standstill'
  riskScore: number             // 0–100
}

export interface Route {
  id: string
  mode: RouteMode
  waypoints: LatLng[]
  distanceMeters: number
  durationSeconds: number
  durationInTrafficSeconds?: number
  polyline: LatLng[]
  summary: RouteAlertSummary
  evStationsAlongRoute?: EVStation[]
  color: string
}

// ─── User Reports ────────────────────────────────────────────────────────────
export interface UserReport {
  id: string
  type: 'police' | 'accident' | 'speed_camera' | 'hazard'
  position: LatLng
  userId?: string
  createdAt: string
  expiresAt?: string
  upvotes: number
  downvotes: number
  confirmed: boolean
}

// ─── Risk ────────────────────────────────────────────────────────────────────
export interface RiskZone {
  id: string
  center: LatLng
  radiusMeters: number
  score: number      // 0–100
  probability: number
  historicalCount: number
  peakHours: number[]
  dayOfWeek: number[]
}

// ─── App State (UI) ──────────────────────────────────────────────────────────
export type PanelId = 'route' | 'ev' | 'report' | 'layers' | 'settings' | 'alerts'

export interface MapLayer {
  id: EventType | 'risk_zones'
  label: string
  icon: string
  enabled: boolean
  color: string
}

export interface VoiceAlert {
  id: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  triggeredAt: number
  spoken: boolean
}

// ─── API Responses ───────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T
  cached: boolean
  timestamp: string
}

export interface EventsResponse {
  events: TrafficEvent[]
  total: number
  bbox: BoundingBox
}

export interface RoutesResponse {
  routes: Route[]
  originLabel?: string
  destinationLabel?: string
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────
export type WsMessageType =
  | 'events:update'
  | 'event:new'
  | 'event:removed'
  | 'report:confirmed'
  | 'ev:availability'
  | 'risk:update'

export interface WsMessage<T = unknown> {
  type: WsMessageType
  payload: T
  timestamp: string
}
