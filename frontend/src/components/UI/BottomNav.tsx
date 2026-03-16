import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { useRouteStore } from '../../store/routeStore'
import { useT } from '../../i18n/useT'
import { PanelId } from '../../types'

// Bulgarian flag: white / green / red horizontal stripes
const BG_FLAG_GRADIENT = 'linear-gradient(to bottom, rgba(255,255,255,0.28) 33.3%, rgba(0,150,57,0.32) 33.3%, rgba(0,150,57,0.32) 66.6%, rgba(214,38,18,0.32) 66.6%)'

// Text shadow for readability on top of the flag
const TEXT_SHADOW = '0 1px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)'

export const BottomNav: React.FC = () => {
  const { activePanel, togglePanel, language } = useUIStore()
  const { isNavigating, clearRoute } = useRouteStore()
  const t = useT()
  const isBg = language === 'bg'

  const NAV_ITEMS: { id: PanelId; icon: string; label: string }[] = [
    { id: 'ev',       icon: '⚡', label: t('navCharging') },
    { id: 'report',   icon: '📍', label: t('navReport')   },
    { id: 'settings', icon: '⚙️', label: t('navSettings') },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] flex items-center justify-around px-2 pb-safe pointer-events-none">
      <div className="relative pointer-events-auto w-full max-w-lg mx-auto flex items-center gap-1 bg-tesla-panel/70 backdrop-blur-md border border-tesla-border rounded-t-3xl px-3 pt-3 pb-4 shadow-panel" style={{ opacity: 0.7 }}>
        {/* Bulgarian flag overlay — opacity-only transition for GPU compositing */}
        <div
          className="absolute inset-0 rounded-t-3xl pointer-events-none transition-opacity duration-500"
          style={{ background: BG_FLAG_GRADIENT, opacity: isBg ? 1 : 0 }}
        />
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => togglePanel(item.id)}
            className={`relative flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-2xl transition-all active:scale-95
              ${activePanel === item.id
                ? 'bg-tesla-accent/20 text-blue-400'
                : 'text-white'
              }`}
            style={isBg ? { textShadow: TEXT_SHADOW } : undefined}
          >
            <span className="text-xl" style={isBg ? { filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' } : undefined}>{item.icon}</span>
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
