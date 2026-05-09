-- Delivery: initial schema.
-- Idempotent (uses IF NOT EXISTS where possible). Re-runnable on a fresh DB.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'forwarder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE parcel_status AS ENUM (
        'ordered',
        'arrived_usa',
        'received_by_forwarder_usa',
        'in_shipment_usa_to_kg',
        'arrived_kg',
        'in_shipment_kg_to_ru',
        'delivered_ru',
        'not_received_ru',
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE problem_flag AS ENUM ('lost', 'damaged', 'delayed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE shipment_direction AS ENUM ('usa_to_kg', 'kg_to_ru');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE shipment_status AS ENUM ('draft', 'in_transit', 'received');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Users (logical) ──────────────────────────────────────────────────────────
-- Two seeded rows: one admin, one forwarder. Credentials live in env (not here);
-- this table only stores the logical user identity used for audit / sessions.
CREATE TABLE IF NOT EXISTS users (
    id           text PRIMARY KEY,
    role         user_role NOT NULL,
    display_name text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Sessions (cookie-based auth) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at     timestamptz NOT NULL DEFAULT now(),
    last_seen_at   timestamptz NOT NULL DEFAULT now(),
    expires_at     timestamptz NOT NULL,
    user_agent     text,
    ip             inet
);
CREATE INDEX IF NOT EXISTS sessions_user_idx     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx  ON sessions(expires_at);

-- ─── Settings (single row) ────────────────────────────────────────────────────
-- Tariff value is duplicated into `tariffs` history table on change.
CREATE TABLE IF NOT EXISTS settings (
    id                       int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    tariff_usd_per_kg        numeric(8,2) NOT NULL,
    tariff_effective_from    timestamptz NOT NULL,
    threshold_usa_days       int NOT NULL,
    threshold_usa_enabled    boolean NOT NULL,
    threshold_to_kg_days     int NOT NULL,
    threshold_to_kg_enabled  boolean NOT NULL,
    threshold_to_ru_days     int NOT NULL,
    threshold_to_ru_enabled  boolean NOT NULL,
    cutoff_date              date NOT NULL,
    updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ─── Tariffs (historical) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tariffs (
    id              bigserial PRIMARY KEY,
    usd_per_kg      numeric(8,2) NOT NULL,
    effective_from  timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tariffs_eff_idx ON tariffs(effective_from DESC);

-- ─── Shipments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
    id                  text PRIMARY KEY,
    direction           shipment_direction NOT NULL,
    status              shipment_status NOT NULL DEFAULT 'draft',
    transport           text,
    waybill_no          text,
    notes               text,
    waybill_photo_url   text,
    planned_sent_at     timestamptz,
    planned_arrival_at  timestamptz,
    sent_at             timestamptz,
    arrived_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          text REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS shipments_status_idx     ON shipments(status);
CREATE INDEX IF NOT EXISTS shipments_direction_idx  ON shipments(direction);

-- ─── Parcels (main entity) ────────────────────────────────────────────────────
-- Tracking number is the primary key. Linked to ebay order by source_order_number.
CREATE TABLE IF NOT EXISTS parcels (
    tracking_number              text PRIMARY KEY,
    status                       parcel_status NOT NULL DEFAULT 'ordered',
    problem                      problem_flag,
    ordered_at                   timestamptz NOT NULL,
    eta_usa                      timestamptz,
    arrived_usa_at               timestamptz,
    received_usa_at              timestamptz,
    shipment_usa_to_kg_id        text REFERENCES shipments(id) ON DELETE SET NULL,
    arrived_kg_at                timestamptz,
    weight_kg                    numeric(8,3),
    shipment_kg_to_ru_id         text REFERENCES shipments(id) ON DELETE SET NULL,
    delivered_ru_at              timestamptz,
    notes                        text,
    -- admin-only fields (not exposed to forwarder DTO)
    source_order_number          text NOT NULL,
    sold_by                      text,
    item_title                   text,
    order_total_usd              numeric(14,2),
    shipping_cost_usd_snapshot   numeric(14,2),
    tariff_snapshot_usd_per_kg   numeric(8,2),
    -- meta
    created_at                   timestamptz NOT NULL DEFAULT now(),
    updated_at                   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parcels_status_idx          ON parcels(status);
CREATE INDEX IF NOT EXISTS parcels_problem_idx         ON parcels(problem) WHERE problem IS NOT NULL;
CREATE INDEX IF NOT EXISTS parcels_kg_shipment_idx     ON parcels(shipment_kg_to_ru_id);
CREATE INDEX IF NOT EXISTS parcels_usa_shipment_idx    ON parcels(shipment_usa_to_kg_id);
CREATE INDEX IF NOT EXISTS parcels_source_order_idx    ON parcels(source_order_number);

-- ─── Parcel history (status transitions) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcel_history (
    id              bigserial PRIMARY KEY,
    tracking_number text NOT NULL REFERENCES parcels(tracking_number) ON DELETE CASCADE,
    from_status     parcel_status,
    to_status       parcel_status NOT NULL,
    actor_id        text REFERENCES users(id) ON DELETE SET NULL,
    note            text,
    at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parcel_history_tn_idx   ON parcel_history(tracking_number, at DESC);
CREATE INDEX IF NOT EXISTS parcel_history_at_idx   ON parcel_history(at DESC);

-- ─── Parcel photos (MinIO meta) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcel_photos (
    id              bigserial PRIMARY KEY,
    tracking_number text NOT NULL REFERENCES parcels(tracking_number) ON DELETE CASCADE,
    object_key      text NOT NULL,        -- key in parts-photos bucket
    public_url      text NOT NULL,
    mime_type       text NOT NULL,
    bytes           bigint NOT NULL,
    uploaded_by     text REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parcel_photos_tn_idx ON parcel_photos(tracking_number, uploaded_at DESC);

-- ─── Shipment waybill photos (MinIO meta) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipment_waybills (
    id              bigserial PRIMARY KEY,
    shipment_id     text NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    object_key      text NOT NULL,        -- key in delivery-photos bucket
    public_url      text NOT NULL,
    mime_type       text NOT NULL,
    bytes           bigint NOT NULL,
    uploaded_by     text REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shipment_waybills_sh_idx ON shipment_waybills(shipment_id, uploaded_at DESC);

-- ─── Updated_at trigger for parcels ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parcels_touch ON parcels;
CREATE TRIGGER trg_parcels_touch BEFORE UPDATE ON parcels
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── Seed: two logical users + initial settings + initial tariff ──────────────
INSERT INTO users (id, role, display_name) VALUES
    ('stepan',  'admin',     'Степан'),
    ('kg_team', 'forwarder', 'Команда КГ')
ON CONFLICT (id) DO NOTHING;

INSERT INTO settings (
    id,
    tariff_usd_per_kg, tariff_effective_from,
    threshold_usa_days, threshold_usa_enabled,
    threshold_to_kg_days, threshold_to_kg_enabled,
    threshold_to_ru_days, threshold_to_ru_enabled,
    cutoff_date
) VALUES (
    1,
    9.50, now(),
    7, true,
    21, true,
    7, true,
    '1900-01-01'  -- "load everything" — user explicitly asked to import all orders
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tariffs (usd_per_kg, effective_from)
SELECT 9.50, now()
WHERE NOT EXISTS (SELECT 1 FROM tariffs);

COMMIT;
