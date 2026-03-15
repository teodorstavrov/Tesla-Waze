import React, { useEffect } from 'react'
import { MapView } from './components/Map/MapContainer'
import { TopBar } from './components/UI/TopBar'
import { BottomNav } from './components/UI/BottomNav'
import { FloatingPanel } from './components/UI/FloatingPanel'
import { NearbyReportPrompt } from './components/UI/NearbyReportPrompt'
import { useGeolocation } from './hooks/useGeolocation'
import { useWebSocket } from './hooks/useWebSocket'
import { useVoiceAlerts } from './hooks/useVoiceAlerts'
import { useDataPolling } from './hooks/useDataPolling'
import { useEventsStore } from './store/eventsStore'
import { useT } from './i18n/useT'

// Connection status indicator
const ConnectionBadge: React.FC = () => {
  const error = useEventsStore(s => s.error)
  const t = useT()

  if (error) {
    return (
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/80 border border-red-500/50 rounded-xl px-3 py-1.5 text-red-300 text-xs">
        {t('connectionError')}
      </div>
    )
  }

  return null
}

const App: React.FC = () => {
  // Core hooks
  useGeolocation({ enableHighAccuracy: true })
  useWebSocket()
  useVoiceAlerts()
  useDataPolling()

  // Prevent screen sleep on Tesla browser
  useEffect(() => {
    const preventSleep = async () => {
      try {
        if ('wakeLock' in navigator) {
          await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<unknown> } }).wakeLock.request('screen')
        }
      } catch {
        // WakeLock not available
      }
    }
    preventSleep()
  }, [])

  return (
    <div className="relative w-full h-full bg-tesla-dark overflow-hidden">
      {/* Full-screen map */}
      <MapView className="absolute inset-0" />

      {/* HUD overlays */}
      <TopBar />
      <ConnectionBadge />
      <FloatingPanel />
      <NearbyReportPrompt />
      <BottomNav />
    </div>
  )
}

export default App
