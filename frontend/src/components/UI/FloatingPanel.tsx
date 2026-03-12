import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { RoutePanel } from './RoutePanel'
import { EVPanel } from './EVPanel'
import { ReportPanel } from './ReportPanel'
import { AlertsPanel } from './AlertsPanel'
import { LayersPanel } from './LayersPanel'
import { SettingsPanel } from './SettingsPanel'

export const FloatingPanel: React.FC = () => {
  const { activePanel, setActivePanel } = useUIStore()

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
        className="absolute inset-0 z-[900] bg-black/20 backdrop-blur-xs"
        onClick={() => setActivePanel(null)}
      />

      {/* Panel */}
      <div className="absolute left-0 right-0 bottom-[72px] z-[950] mx-4 animate-slide-up">
        <div className="bg-tesla-panel/98 backdrop-blur-md border border-tesla-border rounded-3xl p-5 shadow-panel max-h-[70vh] overflow-y-auto">
          <button
            onClick={() => setActivePanel(null)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-tesla-muted hover:text-white transition-colors"
          >
            ✕
          </button>
          {panel}
        </div>
      </div>
    </>
  )
}
