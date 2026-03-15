import React, { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { MapView } from './components/Map/MapContainer'
import { EVStatsCard } from './components/Map/EVStatsCard'
import { TopBar } from './components/UI/TopBar'
import { BottomNav } from './components/UI/BottomNav'
import { FloatingPanel } from './components/UI/FloatingPanel'
import { NearbyReportPrompt } from './components/UI/NearbyReportPrompt'
import { EVRouteInfoBar } from './components/UI/EVRouteInfoBar'
import { LoadingBar } from './components/UI/LoadingBar'
import { useGeolocation } from './hooks/useGeolocation'
import { useWebSocket } from './hooks/useWebSocket'
import { useVoiceAlerts } from './hooks/useVoiceAlerts'
import { useDataPolling } from './hooks/useDataPolling'
import { useEventsStore } from './store/eventsStore'
import { useUIStore } from './store/uiStore'
import { useT } from './i18n/useT'

const BG = { north: 44.2, south: 41.2, east: 28.6, west: 22.4 }
function inBulgaria(lat: number, lng: number) {
  return lat >= BG.south && lat <= BG.north && lng >= BG.west && lng <= BG.east
}

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
  const userPosition = useEventsStore(s => s.userPosition)
  const { language, setLanguage } = useUIStore()
  const langSet = React.useRef(false)

  // Auto-set Bulgarian if user is in Bulgaria (runs once on first GPS fix)
  useEffect(() => {
    if (langSet.current || !userPosition) return
    langSet.current = true
    if (inBulgaria(userPosition.lat, userPosition.lng)) {
      setLanguage('bg')
    }
  }, [userPosition, setLanguage])

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
      <LoadingBar />
      <TopBar />
      <ConnectionBadge />
      <FloatingPanel />
      <NearbyReportPrompt />
      <EVStatsCard />
      <EVRouteInfoBar />
      <BottomNav />
      <Analytics />
    </div>
  )
}

export default App
