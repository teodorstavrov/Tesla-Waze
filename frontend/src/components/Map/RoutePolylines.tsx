import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useRouteStore } from '../../store/routeStore'
import { Route } from '../../types'

const ROUTE_STYLES: Record<string, { weight: number; opacity: number; dashArray?: string }> = {
  active:   { weight: 6, opacity: 0.9 },
  inactive: { weight: 4, opacity: 0.5, dashArray: '8 4' },
}

export const RoutePolylines: React.FC = () => {
  const map = useMap()
  const routes = useRouteStore(s => s.routes)
  const activeRoute = useRouteStore(s => s.activeRoute)
  const setActiveRoute = useRouteStore(s => s.setActiveRoute)
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map())

  useEffect(() => {
    // Remove old polylines
    polylinesRef.current.forEach(p => map.removeLayer(p))
    polylinesRef.current.clear()

    routes.forEach((route: Route) => {
      const isActive = route.id === activeRoute?.id
      const style = isActive ? ROUTE_STYLES.active : ROUTE_STYLES.inactive
      const latlngs = route.polyline.map(p => [p.lat, p.lng] as [number, number])

      const polyline = L.polyline(latlngs, {
        color: route.color,
        weight: style.weight,
        opacity: style.opacity,
        dashArray: style.dashArray,
        lineJoin: 'round',
        lineCap: 'round'
      })

      polyline.on('click', () => setActiveRoute(route))
      polyline.bindTooltip(
        `<div style="color:#e5e5e5;background:#111;padding:4px 8px;border-radius:6px;font-size:13px">
          ${route.mode.replace('_', ' ')} · ${Math.round(route.distanceMeters / 1000)}km · ${Math.round(route.durationSeconds / 60)}min
          <br/>Risk: ${route.summary.riskScore}/100
        </div>`,
        { permanent: false, sticky: true }
      )

      polyline.addTo(map)
      polylinesRef.current.set(route.id, polyline)
    })

    // Fit bounds to active route
    if (activeRoute && activeRoute.polyline.length > 0) {
      const bounds = L.latLngBounds(activeRoute.polyline.map(p => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 })
    }

    return () => {
      polylinesRef.current.forEach(p => map.removeLayer(p))
      polylinesRef.current.clear()
    }
  }, [map, routes, activeRoute, setActiveRoute])

  return null
}
