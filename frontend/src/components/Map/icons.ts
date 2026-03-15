import L from 'leaflet'

// Fix default icon path issue with Vite
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const svgIcon = (emoji: string, color: string, size = 36) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" opacity="0.92" stroke="#fff" stroke-width="2"/>
      <text x="50%" y="55%" font-size="${size * 0.5}px" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}

export const EventIcons: Record<string, L.DivIcon> = {
  police:       svgIcon('👮', '#3B82F6'),
  speed_camera: svgIcon('📷', '#F59E0B'),
  accident:     svgIcon('💥', '#F97316'),
  traffic:      svgIcon('🚦', '#8B5CF6'),
  hazard:       svgIcon('⚠️', '#EAB308'),
  construction: svgIcon('🚧', '#F97316'),
  ev_station:   svgIcon('⚡', '#22C55E'),
  road_closure: svgIcon('🚫', '#DC2626'),
}

export const UserArrowIcon = (heading: number) => L.divIcon({
  html: `
    <style>
      @keyframes user-pulse {
        0%   { r: 22; opacity: 0.5; }
        100% { r: 38; opacity: 0;   }
      }
      .user-pulse { animation: user-pulse 1.6s ease-out infinite; }
    </style>
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <!-- Pulsing ring -->
      <circle class="user-pulse" cx="40" cy="40" r="22" fill="none" stroke="#3B82F6" stroke-width="2"/>
      <g transform="rotate(${heading}, 40, 40)">
        <!-- Accuracy halo -->
        <circle cx="40" cy="40" r="22" fill="#3B82F6" opacity="0.12"/>
        <!-- Navigation arrow pointing up (north = 0°) -->
        <polygon points="40,18 52,54 40,46 28,54"
          fill="#3B82F6" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
        <!-- Center dot -->
        <circle cx="40" cy="40" r="3.5" fill="#fff" opacity="0.95"/>
      </g>
    </svg>`,
  className: '',
  iconSize: [80, 80],
  iconAnchor: [40, 40],
})

export const EVIcon = (available: number, total: number) => {
  const pct = total > 0 ? available / total : 0
  const color = pct > 0.5 ? '#22C55E' : pct > 0.2 ? '#F59E0B' : '#EF4444'
  return svgIcon('⚡', color, 32)
}
