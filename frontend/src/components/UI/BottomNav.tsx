import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { useRouteStore } from '../../store/routeStore'
import { PanelId } from '../../types'

interface NavItem {
  id: PanelId
  icon: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'route',    icon: '🧭', label: 'Navigate' },
  { id: 'ev',       icon: '⚡', label: 'Charging' },
  { id: 'report',   icon: '📍', label: 'Report' },
  { id: 'alerts',   icon: '🔔', label: 'Alerts' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

export const BottomNav: React.FC = () => {
  const { activePanel, togglePanel } = useUIStore()
  const { isNavigating, clearRoute } = useRouteStore()

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] flex items-center justify-around px-2 pb-safe pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg mx-auto flex items-center gap-1 bg-tesla-panel/95 backdrop-blur-md border border-tesla-border rounded-t-3xl px-3 pt-3 pb-4 shadow-panel">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => togglePanel(item.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-2xl transition-all active:scale-95
              ${activePanel === item.id
                ? 'bg-tesla-accent/20 text-blue-400'
                : 'text-tesla-muted hover:text-tesla-text'
              }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
        {isNavigating && (
          <button
            onClick={clearRoute}
            className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-2xl text-red-400 active:scale-95 transition-all"
          >
            <span className="text-xl">✖</span>
            <span className="text-xs font-medium">End</span>
          </button>
        )}
      </div>
    </div>
  )
}
