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
  police:       (e) => `Police reported ${e.distance ? Math.round(e.distance) + ' meters' : ''} ahead`,
  speed_camera: (e) => `Speed camera ${e.speed ? 'limit ' + e.speed + ' km/h ' : ''}ahead in ${e.distance ? Math.round(e.distance) + ' meters' : ''}`,
  accident:     () => 'Accident ahead — reduce speed',
  hazard:       () => 'Road hazard ahead — drive carefully',
  construction: () => 'Construction zone ahead',
  road_closure: () => 'Road closure ahead',
}

// ─── Police pre-alert: siren + screen flash ───────────────────────────────────
function playSiren() {
  try {
    const ctx  = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sawtooth'

    // Hi-lo police siren pattern
    const t = ctx.currentTime
    osc.frequency.setValueAtTime(960, t)
    osc.frequency.setValueAtTime(770, t + 0.4)
    osc.frequency.setValueAtTime(960, t + 0.8)
    osc.frequency.setValueAtTime(770, t + 1.2)
    osc.frequency.setValueAtTime(960, t + 1.6)

    gain.gain.setValueAtTime(0.15, t)
    gain.gain.linearRampToValueAtTime(0, t + 1.9)

    osc.start(t)
    osc.stop(t + 2)
    osc.onended = () => ctx.close()
  } catch {
    // AudioContext not available (e.g. no user gesture yet)
  }
}

function flashScreen() {
  // Inject keyframes once
  if (!document.getElementById('police-flash-style')) {
    const style = document.createElement('style')
    style.id = 'police-flash-style'
    style.textContent = `
      @keyframes police-flash {
        0%   { background: rgba(59,130,246,0.45); }
        20%  { background: rgba(239,68,68,0.45);  }
        40%  { background: rgba(59,130,246,0.35); }
        60%  { background: rgba(239,68,68,0.30);  }
        80%  { background: rgba(59,130,246,0.15); }
        100% { background: transparent; }
      }
      .police-flash-overlay {
        position: fixed; inset: 0; z-index: 9999;
        pointer-events: none;
        animation: police-flash 1.8s ease-out forwards;
      }
    `
    document.head.appendChild(style)
  }

  const overlay = document.createElement('div')
  overlay.className = 'police-flash-overlay'
  document.body.appendChild(overlay)
  overlay.addEventListener('animationend', () => overlay.remove())
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useVoiceAlerts() {
  const alerted  = useRef<Set<string>>(new Set())
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const { nearbyEvents, userSpeed } = useEventsStore()
  const { voiceEnabled, addVoiceAlert, pendingAlerts, markAlertSpoken } = useUIStore()

  // Init speech synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) synthRef.current = window.speechSynthesis
  }, [])

  // Process pending alerts
  useEffect(() => {
    if (!voiceEnabled || !synthRef.current) return
    const pending = pendingAlerts.filter(a => !a.spoken)
    if (pending.length === 0) return

    pending.forEach(alert => {
      const utt = new SpeechSynthesisUtterance(alert.message)
      utt.rate   = 1.1
      utt.pitch  = 1.0
      utt.volume = 1.0
      utt.lang   = 'en-US'
      utt.onend  = () => markAlertSpoken(alert.id)
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

      if (event.type === 'police') {
        // Siren + flash 2 seconds before voice
        playSiren()
        flashScreen()
        setTimeout(() => {
          addVoiceAlert({
            message: messageFn(event),
            priority: 'high',
            triggeredAt: Date.now(),
          })
        }, 2000)
      } else {
        addVoiceAlert({
          message: messageFn(event),
          priority: event.type === 'speed_camera' ? 'high' : 'medium',
          triggeredAt: Date.now(),
        })
      }
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
        triggeredAt: Date.now(),
      })
    }
  }, [userSpeed, addVoiceAlert])
}
