import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { EventType } from '../../types'

export const LayersPanel: React.FC = () => {
  const { layers, toggleLayer, mapStyle, setMapStyle } = useUIStore()

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-white font-semibold text-lg">🗺️ Map Layers</h2>

      {/* Map style */}
      <div className="flex flex-col gap-2">
        <div className="text-tesla-muted text-xs uppercase tracking-wide">Map Style</div>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'satellite'] as const).map(style => (
            <button
              key={style}
              onClick={() => setMapStyle(style)}
              className={`py-2 rounded-xl text-sm font-medium border transition-all active:scale-95
                ${mapStyle === style
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  : 'bg-black/20 border-tesla-border text-tesla-muted'
                }`}
            >
              {style === 'light' ? '☀️ Day' : style === 'dark' ? '🌙 Night' : '🛰️ Satellite'}
            </button>
          ))}
        </div>
      </div>

      {/* Layer toggles */}
      <div className="flex flex-col gap-2">
        <div className="text-tesla-muted text-xs uppercase tracking-wide">Event Layers</div>
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id as EventType | 'risk_zones')}
            className="flex items-center justify-between py-3 px-3 rounded-2xl border border-tesla-border active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{layer.icon}</span>
              <span className="text-tesla-text font-medium">{layer.label}</span>
            </div>
            {/* Toggle switch */}
            <div className={`w-11 h-6 rounded-full transition-colors relative ${layer.enabled ? 'bg-blue-500' : 'bg-tesla-border'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${layer.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
