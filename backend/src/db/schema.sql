-- Tesla Intelligence Database Schema
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── Events ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          VARCHAR(30) NOT NULL,
  position      GEOGRAPHY(POINT, 4326) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  severity      SMALLINT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  confidence    SMALLINT NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  votes         INTEGER NOT NULL DEFAULT 0,
  source        VARCHAR(30) NOT NULL DEFAULT 'user_report',
  speed_limit   SMALLINT,
  direction     SMALLINT,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_position ON events USING GIST(position);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_expires ON events(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_reported ON events(reported_at DESC);

-- ─── User Reports ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          VARCHAR(30) NOT NULL,
  position      GEOGRAPHY(POINT, 4326) NOT NULL,
  user_id       UUID,
  session_id    VARCHAR(64),
  upvotes       INTEGER NOT NULL DEFAULT 0,
  downvotes     INTEGER NOT NULL DEFAULT 0,
  confirmed     BOOLEAN NOT NULL DEFAULT false,
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_reports_position ON user_reports USING GIST(position);
CREATE INDEX IF NOT EXISTS idx_reports_created ON user_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_event ON user_reports(event_id);

-- ─── Report Votes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_votes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id   UUID NOT NULL REFERENCES user_reports(id) ON DELETE CASCADE,
  session_id  VARCHAR(64) NOT NULL,
  vote        VARCHAR(4) NOT NULL CHECK (vote IN ('up', 'down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, session_id)
);

-- ─── EV Stations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ev_stations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id       VARCHAR(100) UNIQUE,
  name              VARCHAR(255) NOT NULL,
  operator          VARCHAR(255),
  position          GEOGRAPHY(POINT, 4326) NOT NULL,
  total_ports       INTEGER NOT NULL DEFAULT 0,
  available_ports   INTEGER NOT NULL DEFAULT 0,
  is_tesla          BOOLEAN NOT NULL DEFAULT false,
  price_per_kwh     DECIMAL(6, 4),
  price_per_30min   DECIMAL(6, 4),
  rating            DECIMAL(3, 2),
  amenities         TEXT[],
  raw_data          JSONB,
  last_synced       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ev_position ON ev_stations USING GIST(position);

-- ─── EV Connectors ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ev_connectors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id  UUID NOT NULL REFERENCES ev_stations(id) ON DELETE CASCADE,
  plug_type   VARCHAR(20) NOT NULL,
  power_kw    DECIMAL(6, 2) NOT NULL,
  available   BOOLEAN NOT NULL DEFAULT true,
  total       INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_connectors_station ON ev_connectors(station_id);

-- ─── Risk Zones ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_zones (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center            GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_meters     INTEGER NOT NULL DEFAULT 300,
  score             SMALLINT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  probability       DECIMAL(4, 3) NOT NULL DEFAULT 0,
  historical_count  INTEGER NOT NULL DEFAULT 0,
  peak_hours        INTEGER[] DEFAULT '{}',
  day_of_week       INTEGER[] DEFAULT '{}',
  last_computed     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_position ON risk_zones USING GIST(center);

-- ─── Route Cache ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origin_hash     VARCHAR(64) NOT NULL,
  destination_hash VARCHAR(64) NOT NULL,
  mode            VARCHAR(30) NOT NULL,
  route_data      JSONB NOT NULL,
  distance_m      INTEGER,
  duration_s      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  UNIQUE(origin_hash, destination_hash, mode)
);

-- ─── Cleanup expired records (run periodically) ──────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired() RETURNS void AS $$
BEGIN
  DELETE FROM events WHERE expires_at IS NOT NULL AND expires_at < NOW();
  DELETE FROM user_reports WHERE expires_at < NOW();
  DELETE FROM route_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
