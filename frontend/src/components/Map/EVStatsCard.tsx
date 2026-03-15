import React, { useEffect, useState } from 'react'

interface EVStats {
  updated: string
  ev_total: number
  tesla_total: number
  chargers_total: number
  cities: Record<string, { ev: number; tesla: number }>
}

type View = 'totals' | 'cities'

export const EVStatsCard: React.FC = () => {
  const [stats, setStats]   = useState<EVStats | null>(null)
  const [view, setView]     = useState<View>('totals')
  const [open, setOpen]     = useState(true)

  useEffect(() => {
    fetch('/data/ev-stats-bg.json')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 72,
        right: 8,
        zIndex: 1000,
        width: 160,
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
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px 8px',
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
        }}
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
                  flex: 1,
                  fontSize: 10,
                  padding: '3px 0',
                  borderRadius: 6,
                  border: '1px solid',
                  cursor: 'pointer',
                  background: view === v ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
                  borderColor: view === v ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)',
                  color: view === v ? '#93c5fd' : 'rgba(255,255,255,0.5)',
                }}
              >
                {v === 'totals' ? 'Общо' : 'Градове'}
              </button>
            ))}
          </div>

          {view === 'totals' && (
            <>
              <StatRow icon="🚗" value={stats.ev_total.toLocaleString('bg')} label="Електромобила" />
              <StatRow icon="⚡" value={stats.tesla_total.toLocaleString('bg')} label="Tesla" color="#ef4444" />
              <StatRow icon="🔌" value={stats.chargers_total.toLocaleString('bg')} label="Зарядни" color="#22c55e" />
            </>
          )}

          {view === 'cities' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {Object.entries(stats.cities).map(([city, d]) => (
                <div key={city}>
                  <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 1 }}>{city}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{d.ev.toLocaleString('bg')}</span>
                    <span style={{ fontSize: 11, color: '#ef4444', opacity: 0.85 }}>T {d.tesla.toLocaleString('bg')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 9, opacity: 0.35, marginTop: 8 }}>
            Обновено {stats.updated}
          </div>
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
