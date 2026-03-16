import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { RoutePanel } from './RoutePanel'
import { EVPanel } from './EVPanel'
import { ReportPanel } from './ReportPanel'
import { AlertsPanel } from './AlertsPanel'
import { LayersPanel } from './LayersPanel'
import { SettingsPanel } from './SettingsPanel'

export const FloatingPanel: React.FC = () => {
  const { activePanel, setActivePanel, mapStyle } = useUIStore()
  const isDay = mapStyle === 'light'

  if (!activePanel) return null

  const panels: Record<string, React.ReactNode> = {
    route:    <RoutePanel />,
    ev:       <EVPanel />,
    report:   <ReportPanel />,
    alerts:   <AlertsPanel />,
    layers:   <LayersPanel />,
    settings: <SettingsPanel />,
  }

  const panel = panels[activePanel]
  if (!panel) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-[900]"
        onClick={() => setActivePanel(null)}
      />

      {/* Panel — same width as BottomNav */}
      <div className="absolute left-0 right-0 bottom-[72px] z-[950] px-2 animate-slide-up">
        <div
          data-day={isDay ? 'true' : undefined}
          className="max-w-lg mx-auto backdrop-blur-md rounded-3xl p-5 shadow-panel max-h-[70vh] overflow-y-auto"
          style={isDay
            ? { background: 'rgba(248,248,248,0.98)', border: '1px solid rgba(0,0,0,0.12)' }
            : { background: 'rgba(17,17,17,0.98)',   border: '1px solid #1f1f1f' }
          }
        >
          <button
            onClick={() => setActivePanel(null)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-colors"
            style={{ color: isDay ? '#555' : '#6b7280' }}
          >
            ✕
          </button>
          {panel}
        </div>
      </div>
    </>
  )
}
