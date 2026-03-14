import React from 'react'
import { useEventsStore } from '../../store/eventsStore'
import { useRouteStore } from '../../store/routeStore'
import { useUIStore } from '../../store/uiStore'

export const TopBar: React.FC = () => {
  const { userSpeed, nextPolice, nextCamera, nearbyEvents } = useEventsStore()
  const { activeRoute, isNavigating } = useRouteStore()
  const { voiceEnabled, setVoiceEnabled, togglePanel, mapStyle, toggleDayNight } = useUIStore()

  const riskScore = activeRoute?.summary.riskScore ?? 0
  const riskColor = riskScore < 30 ? 'text-green-400' : riskScore < 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center gap-2 px-4 py-3 pointer-events-none">
      {/* Speed display */}
      <div className="pointer-events-auto flex items-center gap-1 bg-tesla-panel/90 backdrop-blur-sm border border-tesla-border rounded-2xl px-4 py-2">
        <span className="text-white font-bold text-2xl leading-none">{Math.round(userSpeed)}</span>
        <span className="text-tesla-muted text-sm font-medium">km/h</span>
      </div>

      {/* Route info */}
      {isNavigating && activeRoute && (
        <div className="pointer-events-auto flex items-center gap-3 bg-tesla-panel/90 backdrop-blur-sm border border-tesla-border rounded-2xl px-4 py-2 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-tesla-muted text-xs">ETA</span>
            <span className="text-white font-semibold">
              {Math.round(activeRoute.durationSeconds / 60)}min
            </span>
          </div>
          <div className="w-px h-4 bg-tesla-border" />
          <div className="flex items-center gap-1">
            <span className="text-tesla-muted text-xs">DIST</span>
            <span className="text-white font-semibold">
              {(activeRoute.distanceMeters / 1000).toFixed(1)}km
            </span>
          </div>
          <div className="w-px h-4 bg-tesla-border" />
          <div className="flex items-center gap-1">
            <span className="text-tesla-muted text-xs">RISK</span>
            <span className={`font-bold text-sm ${riskColor}`}>{riskScore}</span>
          </div>
        </div>
      )}

      {/* Alert indicators */}
      <div className="pointer-events-auto ml-auto flex items-center gap-2">
        {nextPolice && (
          <div className="flex items-center gap-1 bg-red-900/80 border border-red-500/50 rounded-xl px-3 py-2 animate-pulse-slow">
            <span className="text-base">🚔</span>
            <span className="text-red-300 text-sm font-semibold">
              {nextPolice.distance ? `${Math.round(nextPolice.distance)}m` : ''}
            </span>
          </div>
        )}
        {nextCamera && (
          <div className="flex items-center gap-1 bg-yellow-900/80 border border-yellow-500/50 rounded-xl px-3 py-2">
            <span className="text-base">📷</span>
            <span className="text-yellow-300 text-sm font-semibold">
              {nextCamera.distance ? `${Math.round(nextCamera.distance)}m` : ''}
              {nextCamera.speed ? ` · ${nextCamera.speed}` : ''}
            </span>
          </div>
        )}

        {/* Day / Night toggle */}
        <button
          onClick={toggleDayNight}
          className="bg-tesla-panel/90 backdrop-blur-sm border border-tesla-border rounded-2xl p-2 w-11 h-11 flex items-center justify-center active:scale-95 transition-transform"
          title={mapStyle === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
        >
          <span className="text-lg">{mapStyle === 'dark' ? '☀️' : '🌙'}</span>
        </button>

        {/* Voice toggle */}
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className="bg-tesla-panel/90 backdrop-blur-sm border border-tesla-border rounded-2xl p-2 w-11 h-11 flex items-center justify-center active:scale-95 transition-transform"
        >
          <span className="text-lg">{voiceEnabled ? '🔊' : '🔇'}</span>
        </button>

        {/* Layers button */}
        <button
          onClick={() => togglePanel('layers')}
          className="bg-tesla-panel/90 backdrop-blur-sm border border-tesla-border rounded-2xl p-2 w-11 h-11 flex items-center justify-center active:scale-95 transition-transform"
        >
          <span className="text-lg">🗺️</span>
        </button>
      </div>
    </div>
  )
}
