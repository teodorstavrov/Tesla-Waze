# Tesla Intelligence

> The ultimate real-time driving intelligence dashboard for Tesla in-car browser

![Tesla Intelligence Dashboard](https://img.shields.io/badge/Tesla-Intelligence-red)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### Core
- **Full-screen interactive map** — Dark CARTO tiles, optimized for Tesla's browser
- **Real-time event layers** — Police, speed cameras, accidents, hazards, construction, traffic
- **Marker clustering** — Groups nearby events at any zoom level, explodes to individuals at zoom 16+
- **Voice alerts** — Web Speech API announces approaching threats
- **Route intelligence** — Analyze events along any route, 4 route modes
- **EV charging finder** — Live availability, power, pricing, plug types
- **Crowd reporting** — One-tap report police/accidents/cameras/hazards with vote validation
- **Risk prediction** — ML-style scoring of police zones based on 30-day historical data
- **PWA** — Installable, offline-capable, background sync

### Tesla Browser Optimizations
- No WebGL — uses Leaflet SVG/Canvas renderer
- Bundle < 2MB (code-split into 4 chunks)
- Touch targets minimum 44px (optimized for gloves)
- WakeLock API to prevent screen sleep
- Landscape-first layout
- No text selection
- Overscroll prevention

---

## Tech Stack

### Frontend
| Tech | Version | Purpose |
|------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool |
| TailwindCSS | 3 | Styling |
| Leaflet | 1.9 | Map engine |
| leaflet.markercluster | 1.5 | Marker grouping |
| Zustand | 4 | State management |
| Socket.IO Client | 4 | Real-time events |
| vite-plugin-pwa | 0.20 | PWA support |

### Backend
| Tech | Version | Purpose |
|------|---------|---------|
| Node.js | 20 | Runtime |
| Express | 4 | HTTP server |
| Socket.IO | 4 | WebSocket server |
| PostgreSQL + PostGIS | 16 + 3.4 | Spatial data store |
| Redis | 7 | Event cache & rate limiting |
| OSRM | public | Route calculation |
| Nominatim | public | Geocoding |

### Data Sources
| Source | Data | Update |
|--------|------|--------|
| Waze Live Map API | Police, accidents, hazards, jams | 10s |
| TomTom Traffic | Incidents, closures | 30s |
| OpenChargeMap | EV stations | 5min |
| OpenStreetMap/OSRM | Routing, geocoding | On demand |
| User Reports (DB) | Community reports | Real-time |

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for local dev)

### 1. Clone and configure

```bash
git clone <repo>
cd tesla-intelligence
cp .env.example .env
# Edit .env with your API keys (all optional — app works without them)
```

### 2. Run with Docker

```bash
docker compose up -d
```

The app will be available at **http://localhost**

### 3. Local development

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

**Backend:**
```bash
cd backend
npm install
# Start PostgreSQL + Redis via Docker first:
docker compose up postgres redis -d
# Then:
cp .env.example .env
npm run dev
# → http://localhost:3001
```

---

## API Keys (All Optional)

