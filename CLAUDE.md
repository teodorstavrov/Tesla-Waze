# Tesla Intelligence — Project Context

## What this is
A full-stack Tesla in-car browser web application (superior to TeslaWaze/TeslaNav).
Real-time driving intelligence dashboard: map events, routes, EV charging, voice alerts.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Leaflet + Zustand
- **Backend**: Node.js + Express + Socket.IO + Redis + PostgreSQL/PostGIS
- **Infra**: Docker Compose + Nginx reverse proxy

## Key directories
- `frontend/src/` — React app
- `backend/src/` — Express API
- `backend/src/db/schema.sql` — Full database schema
- `docker-compose.yml` — Full stack orchestration

## Running locally
```bash
# Full stack
docker compose up -d

# Dev mode
cd backend && npm run dev   # port 3001
cd frontend && npm run dev  # port 5173
```

## Data sources
- Waze Live Map API (no key needed)
- TomTom Traffic (needs TOMTOM_API_KEY)
- OpenChargeMap (needs OPENCHARGEMAP_API_KEY)
- OSRM + Nominatim (OSM, no key needed)

## Architecture notes
- Events aggregated in backend, cached in Redis (10s Waze, 30s traffic, 5min EV)
- WebSocket pushes new events to clients subscribed to a bounding box
- Risk zones computed from 30-day historical user reports using spatial clustering
- Routes use OSRM for geometry + PostGIS to analyze events within 300m buffer
