import React, { useEffect, useState } from 'react'
import { useUIStore } from '../../store/uiStore'

interface EVStats {
  updated: string
  ev_total: number
  tesla_total: number
  chargers_total: number
  cities: Record<string, { ev: number; tesla: number }>
}

type View = 'totals' | 'cities'

const TeslaLogoSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 36 36" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
    <circle cx="18" cy="18" r="17" fill="#CC0000"/>
    <path fill="#fff" d="
      M18 13.2 L16.6 14.2 L16.6 25.5 L18 27.5 L19.4 25.5 L19.4 14.2 Z
      M11.2 13.8 C13 13.1 15.2 12.9 16.6 12.9 L16.6 14.2 C15.2 14.2 13.2 14.4 11.8 15 Z
      M24.8 13.8 C23 13.1 20.8 12.9 19.4 12.9 L19.4 14.2 C20.8 14.2 22.8 14.4 24.2 15 Z
      M10.2 11.6 C10.2 11.6 12 10.2 18 10.2 C24 10.2 25.8 11.6 25.8 11.6 L24.8 13.8
      C24.8 13.8 22.8 12.6 18 12.6 C13.2 12.6 11.2 13.8 11.2 13.8 Z
    "/>
  </svg>
)

export const EVStatsCard: React.FC = () => {
  const language             = useUIStore(s => s.language)
  const [stats, setStats]   = useState<EVStats | null>(null)
  const [view, setView]     = useState<View>('totals')
  const [open, setOpen]     = useState(true)

  useEffect(() => {
    fetch('/data/ev-stats-bg.json')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  // Only show in Bulgarian mode
  if (language !== 'bg' || !stats) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 170,
        background: 'rgba(15,15,15,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 8px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 600, letterSpacing: 0.3 }}>
          🇧🇬 EV България
        </span>
        <span style={{ fontSize: 10, opacity: 0.45 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 10px' }}>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(['totals', 'cities'] as View[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  flex: 1, fontSize: 10, padding: '3px 0', borderRadius: 6, border: '1px solid', cursor: 'pointer',
                  background:   view === v ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
                  borderColor:  view === v ? 'rgba(59,130,246,0.5)'  : 'rgba(255,255,255,0.1)',
                  color:        view === v ? '#93c5fd' : 'rgba(255,255,255,0.5)',
                }}
              >
                {v === 'totals' ? 'Общо' : 'Градове'}
              </button>
            ))}
          </div>

          {view === 'totals' && (
            <>
              <StatRow icon="🚗" value={stats.ev_total.toLocaleString('bg')} label="Електромобила" />
              <div style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', lineHeight: 1.1, display: 'flex', alignItems: 'center' }}>
                  <TeslaLogoSVG />{stats.tesla_total.toLocaleString('bg')}
                </div>
                <div style={{ fontSize: 10, opacity: 0.55 }}>Tesla</div>
              </div>
              <StatRow icon="🔌" value={stats.chargers_total.toLocaleString('bg')} label="Зарядни" color="#22c55e" />
            </>
          )}

          {view === 'cities' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {Object.entries(stats.cities).map(([city, d]) => (
                <div key={city}>
                  <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 1 }}>{city}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{d.ev.toLocaleString('bg')}</span>
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: '#ef4444', opacity: 0.85 }}>
                      <TeslaLogoSVG />{d.tesla.toLocaleString('bg')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 9, opacity: 0.35, marginTop: 8 }}>Обновено {stats.updated}</div>
        </div>
      )}
    </div>
  )
}

const StatRow: React.FC<{ icon: string; value: string; label: string; color?: string }> = ({ icon, value, label, color }) => (
  <div style={{ marginBottom: 7 }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: color ?? '#fff', lineHeight: 1.1 }}>
      {icon} {value}
    </div>
    <div style={{ fontSize: 10, opacity: 0.55 }}>{label}</div>
  </div>
)
