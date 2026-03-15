export type Lang = 'en' | 'bg'

const t = {
  // ── TopBar ─────────────────────────────────────────────────────────────────
  toDayMode:        { en: 'Switch to day mode',   bg: 'Дневен режим' },
  toNightMode:      { en: 'Switch to night mode', bg: 'Нощен режим' },
  eta:              { en: 'ETA',    bg: 'ВПП' },
  dist:             { en: 'DIST',   bg: 'РЗТ' },
  risk:             { en: 'RISK',   bg: 'РИСК' },
  connectionError:  { en: '⚠️ Connection error', bg: '⚠️ Грешка в връзката' },

  // ── BottomNav ──────────────────────────────────────────────────────────────
  navCharging:  { en: 'Charging',  bg: 'Зареждане' },
  navReport:    { en: 'Report',    bg: 'Сигнал' },
  navSettings:  { en: 'Settings',  bg: 'Настройки' },

  // ── LayersPanel ────────────────────────────────────────────────────────────
  mapLayers:    { en: '🗺️ Map Layers',   bg: '🗺️ Слоеве' },
  mapStyle:     { en: 'Map Style',       bg: 'Стил на картата' },
  styleDay:     { en: '☀️ Day',          bg: '☀️ Ден' },
  styleNight:   { en: '🌙 Night',        bg: '🌙 Нощ' },
  styleSat:     { en: '🛰️ Satellite',    bg: '🛰️ Сателит' },
  eventLayers:  { en: 'Event Layers',    bg: 'Слоеве със събития' },
  layerPolice:       { en: 'Police',        bg: 'Полиция' },
  layerCamera:       { en: 'Speed Cameras', bg: 'Камери' },
  layerAccident:     { en: 'Accidents',     bg: 'Катастрофи' },
  layerTraffic:      { en: 'Traffic',       bg: 'Трафик' },
  layerHazard:       { en: 'Hazards',       bg: 'Опасности' },
  layerConstruction: { en: 'Construction',  bg: 'Строителство' },
  layerEV:           { en: 'EV Charging',   bg: 'Зарядни' },
  layerRisk:         { en: 'Risk Zones',    bg: 'Рискови зони' },
  layerRoadClosure:  { en: 'Road Closures', bg: 'Затворени пътища' },

  // ── ReportPanel ────────────────────────────────────────────────────────────
  reportTitle:      { en: '📍 Report Incident',                bg: '📍 Докладвай събитие' },
  reportPolice:     { en: 'Police',                            bg: 'Полиция' },
  reportCamera:     { en: 'Camera',                            bg: 'Камера' },
  reportAccident:   { en: 'Accident',                          bg: 'Катастрофа' },
  reportHazard:     { en: 'Hazard',                            bg: 'Опасност' },
  waitingGPS:       { en: '📡 Waiting for GPS location…',     bg: '📡 Изчакване на GPS…' },
  reportSubmitted:  { en: '✓ Report submitted — thank you!',  bg: '✓ Докладвано — благодаря!' },
  reportDisclaimer: { en: 'Reports are validated by community voting and expire after 2 hours', bg: 'Сигналите се потвърждават от общността' },

  // ── NearbyReportPrompt ─────────────────────────────────────────────────────
  isStillHere:  { en: 'Is this still here?', bg: 'Все още ли е тук?' },
  stillThere:   { en: '✓ Still there',       bg: '✓ Все още е' },
  remove:       { en: '✕ Remove',            bg: '✕ Премахни' },

  // ── SettingsPanel ──────────────────────────────────────────────────────────
  settingsTitle:        { en: '⚙️ Settings',                        bg: '⚙️ Настройки' },
  voiceAlerts:          { en: 'Voice Alerts',                       bg: 'Гласови сигнали' },
  voiceAlertsDesc:      { en: 'Announce events as you approach',    bg: 'Обявяване при приближаване' },
  drivingMode:          { en: 'Driving Mode',                       bg: 'Режим шофиране' },
  drivingModeDesc:      { en: 'Minimize distractions while driving', bg: 'Минимизира разсейванията' },

  // ── EVPanel ────────────────────────────────────────────────────────────────
  evTitle:          { en: '⚡ EV Charging',                    bg: '⚡ Зареждане' },
  evAvailable:      { en: 'available',                         bg: 'свободни' },
  evWaitingGPS:     { en: '📡 Waiting for GPS…',              bg: '📡 Изчакване на GPS…' },
  evNoneNearby:     { en: 'No charging stations found nearby', bg: 'Няма зарядни наблизо' },
  evPorts:          { en: 'ports',                             bg: 'порта' },
  evAway:           { en: 'away',                              bg: 'разст.' },
  evMinPower:       { en: 'Min power',                        bg: 'Мин. мощност' },
  evAll:            { en: 'All',                              bg: 'Всички' },
  evBrand:          { en: 'Brand',                           bg: 'Оператор' },
  evPower:          { en: 'Power',                           bg: 'Мощност' },
  evDist:           { en: 'Distance',                        bg: 'Разстояние' },

  // ── Voice alert messages ───────────────────────────────────────────────────
  voicePolice:      { en: 'Police reported {dist} meters ahead', bg: 'Полиция {dist} метра напред' },
  voiceCamera:      { en: 'Speed camera ahead in {dist} meters', bg: 'Камера {dist} метра напред' },
  voiceAccident:    { en: 'Accident ahead — reduce speed',       bg: 'Катастрофа напред — намали скоростта' },
  voiceHazard:      { en: 'Road hazard ahead — drive carefully', bg: 'Опасност на пътя — внимавай' },
  voiceConstruct:   { en: 'Construction zone ahead',             bg: 'Строителна зона напред' },
  voiceClosure:     { en: 'Road closure ahead',                  bg: 'Затворен път напред' },
  voiceSpeedWarn:   { en: 'Warning: Speed limit is {speed} km/h', bg: 'Внимание: ограничение {speed} км/ч' },

  // ── LoadingBar ─────────────────────────────────────────────────────────────
  loadingSignals:   { en: 'Loading signals…', bg: 'Зареждане на сигнали…' },
} as const

export type TKey = keyof typeof t

export function getT(lang: Lang) {
  return (key: TKey, vars?: Record<string, string | number>): string => {
    let str: string = t[key][lang]
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v))
      })
    }
    return str
  }
}
