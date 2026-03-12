import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEventsStore } from '../../store/eventsStore'
import { UserIcon } from './icons'

export const UserMarker: React.FC = () => {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)
  const accuracyRef = useRef<L.Circle | null>(null)
  const userPosition = useEventsStore(s => s.userPosition)
  const userHeading = useEventsStore(s => s.userHeading)

  useEffect(() => {
    if (!userPosition) return

    const { lat, lng } = userPosition

    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon: UserIcon, zIndexOffset: 1000 })
      markerRef.current.addTo(map)
      accuracyRef.current = L.circle([lat, lng], {
        radius: 30,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(map)
    } else {
      markerRef.current.setLatLng([lat, lng])
      accuracyRef.current?.setLatLng([lat, lng])
    }
  }, [map, userPosition])

  useEffect(() => {
    return () => {
      if (markerRef.current) map.removeLayer(markerRef.current)
      if (accuracyRef.current) map.removeLayer(accuracyRef.current)
    }
  }, [map])

  return null
}
