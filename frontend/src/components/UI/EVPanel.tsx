import React, { useMemo, useState, useCallback } from 'react'
import { useEventsStore } from '../../store/eventsStore'
import { useRouteStore } from '../../store/routeStore'
import { useUIStore } from '../../store/uiStore'
import { useT } from '../../i18n/useT'
import { EVStation, PlugType } from '../../types'
import { calculateRoutes } from '../../services/api'

const PLUG_COLORS: Record<PlugType, string> = {
  Tesla:   'bg-red-500/20 text-red-400 border-red-500/30',
  CCS:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CCS2:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CHAdeMO: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Type2:   'bg-green-500/20 text-green-400 border-green-500/30',
  J1772:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const POWER_TIERS: { min: number; label: string }[] = [
  { min: 7,   label: '7-21kW'  },
  { min: 22,  label: '22-49kW' },
  { min: 50,  label: '50-149kW'},
  { min: 150, label: '150kW+'  },
]

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2)
  const x = s1 * s1 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * s2 * s2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function getTier(max: number) {
  return [...POWER_TIERS].sort((a, b) => b.min - a.min).find(t => max >= t.min)?.min ?? 0
}

function normalizeOperator(op: string): string {
  const o = op.toLowerCase()
  if (o.includes('tesla'))   return 'Tesla'
  if (o.includes('eldrive')) return 'Eldrive'
  if (o.includes('fines') || o.includes('финес')) return 'Fines'
  if (o.includes('spark'))   return 'Spark'
  if (o.includes('echarge') || o.includes('e-charge')) return 'eCharge'
  if (o.includes('unknown') || o === '') return 'Other'
  return op.split(/[\s/,]+/)[0].slice(0, 12)
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

const FilterBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all active:scale-95
      ${active ? 'bg-blue-500/30 border-blue-400/60 text-blue-300' : 'bg-black/20 border-tesla-border text-tesla-muted'}`}
  >
    {children}
  </button>
)

type StationWithDist = EVStation & { _dist: number; _brand: string }

const StationCard: React.FC<{
  station: StationWithDist
  onRoute: (s: StationWithDist) => void
  isRouting: boolean
  isActive: boolean
}> = ({ station, onRoute, isRouting, isActive }) => {
  const t = useT()
  const availability = station.totalPorts > 0 ? station.availablePorts / station.totalPorts : 0
  const availColor   = availability > 0.5 ? 'text-green-400' : availability > 0.2 ? 'text-yellow-400' : 'text-red-400'
  const maxPower     = Math.max(...station.connectors.map(c => c.powerKw), 0)

  return (
    <button
      onClick={() => onRoute(station)}
      className={`w-full text-left rounded-2xl p-4 border transition-all active:scale-[0.98]
        ${isActive
          ? 'bg-blue-500/15 border-blue-400/50'
          : 'bg-black/20 border-tesla-border hover:border-white/20'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {station.isTesla && <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded px-2 py-0.5">Tesla</span>}
            <span className="text-white font-semibold text-sm truncate">{station.name}</span>
          </div>
          <div className="text-tesla-muted text-xs">{station.operator}</div>
        </div>
        <div className="text-right ml-2 flex-shrink-0">
          <div className={`font-bold text-lg ${availColor}`}>{station.availablePorts}/{station.totalPorts}</div>
          <div className="text-tesla-muted text-xs">{t('evPorts')}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {station.connectors.map((conn, i) => (
          <span key={i} className={`text-xs rounded px-2 py-0.5 border ${PLUG_COLORS[conn.type] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'} ${!conn.available ? 'opacity-40' : ''}`}>
            {conn.type} {conn.powerKw > 0 ? `${conn.powerKw}kW` : ''}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-tesla-muted">
        {maxPower > 0 && <span className="flex items-center gap-1"><span className="text-yellow-400">⚡</span>{maxPower}kW max</span>}
        {station._dist < Infinity && <span className="ml-auto font-semibold text-white/70">{fmtDist(station._dist)}</span>}
        {isRouting && isActive && <span className="text-blue-400 animate-pulse">Routing…</span>}
      </div>
    </button>
  )
}

export const EVPanel: React.FC = () => {
  const { evStations, userPosition, setSelectedEVStation } = useEventsStore()
  const { setRoutes, clearRoute, activeRoute } = useRouteStore()
  const { setActivePanel } = useUIStore()
  const t = useT()

  const [powerFilter, setPowerFilter] = useState<Set<number> | null>(null)
  const [brandFilter, setBrandFilter] = useState<Set<string> | null>(null)
  const [routingId, setRoutingId]     = useState<string | null>(null)
  const [activeId, setActiveId]       = useState<string | null>(null)
  const [routeInfo, setRouteInfo]     = useState<{ dist: number; dur: number } | null>(null)

  const togglePower = useCallback((min: number) => {
    setPowerFilter(prev => {
      const next = new Set(prev ?? [])
      next.has(min) ? next.delete(min) : next.add(min)
      return next.size === 0 ? null : next
    })
  }, [])

  const toggleBrand = useCallback((brand: string) => {
    setBrandFilter(prev => {
      const next = new Set(prev ?? [])
      next.has(brand) ? next.delete(brand) : next.add(brand)
      return next.size === 0 ? null : next
    })
  }, [])

  const withDist = useMemo(() =>
    evStations
      .map(s => ({
        ...s,
        _dist:  userPosition ? haversine(userPosition, s.position) : Infinity,
        _brand: normalizeOperator(s.operator ?? ''),
      }))
      .sort((a, b) => a._dist - b._dist),
    [evStations, userPosition]
  )

  const brands = useMemo(() => [...new Set(withDist.map(s => s._brand))].sort(), [withDist])

  const filtered = useMemo(() =>
    withDist.filter(s => {
      if (powerFilter !== null) {
        const max = Math.max(...s.connectors.map(c => c.powerKw), 0)
        if (!powerFilter.has(getTier(max))) return false
      }
      if (brandFilter !== null && !brandFilter.has(s._brand)) return false
      return true
    }),
    [withDist, powerFilter, brandFilter]
  )

  const handleRoute = useCallback(async (station: StationWithDist) => {
    // Toggle off if already active
    if (activeId === station.id) {
      setActiveId(null)
      setRouteInfo(null)
      clearRoute()
      setSelectedEVStation(null)
      return
    }
    if (!userPosition) return
    setRoutingId(station.id)
    setActiveId(station.id)
    setRouteInfo(null)
    setActivePanel(null)
    try {
      const routes = await calculateRoutes(userPosition, station.position, ['fastest'])
      setRoutes(routes)
      if (routes[0]) {
        const rd = routes[0].distanceMeters, ru = routes[0].durationSeconds
        setRouteInfo({ dist: rd, dur: ru })
        setSelectedEVStation({ ...station, _routeDist: rd, _routeDur: ru })
      }
    } catch {
      // silently fail
    } finally {
      setRoutingId(null)
    }
  }, [userPosition, activeId, setRoutes, clearRoute])

  const availableCount = filtered.filter(s => s.availablePorts > 0).length

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">{t('evTitle')}</h2>
        <div className="text-sm text-tesla-muted">
          <span className="text-green-400 font-semibold">{availableCount}</span>/{filtered.length} {t('evAvailable')}
        </div>
      </div>

      {/* Active route info banner */}
      {routeInfo && activeId && (
        <div className="flex items-center justify-between bg-blue-500/15 border border-blue-400/40 rounded-2xl px-4 py-2">
          <span className="text-blue-300 text-sm font-semibold">
            🗺 {fmtDist(routeInfo.dist)} · {Math.round(routeInfo.dur / 60)} min
          </span>
          <button
            onClick={() => { setActiveId(null); setRouteInfo(null); clearRoute() }}
            className="text-tesla-muted text-xs underline"
          >
            ✕ clear
          </button>
        </div>
      )}

      {/* Power filter */}
      <div className="flex flex-col gap-1">
        <div className="text-tesla-muted text-xs uppercase tracking-wide">{t('evMinPower')}</div>
        <div className="flex gap-2 flex-wrap">
          <FilterBtn active={powerFilter === null} onClick={() => setPowerFilter(null)}>{t('evAll')}</FilterBtn>
          {POWER_TIERS.map(({ min, label }) => (
            <FilterBtn key={min} active={powerFilter?.has(min) ?? false} onClick={() => togglePower(min)}>{label}</FilterBtn>
          ))}
        </div>
      </div>

      {/* Brand filter */}
      {brands.length > 1 && (
        <div className="flex flex-col gap-1">
          <div className="text-tesla-muted text-xs uppercase tracking-wide">Brand</div>
          <div className="flex gap-2 flex-wrap">
            <FilterBtn active={brandFilter === null} onClick={() => setBrandFilter(null)}>{t('evAll')}</FilterBtn>
            {brands.map(brand => (
              <FilterBtn key={brand} active={brandFilter?.has(brand) ?? false} onClick={() => toggleBrand(brand)}>{brand}</FilterBtn>
            ))}
          </div>
        </div>
      )}

      {!userPosition && <div className="text-tesla-muted text-sm text-center py-4">{t('evWaitingGPS')}</div>}
      {filtered.length === 0 && userPosition && (
        <div className="text-tesla-muted text-sm text-center py-6">{t('evNoneNearby')}</div>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-80 scrollbar-hide">
        {filtered.map(station => (
          <StationCard
            key={station.id}
            station={station}
            onRoute={handleRoute}
            isRouting={routingId === station.id}
            isActive={activeId === station.id}
          />
        ))}
      </div>
    </div>
  )
}
