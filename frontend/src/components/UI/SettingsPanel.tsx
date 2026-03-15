import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { useT } from '../../i18n/useT'

export const SettingsPanel: React.FC = () => {
  const { voiceEnabled, setVoiceEnabled, isDrivingMode, setDrivingMode } = useUIStore()
  const t = useT()

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
