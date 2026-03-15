import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEventsStore } from '../../store/eventsStore'
import { UserArrowIcon } from './icons'

export const UserMarker: React.FC = () => {
  const map         = useMap()
  const markerRef   = useRef<L.Marker | null>(null)
  const accuracyRef = useRef<L.Circle | null>(null)
  const userPosition = useEventsStore(s => s.userPosition)
  const userHeading  = useEventsStore(s => s.userHeading)

  // Create / move marker when position changes
  useEffect(() => {
    if (!userPosition) return
    const { lat, lng } = userPosition

    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], {
        icon: UserArrowIcon(userHeading),
        zIndexOffset: 1000,
      }).addTo(map)

      accuracyRef.current = L.circle([lat, lng], {
        radius: 30,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(map)
    } else {
      markerRef.current.setLatLng([lat, lng])
      accuracyRef.current?.setLatLng([lat, lng])
    }
  }, [map, userPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rotate arrow when heading changes (no need to recreate marker)
  useEffect(() => {
    if (!markerRef.current) return
    markerRef.current.setIcon(UserArrowIcon(userHeading))
  }, [userHeading])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current)   map.removeLayer(markerRef.current)
      if (accuracyRef.current) map.removeLayer(accuracyRef.current)
    }
  }, [map])

  return null
}
