import React, { useState, useCallback } from 'react'
import { useRouteStore } from '../../store/routeStore'
import { useEventsStore } from '../../store/eventsStore'
import { useUIStore } from '../../store/uiStore'
import { calculateRoutes, geocodeAddress } from '../../services/api'
import { Route, RouteMode } from '../../types'

const MODE_LABELS: Record<RouteMode, { label: string; icon: string; color: string }> = {
  fastest:       { label: 'Fastest',       icon: '⚡', color: 'text-blue-400' },
  least_traffic: { label: 'Less Traffic',  icon: '🚦', color: 'text-purple-400' },
  least_cameras: { label: 'No Cameras',    icon: '📷', color: 'text-yellow-400' },
  lowest_risk:   { label: 'Lowest Risk',   icon: '🛡️', color: 'text-green-400' },
}

export const RoutePanel: React.FC = () => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ label: string; position: { lat: number; lng: number } }>>([])
  const [isSearching, setIsSearching] = useState(false)

  const { routes, activeRoute, isCalculating, setDestination, setRoutes, setActiveRoute, setCalculating, setNavigating } = useRouteStore()
  const { userPosition } = useEventsStore()
  const { setActivePanel } = useUIStore()

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (q.length < 3) { setSuggestions([]); return }
    setIsSearching(true)
    try {
      const results = await geocodeAddress(q, userPosition ?? undefined)
      setSuggestions(results.slice(0, 5))
    } catch {
      setSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }, [userPosition])

  const handleSelectDestination = useCallback(async (item: typeof suggestions[0]) => {
    setSuggestions([])
    setQuery(item.label)
    if (!userPosition) return

    setDestination({ position: item.position, label: item.label })
    setCalculating(true)

    try {
      const routes = await calculateRoutes(userPosition, item.position)
      setRoutes(routes)
    } catch (err) {
      console.error('Route calculation failed:', err)
    } finally {
      setCalculating(false)
    }
  }, [userPosition, setDestination, setCalculating, setRoutes])

  const handleStartNavigation = () => {
    if (!activeRoute) return
    setNavigating(true)
    setActivePanel(null)
  }

  const riskColor = (score: number) =>
    score < 30 ? 'text-green-400' : score < 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-white font-semibold text-lg flex items-center gap-2">
        🧭 Navigation
      </h2>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Where to?"
          className="w-full bg-black/40 border border-tesla-border rounded-2xl px-4 py-3 text-white placeholder-tesla-muted text-base outline-none focus:border-tesla-accent transition-colors"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-tesla-panel border border-tesla-border rounded-2xl overflow-hidden z-10">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSelectDestination(s)}
                className="w-full text-left px-4 py-3 text-sm text-tesla-text hover:bg-white/5 active:bg-white/10 transition-colors border-b border-tesla-border last:border-0"
              >
                📍 {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Route options */}
      {isCalculating && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-3" />
          <span className="text-tesla-muted">Calculating routes…</span>
        </div>
      )}

      {!isCalculating && routes.length > 0 && (
        <div className="flex flex-col gap-2">
          {routes.map(route => (
            <button
              key={route.id}
              onClick={() => setActiveRoute(route)}
              className={`w-full text-left rounded-2xl p-3 border transition-all active:scale-[0.98]
                ${activeRoute?.id === route.id
                  ? 'bg-blue-500/15 border-blue-500/50'
                  : 'bg-black/20 border-tesla-border hover:bg-white/5'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{MODE_LABELS[route.mode].icon}</span>
                  <span className={`font-semibold ${MODE_LABELS[route.mode].color}`}>
                    {MODE_LABELS[route.mode].label}
                  </span>
                </div>
                {activeRoute?.id === route.id && (
                  <span className="text-blue-400 text-xs font-medium">SELECTED</span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <StatCell label="TIME" value={`${Math.round(route.durationSeconds / 60)}m`} />
                <StatCell label="DIST" value={`${(route.distanceMeters / 1000).toFixed(1)}km`} />
                <StatCell label="CAMS" value={String(route.summary.cameraCount)} highlight={route.summary.cameraCount > 0} />
                <StatCell
                  label="RISK"
                  value={String(route.summary.riskScore)}
                  className={riskColor(route.summary.riskScore)}
                />
              </div>

              {/* Alert summary */}
              {(route.summary.policeCount > 0 || route.summary.accidentCount > 0) && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-tesla-border/50">
                  {route.summary.policeCount > 0 && (
                    <span className="text-xs text-red-400">🚔 {route.summary.policeCount}</span>
                  )}
                  {route.summary.accidentCount > 0 && (
                    <span className="text-xs text-orange-400">💥 {route.summary.accidentCount}</span>
                  )}
                  {route.summary.nextCameraDistance != null && (
                    <span className="text-xs text-yellow-400">
                      📷 in {(route.summary.nextCameraDistance / 1000).toFixed(1)}km
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}

          <button
            onClick={handleStartNavigation}
            disabled={!activeRoute}
            className="w-full bg-tesla-accent hover:bg-blue-600 disabled:opacity-40 text-white font-semibold text-base py-3 rounded-2xl transition-all active:scale-[0.98] mt-1"
          >
            Start Navigation →
          </button>
        </div>
      )}
    </div>
  )
}

const StatCell: React.FC<{ label: string; value: string; highlight?: boolean; className?: string }> = ({
  label, value, highlight, className
}) => (
  <div className="flex flex-col items-center">
    <span className="text-tesla-muted text-xs">{label}</span>
    <span className={`text-white font-semibold text-sm ${highlight ? 'text-yellow-400' : ''} ${className ?? ''}`}>
      {value}
    </span>
  </div>
)
