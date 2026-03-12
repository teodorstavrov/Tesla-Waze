import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { useEventsStore } from '../../store/eventsStore'
import { VoiceAlert } from '../../types'
import { formatDistanceToNow } from 'date-fns'

const PRIORITY_STYLES: Record<VoiceAlert['priority'], string> = {
  critical: 'border-red-500/60 bg-red-900/20 text-red-300',
  high:     'border-orange-500/40 bg-orange-900/15 text-orange-300',
  medium:   'border-yellow-500/30 bg-yellow-900/10 text-yellow-300',
  low:      'border-tesla-border bg-black/20 text-tesla-muted',
}

export const AlertsPanel: React.FC = () => {
  const { voiceAlerts, voiceEnabled, setVoiceEnabled } = useUIStore()
  const { nearbyEvents, nextPolice, nextCamera } = useEventsStore()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">🔔 Alerts</h2>
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className={`flex items-center gap-2 text-sm rounded-xl px-3 py-1.5 border transition-all
            ${voiceEnabled
              ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
              : 'bg-black/20 border-tesla-border text-tesla-muted'
            }`}
        >
          {voiceEnabled ? '🔊 Voice On' : '🔇 Voice Off'}
        </button>
      </div>

      {/* Active threats */}
      {(nextPolice || nextCamera) && (
        <div className="flex flex-col gap-2">
          <div className="text-tesla-muted text-xs uppercase tracking-wide">Active Threats</div>
          {nextPolice && (
            <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/40 rounded-2xl px-4 py-3">
              <span className="text-2xl">🚔</span>
              <div>
                <div className="text-red-300 font-semibold">Police Ahead</div>
                <div className="text-red-400/70 text-sm">
                  {nextPolice.distance ? `${Math.round(nextPolice.distance)}m` : 'nearby'}
                  {' · '}Confidence {nextPolice.confidence}%
                </div>
              </div>
            </div>
          )}
          {nextCamera && (
            <div className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-500/40 rounded-2xl px-4 py-3">
              <span className="text-2xl">📷</span>
              <div>
                <div className="text-yellow-300 font-semibold">
                  Speed Camera {nextCamera.speed ? `· ${nextCamera.speed} km/h` : ''}
                </div>
                <div className="text-yellow-400/70 text-sm">
                  {nextCamera.distance ? `${Math.round(nextCamera.distance)}m away` : 'nearby'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nearby events summary */}
      {nearbyEvents.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-tesla-muted text-xs uppercase tracking-wide">
            Nearby ({nearbyEvents.length})
          </div>
          {nearbyEvents.slice(0, 5).map(event => (
            <div
              key={event.id}
              className="flex items-center gap-2 text-sm text-tesla-text py-1.5 border-b border-tesla-border/30 last:border-0"
            >
              <span>{event.type === 'police' ? '🚔' : event.type === 'speed_camera' ? '📷' : event.type === 'accident' ? '💥' : '⚠️'}</span>
              <span className="flex-1 truncate">{event.title}</span>
              <span className="text-tesla-muted text-xs">{event.distance ? `${Math.round(event.distance)}m` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Alert history */}
      {voiceAlerts.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-tesla-muted text-xs uppercase tracking-wide">History</div>
          {voiceAlerts.slice(0, 8).map(alert => (
            <div
              key={alert.id}
              className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border text-sm ${PRIORITY_STYLES[alert.priority]}`}
            >
              <span className="text-base flex-shrink-0">
                {alert.priority === 'critical' ? '🚨' : alert.priority === 'high' ? '⚠️' : '🔔'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate">{alert.message}</div>
                <div className="text-xs opacity-60">
                  {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {voiceAlerts.length === 0 && nearbyEvents.length === 0 && (
        <div className="text-center py-6 text-tesla-muted">
          <div className="text-3xl mb-2">✅</div>
          <div>All clear — no alerts</div>
        </div>
      )}
    </div>
  )
}
