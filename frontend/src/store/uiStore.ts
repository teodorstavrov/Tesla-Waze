import { create } from 'zustand'
import { PanelId, MapLayer, VoiceAlert, EventType } from '../types'
import { Lang } from '../i18n/translations'

interface UIState {
  activePanel: PanelId | null
  layers: MapLayer[]
  voiceAlerts: VoiceAlert[]
  voiceEnabled: boolean
  isDrivingMode: boolean
  showSpeedometer: boolean
  pendingAlerts: VoiceAlert[]
  mapStyle: 'light' | 'dark' | 'satellite'
  zoom: number
  language: Lang

  setActivePanel: (panel: PanelId | null) => void
  togglePanel: (panel: PanelId) => void
  toggleLayer: (id: EventType | 'risk_zones') => void
  addVoiceAlert: (alert: Omit<VoiceAlert, 'id' | 'spoken'>) => void
  markAlertSpoken: (id: string) => void
  setVoiceEnabled: (v: boolean) => void
  setDrivingMode: (v: boolean) => void
  setMapStyle: (s: UIState['mapStyle']) => void
  toggleDayNight: () => void
  setZoom: (z: number) => void
  setLanguage: (l: Lang) => void
}

const defaultLayers: MapLayer[] = [
  { id: 'police',       label: 'Police',          icon: '🚔', enabled: true,  color: '#EF4444' },
  { id: 'speed_camera', label: 'Speed Cameras',   icon: '📷', enabled: true,  color: '#F59E0B' },
  { id: 'accident',     label: 'Accidents',        icon: '💥', enabled: true,  color: '#F97316' },
  { id: 'traffic',      label: 'Traffic',          icon: '🚦', enabled: true,  color: '#8B5CF6' },
  { id: 'hazard',       label: 'Hazards',          icon: '⚠️', enabled: true,  color: '#EAB308' },
  { id: 'ev_station',   label: 'EV Charging',      icon: '⚡', enabled: true,  color: '#22C55E' },
]

export const useUIStore = create<UIState>((set, get) => ({
  activePanel: null,
  layers: defaultLayers,
  voiceAlerts: [],
  voiceEnabled: true,
  isDrivingMode: true,
  showSpeedometer: true,
  pendingAlerts: [],
  mapStyle: 'light',
  zoom: 16,
  language: 'en',

  setActivePanel: (activePanel) => set({ activePanel }),

  togglePanel: (panel) => set(s => ({
    activePanel: s.activePanel === panel ? null : panel
  })),

  toggleLayer: (id) => set(s => ({
    layers: s.layers.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l)
  })),

  addVoiceAlert: (alert) => {
    const newAlert: VoiceAlert = {
      ...alert,
      id: `alert-${Date.now()}`,
      spoken: false
    }
    set(s => ({
      voiceAlerts: [newAlert, ...s.voiceAlerts].slice(0, 20),
      pendingAlerts: s.voiceEnabled ? [...s.pendingAlerts, newAlert] : s.pendingAlerts
    }))
  },

  markAlertSpoken: (id) => set(s => ({
    voiceAlerts: s.voiceAlerts.map(a => a.id === id ? { ...a, spoken: true } : a),
    pendingAlerts: s.pendingAlerts.filter(a => a.id !== id)
  })),

  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setDrivingMode: (isDrivingMode) => set({ isDrivingMode }),
  setMapStyle: (mapStyle) => set({ mapStyle }),
  toggleDayNight: () => set(s => ({ mapStyle: s.mapStyle === 'dark' ? 'light' : 'dark' })),
  setZoom: (zoom) => set({ zoom }),
  setLanguage: (language) => set({ language }),
}))
