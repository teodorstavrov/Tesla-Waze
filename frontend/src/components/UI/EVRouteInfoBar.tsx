import React from 'react'
import { useEventsStore } from '../../store/eventsStore'
import { useRouteStore } from '../../store/routeStore'
import { useT } from '../../i18n/useT'

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

export const EVRouteInfoBar: React.FC = () => {
  const { selectedEVStation, setSelectedEVStation, requestRecenter } = useEventsStore()
  const { clearRoute } = useRouteStore()
  const t = useT()

  if (!selectedEVStation) return null

  const s = selectedEVStation
  const maxPower = Math.max(...s.connectors.map(c => c.powerKw), 0)
  const availColor = s.availablePorts > 0 ? '#4ade80' : '#f87171'

  const handleOK = () => {
    clearRoute()
    setSelectedEVStation(null)
    requestRecenter()
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 72,
        left: 8,
        zIndex: 1500,
        width: 'min(400px, 92vw)',
        background: 'rgba(10,10,10,0.94)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 18,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
        pointerEvents: 'auto',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {s.isTesla && (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
              <circle cx="18" cy="18" r="17" fill="#CC0000"/>
              <path fill="#fff" d="M18 13.2 L16.6 14.2 L16.6 25.5 L18 27.5 L19.4 25.5 L19.4 14.2 Z M11.2 13.8 C13 13.1 15.2 12.9 16.6 12.9 L16.6 14.2 C15.2 14.2 13.2 14.4 11.8 15 Z M24.8 13.8 C23 13.1 20.8 12.9 19.4 12.9 L19.4 14.2 C20.8 14.2 22.8 14.4 24.2 15 Z M10.2 11.6 C10.2 11.6 12 10.2 18 10.2 C24 10.2 25.8 11.6 25.8 11.6 L24.8 13.8 C24.8 13.8 22.8 12.6 18 12.6 C13.2 12.6 11.2 13.8 11.2 13.8 Z"/>
            </svg>
          )}
          <span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.name}
          </span>
        </div>
        {/* Route distance */}
        {s._routeDist != null && (
          <span style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd', flexShrink: 0 }}>
            🗺 {fmtDist(s._routeDist)} · {Math.round((s._routeDur ?? 0) / 60)}min
          </span>
        )}
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        <InfoCell icon="🏢" label={t('evBrand')} value={s._brand} />
        <InfoCell icon="⚡" label={t('evPower')} value={maxPower > 0 ? `${maxPower}kW` : '—'} />
        <InfoCell icon="🔌" label={t('evPorts')} value={`${s.availablePorts}/${s.totalPorts}`} valueColor={availColor} />
        <InfoCell icon="📍" label={t('evDist')} value={fmtDist(s._dist)} />
      </div>

      {/* OK button */}
      <button
        onClick={handleOK}
        style={{
          marginTop: 2,
          padding: '10px 0',
          borderRadius: 12,
          background: 'rgba(59,130,246,0.25)',
          border: '1px solid rgba(59,130,246,0.5)',
          color: '#93c5fd',
          fontWeight: 700,
          fontSize: 15,
          cursor: 'pointer',
          letterSpacing: 1,
        }}
      >
        OK
      </button>
    </div>
  )
}

const InfoCell: React.FC<{ icon: string; label: string; value: string; valueColor?: string }> = ({ icon, label, value, valueColor }) => (
  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '7px 6px', textAlign: 'center' }}>
    <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
    <div style={{ fontSize: 12, fontWeight: 700, color: valueColor ?? '#fff' }}>{value}</div>
    <div style={{ fontSize: 9, opacity: 0.45, marginTop: 1 }}>{label}</div>
  </div>
)