The app works without any API keys using open-source data sources. To enhance functionality:

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| [TomTom](https://developer.tomtom.com/) | Enhanced traffic incidents | 2,500 req/day |
| [OpenChargeMap](https://openchargemap.org/site/develop/api) | Better EV station data | Unlimited |
| [HERE Maps](https://developer.here.com/) | Premium geocoding | 250k req/month |

Add keys to `.env`:
```
TOMTOM_API_KEY=your_key
OPENCHARGEMAP_API_KEY=your_key
```

---

## Project Structure

```
tesla-intelligence/
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/           # Map, markers, clustering, polylines
│   │   │   └── UI/            # Panels, nav bar, top bar
│   │   ├── hooks/             # Geolocation, WebSocket, voice, polling
│   │   ├── services/          # API client, WebSocket service
│   │   ├── store/             # Zustand stores (events, route, UI)
│   │   └── types/             # TypeScript interfaces
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   └── sw.js              # Service worker
│   └── Dockerfile
│
├── backend/                   # Node.js + Express API
│   ├── src/
│   │   ├── routes/            # events, reports, routes, ev, risk
│   │   ├── services/          # waze, traffic, ev, route, aggregator
│   │   ├── websocket/         # Socket.IO broadcaster
│   │   ├── cache/             # Redis helpers
│   │   └── db/                # PostgreSQL pool + schema
│   └── Dockerfile
│
├── docker-compose.yml         # Full stack orchestration
├── nginx.conf                 # Reverse proxy config
└── .env.example               # Environment template
```

---

## Architecture

```
Tesla Browser
     │
     ▼
┌─────────────────────────────────────────┐
│               Frontend (Vite/React)      │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │  Leaflet │ │  Zustand │ │  Vite   │  │
│  │   Map    │ │  Stores  │ │  PWA    │  │
│  └──────────┘ └──────────┘ └─────────┘  │
│       │            │            │        │
└───────┼────────────┼────────────┼────────┘
        │            │            │
        ▼            ▼            ▼
   HTTP REST    Socket.IO    Service Worker
        │            │            │
        └────────────┼────────────┘
                     ▼
┌─────────────────────────────────────────┐
│            Backend (Express)             │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │   REST   │ │ Socket   │ │  Cron   │  │
│  │  Routes  │ │  .IO     │ │  Jobs   │  │
│  └──────────┘ └──────────┘ └─────────┘  │
│       │            │                     │
│  ┌────▼────────────▼──────────────────┐  │
│  │         Service Layer              │  │
│  │  Aggregator → Waze + TomTom + DB   │  │
│  │  RouteService → OSRM + PostGIS     │  │
│  │  EVService → OpenChargeMap + DB    │  │
│  │  RiskPrediction → Historical DB    │  │
│  └────────────────────────────────────┘  │
│       │                    │             │
└───────┼────────────────────┼─────────────┘
        ▼                    ▼
   PostgreSQL+PostGIS      Redis
   (spatial events,        (10s event cache,
    reports, EV,            route cache 5min,
    risk zones)             EV cache 5min)
```

---

## Cache Strategy

| Data | Cache | TTL |
|------|-------|-----|
| Waze events | Redis | 10s |
| Traffic incidents | Redis | 30s |
| EV stations | Redis | 5min |
| Routes | Redis | 5min |
| Geocoding | Redis | 5min |
| Map tiles | Service Worker | 7 days |
| Risk zones | Redis | 2min |

---

## WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `subscribe:bbox` | Client → Server | `{north,south,east,west}` |
| `event:new` | Server → Client | `TrafficEvent` |
| `event:removed` | Server → Client | `{id: string}` |
| `ev:availability` | Server → Client | `Partial<EVStation>` |

---

## Voice Alerts

Triggered by Web Speech API when driver approaches:

| Event | Distance | Message |
|-------|----------|---------|
| Police | 800m | "Police reported 750 meters ahead" |
| Speed camera | 500m | "Speed camera, limit 50 km/h ahead in 450 meters" |
| Accident | 400m | "Accident ahead — reduce speed" |
| Hazard | 300m | "Road hazard ahead — drive carefully" |
| Speed over limit | Near camera | "Warning: Speed limit is 50 km/h" |

---

## Deployment

### Production (Docker)

```bash
# Build and deploy
docker compose -f docker-compose.yml up -d --build

# View logs
docker compose logs -f api

# Scale API
docker compose up --scale api=3
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | `changeme123` | DB password |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | `redis://redis:6379` | Redis connection |
| `CORS_ORIGIN` | Yes | `http://localhost` | Allowed frontend origin |
| `TOMTOM_API_KEY` | No | — | Enhanced traffic data |
| `OPENCHARGEMAP_API_KEY` | No | — | EV station data |

---

## Tesla Browser Notes

Tested on Tesla MCU2+ (Chrome 120+):
- Avoid `navigator.geolocation` polling under 1s intervals
- Use `touch-action: manipulation` to prevent 300ms tap delay
- `user-select: none` prevents accidental text selection during driving
- Screen Wake Lock API prevents auto-dimming during navigation
- Map tile loading is cached aggressively to reduce bandwidth usage

---

## License

MIT — See LICENSE file
