import React, { useState } from 'react'
import { useEventsStore } from '../../store/eventsStore'
import { useUIStore } from '../../store/uiStore'
import { submitReport } from '../../services/api'
import { useT } from '../../i18n/useT'
import { TrafficEvent, UserReport } from '../../types'

export const ReportPanel: React.FC = () => {
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const { userPosition, addEvent } = useEventsStore()
  const { addVoiceAlert }          = useUIStore()
  const t = useT()

  const REPORT_TYPES: Array<{ type: UserReport['type']; icon: string; label: string; color: string }> = [
    { type: 'police',       icon: '🚔', label: t('reportPolice'),   color: 'border-red-500/50 bg-red-900/20 active:bg-red-900/40' },
    { type: 'speed_camera', icon: '📷', label: t('reportCamera'),   color: 'border-yellow-500/50 bg-yellow-900/20 active:bg-yellow-900/40' },
    { type: 'accident',     icon: '💥', label: t('reportAccident'), color: 'border-orange-500/50 bg-orange-900/20 active:bg-orange-900/40' },
    { type: 'hazard',       icon: '⚠️', label: t('reportHazard'),   color: 'border-yellow-500/50 bg-yellow-900/20 active:bg-yellow-900/40' },
  ]

  const handleReport = async (type: UserReport['type'], label: string) => {
    if (!userPosition || loading) return
    setLoading(true)
    try {
      const serverReport = await submitReport(type, userPosition)
      const localEvent: TrafficEvent = {
        id:          `report-${serverReport.id}`,
        type:        type as TrafficEvent['type'],
        position:    userPosition,
        title:       label,
        severity:    3,
        confidence:  70,
        votes:       1,
        source:      'user_report',
        reportedAt:  serverReport.createdAt ?? new Date().toISOString(),
        expiresAt:   serverReport.expiresAt  ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      }
      addEvent(localEvent)
      setSubmitted(type)
      addVoiceAlert({ message: `${label} reported. Thank you!`, priority: 'low', triggeredAt: Date.now() })
      setTimeout(() => setSubmitted(null), 3000)
    } catch (err) {
      console.error('Report failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-white font-semibold text-lg">{t('reportTitle')}</h2>

      {!userPosition && (
        <div className="text-tesla-muted text-sm text-center py-4">{t('waitingGPS')}</div>
      )}

      {submitted && (
        <div className="bg-green-900/30 border border-green-500/50 rounded-2xl px-4 py-3 text-green-400 text-sm text-center animate-fade-in">
          {t('reportSubmitted')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {REPORT_TYPES.map(({ type, icon, label, color }) => (
          <button
            key={type}
            onClick={() => handleReport(type, label)}
            disabled={!userPosition || loading}
            className={`flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all active:scale-95 disabled:opacity-40 ${color}`}
          >
            <span className="text-4xl">{icon}</span>
            <span className="text-tesla-text font-medium text-base">{label}</span>
          </button>
        ))}
      </div>

      <p className="text-tesla-muted text-xs text-center">{t('reportDisclaimer')}</p>
    </div>
  )
}
