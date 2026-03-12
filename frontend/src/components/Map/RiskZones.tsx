import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEventsStore } from '../../store/eventsStore'

export const RiskZones: React.FC = () => {
  const map = useMap()
  const riskZones = useEventsStore(s => s.riskZones)
  const circlesRef = useRef<L.Circle[]>([])

  useEffect(() => {
    circlesRef.current.forEach(c => map.removeLayer(c))
    circlesRef.current = []

    riskZones.forEach(zone => {
      const alpha = zone.score / 100
      const circle = L.circle([zone.center.lat, zone.center.lng], {
        radius: zone.radiusMeters,
        color: `rgba(220, 38, 38, ${0.6 + alpha * 0.4})`,
        fillColor: '#DC2626',
        fillOpacity: alpha * 0.25,
        weight: 2,
        dashArray: '4 4'
      })
      circle.bindTooltip(
        `<div style="color:#e5e5e5;background:#111;padding:4px 8px;border-radius:6px;font-size:13px">
          ⚠️ Risk Zone · Score: ${zone.score}/100<br/>
          ${zone.historicalCount} historical reports
        </div>`,
        { sticky: true }
      )
      circle.addTo(map)
      circlesRef.current.push(circle)
    })

    return () => {
      circlesRef.current.forEach(c => map.removeLayer(c))
      circlesRef.current = []
    }
  }, [map, riskZones])

  return null
}
