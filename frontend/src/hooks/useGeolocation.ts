import { useEffect, useRef } from 'react'
import { useEventsStore } from '../store/eventsStore'

interface GeolocationOptions {
  enableHighAccuracy?: boolean
  maximumAge?: number
  timeout?: number
}

export function useGeolocation(options: GeolocationOptions = {}) {
  const watchId = useRef<number | null>(null)
  const lastPos = useRef<GeolocationPosition | null>(null)
  const setUserPosition = useEventsStore(s => s.setUserPosition)

  useEffect(() => {
    if (!navigator.geolocation) return

    const opts: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      maximumAge: options.maximumAge ?? 1000,
      timeout: options.timeout ?? 5000
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, heading, speed } = pos.coords
      const speedKmh = speed != null ? speed * 3.6 : 0
      const headingDeg = heading ?? 0
      setUserPosition({ lat, lng }, headingDeg, speedKmh)
      lastPos.current = pos
    }

    const handleError = (err: GeolocationPositionError) => {
      console.warn('[Geolocation] Error:', err.message)
    }

    watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, opts)

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, [setUserPosition, options.enableHighAccuracy, options.maximumAge, options.timeout])

  return { lastPosition: lastPos.current }
}
