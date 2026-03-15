import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { useT } from '../../i18n/useT'
import { EventType } from '../../types'

export const SettingsPanel: React.FC = () => {
  const { voiceEnabled, setVoiceEnabled, isDrivingMode, setDrivingMode, layers, toggleLayer } = useUIStore()
  const t = useT()

  const LAYER_LABELS: Record<string, string> = {
    police:       t('layerPolice'),
    speed_camera: t('layerCamera'),
    accident:     t('layerAccident'),
    traffic:      t('layerTraffic'),
    hazard:       t('layerHazard'),
    construction: t('layerConstruction'),
    ev_station:   t('layerEV'),
    risk_zones:   t('layerRisk'),
    road_closure: t('layerRoadClosure'),
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-white font-semibold text-lg">{t('settingsTitle')}</h2>

      <SettingRow
        label={t('voiceAlerts')}
        description={t('voiceAlertsDesc')}
        icon="🔊"
        value={voiceEnabled}
        onChange={setVoiceEnabled}
      />

      <SettingRow
        label={t('drivingMode')}
        description={t('drivingModeDesc')}
        icon="🚗"
        value={isDrivingMode}
        onChange={setDrivingMode}
      />

      {/* Event Layers */}
      <div className="pt-2 border-t border-tesla-border flex flex-col gap-2">
        <div className="text-tesla-muted text-xs uppercase tracking-wide">{t('eventLayers')}</div>
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id as EventType | 'risk_zones')}
            className="flex items-center justify-between py-3 px-3 rounded-2xl border border-tesla-border active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{layer.icon}</span>
              <span className="text-tesla-text font-medium">{LAYER_LABELS[layer.id] ?? layer.label}</span>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${layer.enabled ? 'bg-blue-500' : 'bg-tesla-border'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${layer.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </button>
        ))}
      </div>

      <div className="pt-2 border-t border-tesla-border">
        <div className="text-tesla-muted text-xs text-center">
          Tesla Intelligence v1.0.0
          <br />
          Data: Waze · OpenStreetMap · OSRM
        </div>
      </div>
    </div>
  )
}

const SettingRow: React.FC<{
  label: string; description: string; icon: string
  value: boolean; onChange: (v: boolean) => void
}> = ({ label, description, icon, value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    className="flex items-center justify-between py-3 px-3 rounded-2xl border border-tesla-border active:scale-[0.98] transition-all w-full text-left"
  >
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-tesla-text font-medium">{label}</div>
        <div className="text-tesla-muted text-xs">{description}</div>
      </div>
    </div>
    <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-blue-500' : 'bg-tesla-border'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </div>
  </button>
)
