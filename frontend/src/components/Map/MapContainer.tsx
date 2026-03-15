import React, { useEffect, useRef, useMemo } from 'react'
import { MapContainer as LeafletMap, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { LatLngExpression } from 'leaflet'
import { useEventsStore } from '../../store/eventsStore'
import { useUIStore } from '../../store/uiStore'
import { useRouteStore } from '../../store/routeStore'
import { useT } from '../../i18n/useT'
import { wsService } from '../../services/websocket'
import { EventMarkers } from './EventMarkers'
import { EVMarkers } from './EVMarkers'
import { RoutePolylines } from './RoutePolylines'
import { UserMarker } from './UserMarker'
import { RiskZones } from './RiskZones'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

const TILE_LAYERS = {
  light:     'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}

const TILE_ATTRIBUTIONS = {
  light:     '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  dark:      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: '&copy; Esri',
}

const btnStyle: React.CSSProperties = {
  width: 48, height: 48,
  background: 'rgba(15,15,15,0.92)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 22, cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
  transition: 'transform 0.1s',
  color: '#fff',
}

// Zoom controls — bottom-right
function ZoomControls() {
  const map = useMap()
  return (
    <div
      className="leaflet-bottom leaflet-right"
      style={{ pointerEvents: 'auto', zIndex: 1000, marginBottom: '90px', marginRight: '8px' }}
    >
      <div className="leaflet-control" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button title="Zoom in" style={btnStyle}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onClick={() => map.zoomIn()}>+</button>
        <button title="Zoom out" style={btnStyle}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onClick={() => map.zoomOut()}>−</button>
      </div>
    </div>
  )
}

// Recenter + Day/Night — bottom-left column
function BottomLeftControls() {
  const map             = useMap()
  const userPosition    = useEventsStore(s => s.userPosition)
  const { mapStyle, toggleDayNight, setMapStyle } = useUIStore()
  const t               = useT()

  return (
    <div
      className="leaflet-bottom leaflet-left"
      style={{ pointerEvents: 'auto', zIndex: 1000, marginBottom: '90px', marginLeft: '8px' }}
    >
      <div className="leaflet-control" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Satellite toggle */}
        <button
          title="Toggle satellite"
          style={{
            ...btnStyle,
            background: mapStyle === 'satellite' ? 'rgba(59,130,246,0.35)' : btnStyle.background,
            border: mapStyle === 'satellite' ? '1px solid rgba(59,130,246,0.6)' : btnStyle.border,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onClick={() => setMapStyle(mapStyle === 'satellite' ? 'light' : 'satellite')}
        >
          🛰️
        </button>

        {/* Day / Night toggle */}
        <button
          title={t(mapStyle === 'dark' ? 'toDayMode' : 'toNightMode')}
          style={btnStyle}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onClick={toggleDayNight}
        >
          {mapStyle === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Recenter */}
        {userPosition && (
          <button
            title="Recenter"
            style={btnStyle}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onClick={() => map.setView([userPosition.lat, userPosition.lng], Math.max(map.getZoom(), 15), { animate: true, duration: 0.8 })}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 100 100">
              {/* Outer ring */}
              <circle cx="50" cy="50" r="46" fill="none" stroke="#fff" strokeWidth="4" opacity="0.9"/>
              {/* Inner ring */}
              <circle cx="50" cy="50" r="32" fill="none" stroke="#fff" strokeWidth="2" opacity="0.7"/>
              {/* North point */}
              <polygon points="50,4 54,38 50,44 46,38" fill="#fff" opacity="0.95"/>
              {/* South point */}
              <polygon points="50,96 54,62 50,56 46,62" fill="#fff" opacity="0.95"/>
              {/* East point */}
              <polygon points="96,50 62,54 56,50 62,46" fill="#fff" opacity="0.95"/>
              {/* West point */}
              <polygon points="4,50 38,54 44,50 38,46" fill="#fff" opacity="0.95"/>
              {/* Center dot */}
              <circle cx="50" cy="50" r="5" fill="#fff" opacity="0.95"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// Follow user position
function UserFollower() {
  const map = useMap()
  const userPosition = useEventsStore(s => s.userPosition)
  const isNavigating = useRouteStore(s => s.isNavigating)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!userPosition) return
    if (!hasInitialized.current || isNavigating) {
      map.setView([userPosition.lat, userPosition.lng], isNavigating ? 16 : map.getZoom(), {
        animate: true,
        duration: 0.5
      })
      hasInitialized.current = true
    }
  }, [map, userPosition, isNavigating])

  return null
}

// Emit bbox + update map center for data polling + track zoom
function BBoxEmitter() {
  const setZoom = useUIStore(s => s.setZoom)
  const setMapCenter = useEventsStore(s => s.setMapCenter)
  useMapEvents({
    moveend(e) {
      const bounds = e.target.getBounds()
      const center = e.target.getCenter()
      setMapCenter({ lat: center.lat, lng: center.lng })
      wsService.updateBBox({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      })
    },
    zoomend(e) {
      setZoom(e.target.getZoom())
    }
  })
  return null
}

interface Props {
  className?: string
}

export const MapView: React.FC<Props> = ({ className = '' }) => {
  const mapStyle = useUIStore(s => s.mapStyle)
  const layers = useUIStore(s => s.layers)

  const defaultCenter: LatLngExpression = [51.505, -0.09]

  const enabledLayerIds = useMemo(
    () => new Set(layers.filter(l => l.enabled).map(l => l.id)),
    [layers]
  )

  return (
    <LeafletMap
      center={defaultCenter}
      zoom={14}
      zoomControl={false}
      className={`w-full h-full ${className}`}
      style={{ background: '#0a0a0a' }}
    >
      {/* Base tile layer */}
      <TileLayer
        url={TILE_LAYERS[mapStyle]}
        attribution={TILE_ATTRIBUTIONS[mapStyle]}
        maxZoom={19}
        keepBuffer={4}
      />

      {/* Auto-follow user */}
      <UserFollower />
      <BBoxEmitter />
      <ZoomControls />
      <BottomLeftControls />

      {/* User position */}
      <UserMarker />

      {/* Event markers with clustering */}
      {enabledLayerIds.has('police') && <EventMarkers type="police" />}
      {enabledLayerIds.has('speed_camera') && <EventMarkers type="speed_camera" />}
      {enabledLayerIds.has('accident') && <EventMarkers type="accident" />}
      {enabledLayerIds.has('traffic') && <EventMarkers type="traffic" />}
      {enabledLayerIds.has('hazard') && <EventMarkers type="hazard" />}
      {enabledLayerIds.has('construction') && <EventMarkers type="construction" />}
      {enabledLayerIds.has('road_closure') && <EventMarkers type="road_closure" />}

      {/* EV Stations */}
      {enabledLayerIds.has('ev_station') && <EVMarkers />}

      {/* Risk Zones */}
      {enabledLayerIds.has('risk_zones') && <RiskZones />}

      {/* Route polylines */}
      <RoutePolylines />
    </LeafletMap>
  )
}
