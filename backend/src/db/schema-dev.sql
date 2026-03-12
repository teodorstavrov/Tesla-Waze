-- Tesla Intelligence — Dev Schema (no PostGIS required)
-- Uses plain lat/lng columns for local development

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          VARCHAR(30) NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  severity      SMALLINT NOT NULL DEFAULT 1,
  confidence    SMALLINT NOT NULL DEFAULT 50,
  votes         INTEGER NOT NULL DEFAULT 0,
  source        VARCHAR(30) NOT NULL DEFAULT 'user_report',
  speed_limit   SMALLINT,
  direction     SMALLINT,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_bbox ON events(lat, lng);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

CREATE TABLE IF NOT EXISTS user_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          VARCHAR(30) NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  session_id    VARCHAR(64),
  upvotes       INTEGER NOT NULL DEFAULT 0,
  downvotes     INTEGER NOT NULL DEFAULT 0,
  confirmed     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_reports_bbox ON user_reports(lat, lng);

CREATE TABLE IF NOT EXISTS report_votes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id   UUID NOT NULL REFERENCES user_reports(id) ON DELETE CASCADE,
  session_id  VARCHAR(64) NOT NULL,
  vote        VARCHAR(4) NOT NULL CHECK (vote IN ('up', 'down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, session_id)
);

CREATE TABLE IF NOT EXISTS ev_stations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id       VARCHAR(100) UNIQUE,
  name              VARCHAR(255) NOT NULL,
  operator          VARCHAR(255),
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  total_ports       INTEGER NOT NULL DEFAULT 0,
  available_ports   INTEGER NOT NULL DEFAULT 0,
  is_tesla          BOOLEAN NOT NULL DEFAULT false,
  price_per_kwh     DECIMAL(6, 4),
  amenities         TEXT[],
  last_synced       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ev_connectors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id  UUID NOT NULL REFERENCES ev_stations(id) ON DELETE CASCADE,
  plug_type   VARCHAR(20) NOT NULL,
  power_kw    DECIMAL(6, 2) NOT NULL,
  available   BOOLEAN NOT NULL DEFAULT true,
  total       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS risk_zones (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  radius_meters     INTEGER NOT NULL DEFAULT 300,
  score             SMALLINT NOT NULL DEFAULT 0,
  probability       DECIMAL(4, 3) NOT NULL DEFAULT 0,
  historical_count  INTEGER NOT NULL DEFAULT 0,
  peak_hours        INTEGER[] DEFAULT '{}',
  day_of_week       INTEGER[] DEFAULT '{}',
  last_computed     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
