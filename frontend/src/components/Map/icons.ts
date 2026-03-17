import L from 'leaflet'

// Fix default icon path issue with Vite
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Pure SVG paths — no emoji, works in all browsers including Tesla WebKit
const SVG_PATHS: Record<string, string> = {
  // Police — shield
  police: '<path fill="#fff" d="M18 4 L28 8 L28 18 C28 24 23 29 18 31 C13 29 8 24 8 18 L8 8 Z" opacity="0.9"/><path fill="#3B82F6" d="M18 8 L24 11 L24 18 C24 22 21 26 18 27 C15 26 12 22 12 18 L12 11 Z"/>',
  // Speed camera — lens circle
  speed_camera: '<circle cx="18" cy="18" r="8" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="18" r="3" fill="#fff"/><rect x="10" y="13" width="4" height="3" rx="1" fill="#fff" opacity="0.7"/>',
  // Accident — exclamation triangle
  accident: '<polygon points="18,7 30,28 6,28" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><rect x="17" y="14" width="2" height="8" rx="1" fill="#fff"/><circle cx="18" cy="25" r="1.5" fill="#fff"/>',
  // Traffic — horizontal bars
  traffic: '<circle cx="18" cy="11" r="3.5" fill="#EF4444"/><circle cx="18" cy="18" r="3.5" fill="#F59E0B"/><circle cx="18" cy="25" r="3.5" fill="#22C55E"/>',
  // Hazard — warning triangle
  hazard: '<polygon points="18,8 29,27 7,27" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><rect x="17" y="14" width="2" height="7" rx="1" fill="#fff"/><circle cx="18" cy="24" r="1.5" fill="#fff"/>',
  // Construction — diagonal stripes
  construction: '<rect x="8" y="16" width="20" height="4" rx="2" fill="#fff" opacity="0.9"/><rect x="8" y="16" width="20" height="4" rx="2" fill="url(#stripe)" opacity="0.5"/><line x1="12" y1="12" x2="12" y2="24" stroke="#fff" stroke-width="2.5"/><line x1="18" y1="10" x2="18" y2="26" stroke="#fff" stroke-width="2.5"/><line x1="24" y1="12" x2="24" y2="24" stroke="#fff" stroke-width="2.5"/>',
  // Road closure — X
  road_closure: '<line x1="10" y1="10" x2="26" y2="26" stroke="#fff" stroke-width="3" stroke-linecap="round"/><line x1="26" y1="10" x2="10" y2="26" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  // EV bolt
  ev_station: '<polygon points="20,6 12,20 18,20 16,30 24,16 18,16" fill="#fff"/>',
}

function svgIcon(type: string, color: string, size = 36) {
  const inner = SVG_PATHS[type] ?? ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="${color}" opacity="0.93" stroke="#fff" stroke-width="2"/>
    ${inner}
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export const EventIcons: Record<string, L.DivIcon> = {
  police:       svgIcon('police',       '#3B82F6'),
  speed_camera: svgIcon('speed_camera', '#F59E0B'),
  accident:     svgIcon('accident',     '#F97316'),
  traffic:      svgIcon('traffic',      '#8B5CF6'),
  hazard:       svgIcon('hazard',       '#EAB308'),
  construction: svgIcon('construction', '#F97316'),
  ev_station:   svgIcon('ev_station',   '#22C55E'),
  road_closure: svgIcon('road_closure', '#DC2626'),
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
      <circle class="user-pulse" cx="40" cy="40" r="22" fill="none" stroke="#3B82F6" stroke-width="2"/>
      <g transform="rotate(${heading}, 40, 40)">
        <circle cx="40" cy="40" r="22" fill="#3B82F6" opacity="0.12"/>
        <polygon points="40,18 52,54 40,46 28,54"
          fill="#3B82F6" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="40" cy="40" r="3.5" fill="#fff" opacity="0.95"/>
      </g>
    </svg>`,
  className: '',
  iconSize: [80, 80],
  iconAnchor: [40, 40],
})

export const EVIcon = (available: number, total: number) => {
  const pct   = total > 0 ? available / total : 0
  const color = pct > 0.5 ? '#22C55E' : pct > 0.2 ? '#F59E0B' : '#EF4444'
  return svgIcon('ev_station', color, 32)
}

export const TeslaIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="#CC0000" stroke="#fff" stroke-width="2"/>
    <path fill="#fff" d="
      M18 13.2 L16.6 14.2 L16.6 25.5 L18 27.5 L19.4 25.5 L19.4 14.2 Z
      M11.2 13.8 C13 13.1 15.2 12.9 16.6 12.9 L16.6 14.2 C15.2 14.2 13.2 14.4 11.8 15 Z
      M24.8 13.8 C23 13.1 20.8 12.9 19.4 12.9 L19.4 14.2 C20.8 14.2 22.8 14.4 24.2 15 Z
      M10.2 11.6 C10.2 11.6 12 10.2 18 10.2 C24 10.2 25.8 11.6 25.8 11.6 L24.8 13.8
      C24.8 13.8 22.8 12.6 18 12.6 C13.2 12.6 11.2 13.8 11.2 13.8 Z
    "/>
  </svg>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})
