import React, { useEffect, useRef, useMemo } from 'react'
import { MapContainer as LeafletMap, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { LatLngExpression } from 'leaflet'
import { useEventsStore } from '../../store/eventsStore'
import { useUIStore } from '../../store/uiStore'
import { useRouteStore } from '../../store/routeStore'
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
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  traffic: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

const TILE_ATTRIBUTIONS = {
  dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: '&copy; Esri',
  traffic: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
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

// Emit bbox to websocket on move
function BBoxEmitter() {
  useMapEvents({
    moveend(e) {
      const bounds = e.target.getBounds()
      wsService.updateBBox({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      })
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
  const setZoom = useUIStore(s => s.setZoom)

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
      whenReady={(map) => {
        map.target.on('zoomend', () => setZoom(map.target.getZoom()))
      }}
    >
      {/* Base tile layer */}
      <TileLayer
        url={TILE_LAYERS[mapStyle]}
        attribution={TILE_ATTRIBUTIONS[mapStyle]}
        maxZoom={19}
        keepBuffer={4}
      />

      {/* Zoom control top-right (Tesla-friendly) */}
      <ZoomControl position="topright" />

      {/* Auto-follow user */}
      <UserFollower />
      <BBoxEmitter />

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
