import React, { useEffect, useState } from 'react'
import { useEventsStore } from '../../store/eventsStore'
import { useT } from '../../i18n/useT'

export const LoadingBar: React.FC = () => {
  const events   = useEventsStore(s => s.events)
  const t        = useT()
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!visible) return

    // Animate progress 0→90% in ~10s, then jump to 100% when done
    const start = Date.now()
    const DURATION = 10000

    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const p = Math.min((elapsed / DURATION) * 90, 90)
      setProgress(p)
    }, 80)

    // Auto-close at 14s regardless
    const autoClose = setTimeout(() => {
      setProgress(100)
      setTimeout(() => setVisible(false), 400)
    }, 14000)

    return () => {
      clearInterval(tick)
      clearTimeout(autoClose)
    }
  }, [])

  // Close as soon as first events arrive
  useEffect(() => {
    if (events.length > 0 && visible) {
      setProgress(100)
      const t = setTimeout(() => setVisible(false), 400)
      return () => clearTimeout(t)
    }
  }, [events.length, visible])

  if (!visible) return null

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      zIndex: 2000,
      pointerEvents: 'none',
    }}>
      {/* Progress bar */}
      <div style={{
        height: 3,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
          transition: progress === 100 ? 'width 0.3s ease' : 'width 0.08s linear',
          boxShadow: '0 0 8px rgba(96,165,250,0.8)',
        }} />
      </div>

      {/* Label */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(10,10,10,0.85)',
        border: '1px solid rgba(59,130,246,0.3)',
        borderRadius: 20,
        padding: '5px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#3b82f6',
          display: 'inline-block',
          animation: 'ev-pulse-dot 1s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 12, color: '#93c5fd', fontFamily: 'system-ui', letterSpacing: 0.3 }}>
          {t('loadingSignals')}
        </span>
        <style>{`
          @keyframes ev-pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.4; transform: scale(0.7); }
          }
        `}</style>
      </div>
    </div>
  )
}
