import React, { useMemo } from 'react'
import { useEventsStore } from '../../store/eventsStore'
import { EVStation, PlugType } from '../../types'

const PLUG_COLORS: Record<PlugType, string> = {
  Tesla:    'bg-red-500/20 text-red-400 border-red-500/30',
  CCS:      'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CCS2:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CHAdeMO:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Type2:    'bg-green-500/20 text-green-400 border-green-500/30',
  J1772:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const StationCard: React.FC<{ station: EVStation }> = ({ station }) => {
  const availability = station.totalPorts > 0
    ? station.availablePorts / station.totalPorts
    : 0
  const availColor = availability > 0.5 ? 'text-green-400' : availability > 0.2 ? 'text-yellow-400' : 'text-red-400'

  const maxPower = Math.max(...station.connectors.map(c => c.powerKw), 0)

  return (
    <div className="bg-black/20 border border-tesla-border rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {station.isTesla && <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded px-2 py-0.5">Tesla</span>}
            <span className="text-white font-semibold text-sm truncate">{station.name}</span>
          </div>
          <div className="text-tesla-muted text-xs">{station.operator}</div>
        </div>
        <div className="text-right ml-2">
          <div className={`font-bold text-lg ${availColor}`}>
            {station.availablePorts}/{station.totalPorts}
          </div>
          <div className="text-tesla-muted text-xs">ports</div>
        </div>
      </div>

      {/* Connectors */}
      <div className="flex flex-wrap gap-1 mb-3">
        {station.connectors.map((conn, i) => (
          <span
            key={i}
            className={`text-xs rounded px-2 py-0.5 border ${PLUG_COLORS[conn.type] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'} ${!conn.available ? 'opacity-40' : ''}`}
          >
            {conn.type} {conn.powerKw}kW
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-tesla-muted">
        {maxPower > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-yellow-400">⚡</span>
            {maxPower}kW max
          </span>
        )}
        {station.pricePerKwh != null && (
          <span>${station.pricePerKwh.toFixed(2)}/kWh</span>
        )}
        {station.distance != null && (
          <span className="ml-auto">{(station.distance / 1000).toFixed(1)}km away</span>
        )}
      </div>
    </div>
  )
}

export const EVPanel: React.FC = () => {
  const { evStations, userPosition } = useEventsStore()

  const sortedStations = useMemo(() => {
    return [...evStations].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  }, [evStations])

  const availableCount = evStations.filter(s => s.availablePorts > 0).length

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">⚡ EV Charging</h2>
        <div className="text-sm text-tesla-muted">
          <span className="text-green-400 font-semibold">{availableCount}</span>/{evStations.length} available
        </div>
      </div>

      {!userPosition && (
        <div className="text-tesla-muted text-sm text-center py-4">📡 Waiting for GPS…</div>
      )}

      {evStations.length === 0 && userPosition && (
        <div className="text-tesla-muted text-sm text-center py-6">
          No charging stations found nearby
        </div>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-80 scrollbar-hide">
        {sortedStations.map(station => (
          <StationCard key={station.id} station={station} />
        ))}
      </div>
    </div>
  )
}
