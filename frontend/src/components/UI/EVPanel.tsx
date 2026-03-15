import React, { useMemo, useState, useCallback } from 'react'
import { useEventsStore } from '../../store/eventsStore'
import { useT } from '../../i18n/useT'
import { EVStation, PlugType } from '../../types'

const PLUG_COLORS: Record<PlugType, string> = {
  Tesla:   'bg-red-500/20 text-red-400 border-red-500/30',
  CCS:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CCS2:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CHAdeMO: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Type2:   'bg-green-500/20 text-green-400 border-green-500/30',
  J1772:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const POWER_TIERS: { min: number; label: string }[] = [
  { min: 0,   label: '<7kW'   },
  { min: 7,   label: '7-21kW' },
  { min: 22,  label: '22-49kW'},
  { min: 50,  label: '50-149kW'},
  { min: 150, label: '150kW+' },
]

const StationCard: React.FC<{ station: EVStation }> = ({ station }) => {
  const t = useT()
  const availability = station.totalPorts > 0 ? station.availablePorts / station.totalPorts : 0
  const availColor   = availability > 0.5 ? 'text-green-400' : availability > 0.2 ? 'text-yellow-400' : 'text-red-400'
  const maxPower     = Math.max(...station.connectors.map(c => c.powerKw), 0)

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
          <div className={`font-bold text-lg ${availColor}`}>{station.availablePorts}/{station.totalPorts}</div>
          <div className="text-tesla-muted text-xs">{t('evPorts')}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {station.connectors.map((conn, i) => (
          <span key={i} className={`text-xs rounded px-2 py-0.5 border ${PLUG_COLORS[conn.type] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'} ${!conn.available ? 'opacity-40' : ''}`}>
            {conn.type} {conn.powerKw}kW
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-tesla-muted">
        {maxPower > 0 && <span className="flex items-center gap-1"><span className="text-yellow-400">⚡</span>{maxPower}kW max</span>}
        {station.pricePerKwh != null && <span>${station.pricePerKwh.toFixed(2)}/kWh</span>}
        {station.distance != null && <span className="ml-auto">{(station.distance / 1000).toFixed(1)}km {t('evAway')}</span>}
      </div>
    </div>
  )
}

export const EVPanel: React.FC = () => {
  const { evStations, userPosition } = useEventsStore()
  const t = useT()
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = useCallback((kw: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(kw) ? next.delete(kw) : next.add(kw)
      return next
    })
  }, [])

  const getTier = (max: number) => {
    const tiers = [...POWER_TIERS].sort((a, b) => b.min - a.min)
    return tiers.find(t => max >= t.min)?.min ?? 0
  }

  const filtered = useMemo(() => {
    if (selected.size === 0) return [...evStations].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    return evStations
      .filter(s => {
        const max = Math.max(...s.connectors.map(c => c.powerKw), 0)
        return selected.has(getTier(max))
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  }, [evStations, selected])


  const availableCount = filtered.filter(s => s.availablePorts > 0).length

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">{t('evTitle')}</h2>
        <div className="text-sm text-tesla-muted">
          <span className="text-green-400 font-semibold">{availableCount}</span>/{filtered.length} {t('evAvailable')}
        </div>
      </div>

      {/* Power filter — multi-select */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="text-tesla-muted text-xs uppercase tracking-wide">{t('evMinPower')}</div>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-xs text-tesla-muted underline">
              {t('evAll')}
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {POWER_TIERS.map(({ min, label }) => (
            <button
              key={min}
              onClick={() => toggle(min)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all active:scale-95
                ${selected.has(min)
                  ? 'bg-blue-500/30 border-blue-400/60 text-blue-300'
                  : 'bg-black/20 border-tesla-border text-tesla-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!userPosition && <div className="text-tesla-muted text-sm text-center py-4">{t('evWaitingGPS')}</div>}

      {filtered.length === 0 && userPosition && (
        <div className="text-tesla-muted text-sm text-center py-6">{t('evNoneNearby')}</div>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-80 scrollbar-hide">
        {filtered.map(station => <StationCard key={station.id} station={station} />)}
      </div>
    </div>
  )
}
