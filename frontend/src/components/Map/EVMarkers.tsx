import React, { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useEventsStore } from '../../store/eventsStore'
import { EVStation } from '../../types'
import { EVIcon, TeslaIcon } from './icons'

function formatEVPopup(station: EVStation): string {
  const connectors = station.connectors.map(c =>
    `<div style="font-size:12px;color:${c.available ? '#22c55e' : '#ef4444'}">
      ${c.type} · ${c.powerKw}kW · ${c.available ? 'Available' : 'In use'}
    </div>`
  ).join('')

  return `
    <div style="min-width:180px;color:#e5e5e5;background:#111;padding:8px;border-radius:8px">
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">${station.isTesla ? '⚡ ' : ''}${station.name}</div>
      <div style="font-size:12px;color:#9ca3af;margin-bottom:6px">${station.operator}</div>
      ${connectors}
      <div style="margin-top:6px;font-size:12px;color:#6b7280">
        ${station.availablePorts}/${station.totalPorts} ports available
        ${station.pricePerKwh ? ` · $${station.pricePerKwh}/kWh` : ''}
        ${station.distance ? ` · ${(station.distance / 1000).toFixed(1)}km` : ''}
      </div>
    </div>
  `
}

export const EVMarkers: React.FC = () => {
  const map        = useMap()
  const evStations = useEventsStore(s => s.evStations)

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 80,
      disableClusteringAtZoom: 15,
      showCoverageOnHover: false,
    })

    evStations.forEach(station => {
      const icon   = station.isTesla ? TeslaIcon : EVIcon(station.availablePorts, station.totalPorts)
      const marker = L.marker([station.position.lat, station.position.lng], { icon })
      marker.bindPopup(formatEVPopup(station), { maxWidth: 240 })
      cluster.addLayer(marker)
    })

    map.addLayer(cluster)

    return () => { map.removeLayer(cluster) }
  }, [map, evStations])

  return null
}
