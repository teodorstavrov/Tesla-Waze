import { useEffect, useRef } from 'react'
import { useEventsStore } from '../store/eventsStore'
import { useUIStore } from '../store/uiStore'
import { TrafficEvent } from '../types'

const ALERT_DISTANCES: Record<string, number> = {
  police: 800,
  speed_camera: 500,
  accident: 400,
  hazard: 300,
  construction: 300,
  road_closure: 200,
}

const ALERT_MESSAGES: Record<string, (e: TrafficEvent) => string> = {
  police: (e) => `Police reported ${e.distance ? Math.round(e.distance) + ' meters' : ''} ahead`,
  speed_camera: (e) => `Speed camera ${e.speed ? 'limit ' + e.speed + ' km/h ' : ''}ahead in ${e.distance ? Math.round(e.distance) + ' meters' : ''}`,
  accident: () => 'Accident ahead — reduce speed',
  hazard: () => 'Road hazard ahead — drive carefully',
  construction: () => 'Construction zone ahead',
  road_closure: () => 'Road closure ahead',
}

export function useVoiceAlerts() {
  const alerted = useRef<Set<string>>(new Set())
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const { nearbyEvents, userSpeed } = useEventsStore()
  const { voiceEnabled, addVoiceAlert, pendingAlerts, markAlertSpoken } = useUIStore()

  // Init speech synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  // Process pending alerts
  useEffect(() => {
    if (!voiceEnabled || !synthRef.current) return
    const pending = pendingAlerts.filter(a => !a.spoken)
    if (pending.length === 0) return

    pending.forEach(alert => {
      const utt = new SpeechSynthesisUtterance(alert.message)
      utt.rate = 1.1
      utt.pitch = 1.0
      utt.volume = 1.0
      utt.lang = 'en-US'
      utt.onend = () => markAlertSpoken(alert.id)
      synthRef.current!.speak(utt)
    })
  }, [pendingAlerts, voiceEnabled, markAlertSpoken])

  // Detect approaching events
  useEffect(() => {
    if (!voiceEnabled) return

    nearbyEvents.forEach(event => {
      const threshold = ALERT_DISTANCES[event.type]
      if (!threshold) return
      if ((event.distance ?? Infinity) > threshold) return
      if (alerted.current.has(event.id)) return

      alerted.current.add(event.id)

      const messageFn = ALERT_MESSAGES[event.type]
      if (!messageFn) return

      addVoiceAlert({
        message: messageFn(event),
        priority: event.type === 'police' || event.type === 'speed_camera' ? 'high' : 'medium',
        triggeredAt: Date.now()
      })
    })
  }, [nearbyEvents, voiceEnabled, addVoiceAlert])

  // Speed warning (if over limit near camera)
  useEffect(() => {
    const { nearbyEvents: events } = useEventsStore.getState()
    const camera = events.find(e => e.type === 'speed_camera' && (e.distance ?? Infinity) < 300)
    if (!camera || !camera.speed) return
    if (userSpeed > camera.speed + 5) {
      addVoiceAlert({
        message: `Warning: Speed limit is ${camera.speed} km/h`,
        priority: 'critical',
        triggeredAt: Date.now()
      })
    }
  }, [userSpeed, addVoiceAlert])
}
