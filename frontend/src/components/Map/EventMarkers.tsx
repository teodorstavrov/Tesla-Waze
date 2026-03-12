import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useEventsStore } from '../../store/eventsStore'
import { EventType, TrafficEvent } from '../../types'
import { EventIcons } from './icons'

interface Props {
  type: EventType
}

function formatPopup(event: TrafficEvent): string {
  const time = new Date(event.reportedAt).toLocaleTimeString()
  const dist = event.distance ? `${Math.round(event.distance)}m away` : ''
  return `
    <div style="min-width:160px;color:#e5e5e5;background:#111;padding:8px;border-radius:8px">
      <div style="font-size:16px;font-weight:600;margin-bottom:4px">${EventIcons[event.type] ? '' : ''}${event.title}</div>
      ${event.description ? `<div style="font-size:13px;color:#9ca3af">${event.description}</div>` : ''}
      ${event.speed ? `<div style="font-size:13px;color:#f59e0b">Limit: ${event.speed} km/h</div>` : ''}
      <div style="font-size:12px;color:#6b7280;margin-top:4px">${dist} · ${time}</div>
      <div style="font-size:12px;color:#6b7280">Confidence: ${event.confidence}% · ${event.votes} votes</div>
    </div>
  `
}

export const EventMarkers: React.FC<Props> = ({ type }) => {
  const map = useMap()
  const events = useEventsStore(s => s.events)
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    if (!clusterGroupRef.current) {
      clusterGroupRef.current = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount()
          const icon = EventIcons[type]
          // Use a colored circle cluster icon
          return L.divIcon({
            html: `<div style="
              background: rgba(0,0,0,0.8);
              border: 2px solid #fff;
              border-radius: 50%;
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
              font-weight: 700;
              color: #fff;
            ">${count}</div>`,
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          })
        }
      })
      map.addLayer(clusterGroupRef.current)
    }

    const cluster = clusterGroupRef.current
    cluster.clearLayers()

    const filtered = events.filter(e => e.type === type)
    filtered.forEach(event => {
      const icon = EventIcons[event.type] ?? EventIcons['hazard']
      const marker = L.marker([event.position.lat, event.position.lng], { icon })
      marker.bindPopup(formatPopup(event), {
        className: 'tesla-popup',
        maxWidth: 220
      })
      cluster.addLayer(marker)
    })

    return () => {
      cluster.clearLayers()
    }
  }, [map, events, type])

  useEffect(() => {
    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current)
        clusterGroupRef.current = null
      }
    }
  }, [map])

  return null
}
