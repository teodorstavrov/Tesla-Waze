import React, { useEffect, useRef, useState } from 'react'
import { useEventsStore } from '../../store/eventsStore'
import { deleteReport } from '../../services/api'
import { useT } from '../../i18n/useT'
import { TrafficEvent } from '../../types'

const PROXIMITY_METERS = 5
const DISMISS_SECONDS  = 10

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const x  = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

const ICONS: Record<string, string> = {
  police: '👮', accident: '💥', hazard: '⚠️', speed_camera: '📷',
}

export const NearbyReportPrompt: React.FC = () => {
  const { userPosition, events, removeEvent } = useEventsStore()
  const [active, setActive]   = useState<TrafficEvent | null>(null)
  const [countdown, setCount] = useState(DISMISS_SECONDS)
  const shownIds              = useRef<Set<string>>(new Set())
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)
  const t = useT()

  useEffect(() => {
    if (!userPosition || active) return
    const nearest = events
      .filter(e =>
        e.source === 'user_report' &&
        !shownIds.current.has(e.id) &&
        distanceMeters(userPosition, e.position) <= PROXIMITY_METERS
      )
      .sort((a, b) =>
        distanceMeters(userPosition, a.position) - distanceMeters(userPosition, b.position)
      )[0]

    if (nearest) {
      shownIds.current.add(nearest.id)
      setActive(nearest)
      setCount(DISMISS_SECONDS)
    }
  }, [userPosition, events, active])

  useEffect(() => {
    if (!active) return
    timerRef.current = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setActive(null)
          return DISMISS_SECONDS
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [active])

  const handleRemove = async () => {
    if (!active) return
    clearInterval(timerRef.current!)
    removeEvent(active.id)
    const serverId = active.id.replace(/^report-/, '')
    try { await deleteReport(serverId) } catch { /* best effort */ }
    setActive(null)
  }

  const handleKeep = () => {
    clearInterval(timerRef.current!)
    setActive(null)
  }

  if (!active) return null

  return (
    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[2000] w-[min(400px,90vw)] animate-fade-in">
      <div className="bg-gray-900/95 border border-white/20 rounded-2xl p-4 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{ICONS[active.type] ?? '📍'}</span>
          <div>
            <div className="text-white font-semibold text-base">{active.title}</div>
            <div className="text-gray-400 text-sm">{t('isStillHere')}</div>
          </div>
          <div className="ml-auto text-center">
            <div className="text-2xl font-bold text-yellow-400">{countdown}</div>
            <div className="text-gray-500 text-xs">sec</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleKeep}
            className="py-3 rounded-xl bg-green-800/60 border border-green-500/40 text-green-300 font-semibold text-base active:scale-95 transition-transform"
          >
            {t('stillThere')}
          </button>
          <button
            onClick={handleRemove}
            className="py-3 rounded-xl bg-red-800/60 border border-red-500/40 text-red-300 font-semibold text-base active:scale-95 transition-transform"
          >
            {t('remove')}
          </button>
        </div>
      </div>
    </div>
  )
}
