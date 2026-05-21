-- Chonburi Digital Twin Schema
-- Run this against your PostgreSQL/PostGIS database to initialise the twin.
-- Compatible with: PostgreSQL 15+, PostGIS 3.3+, optionally TimescaleDB 2.11+

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Twin Objects ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS twin_objects (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN (
        'building', 'sensor', 'road', 'reservoir', 'vessel', 'zone',
        'poi', 'bridge', 'ferry', 'port'
    )),
    name TEXT NOT NULL,
    name_th TEXT,
    name_en TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Geometry, 4326), -- WGS84
    properties JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twin_objects_kind ON twin_objects(kind);
CREATE INDEX IF NOT EXISTS idx_twin_objects_geom ON twin_objects USING GIST(geom);

-- ── Twin Relations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS twin_relations (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES twin_objects(id) ON DELETE CASCADE,
    predicate TEXT NOT NULL CHECK (predicate IN (
        'contains', 'monitors', 'adjacent_to', 'connected_to',
        'serves', 'located_in', 'part_of'
    )),
    object_id TEXT NOT NULL REFERENCES twin_objects(id) ON DELETE CASCADE,
    properties JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twin_relations_subject ON twin_relations(subject_id);
CREATE INDEX IF NOT EXISTS idx_twin_relations_object ON twin_relations(object_id);
CREATE INDEX IF NOT EXISTS idx_twin_relations_predicate ON twin_relations(predicate);

-- Prevent duplicate relations between same pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_twin_relations_unique
    ON twin_relations(subject_id, predicate, object_id);

-- ── Twin State (time-series) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS twin_state (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    object_id TEXT NOT NULL REFERENCES twin_objects(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'
);

-- If TimescaleDB is available, convert to hypertable for automatic partitioning
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('twin_state', 'time', if_not_exists => TRUE);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_twin_state_object_metric ON twin_state(object_id, metric, time DESC);
CREATE INDEX IF NOT EXISTS idx_twin_state_time ON twin_state(time DESC);

-- ── Bootstrapping helper ────────────────────────────────────────────────
-- Returns counts for health checks
CREATE OR REPLACE FUNCTION twin_counts()
RETURNS TABLE(objects BIGINT, relations BIGINT, state_points BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM twin_objects),
        (SELECT COUNT(*) FROM twin_relations),
        (SELECT COUNT(*) FROM twin_state);
END;
$$ LANGUAGE plpgsql;
