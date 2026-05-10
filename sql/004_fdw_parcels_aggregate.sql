-- ───────────────────────────────────────────────────────────────────────────
-- 004_fdw_parcels_aggregate.sql — collapse multi-order trackings via aggregate.
--
-- One physical parcel can carry several eBay orders sharing the same tracking
-- number (currently 7 such cases in prod, up to 4 orders per tracking). The
-- previous VIEW (003) used DISTINCT ON to pick a single order per tracking,
-- which silently hid the other orders. This migration replaces that with
-- proper aggregation per tracking_number:
--
--   item_title       : STRING_AGG(DISTINCT, ' · ')   — show all titles
--   sold_by          : single_or_raise()             — must be one seller,
--                                                      else SQL exception
--   order_total_usd  : SUM                           — total = sum of orders
--   arrived_usa_at   : MAX(delivered_date)           — parcel ready when ALL
--                                                      its orders delivered
--
-- The single_or_raise aggregate trips a 22000 SQLSTATE error if two non-null
-- values disagree. Currently no tracking has multiple sellers, but if the eBay
-- parser ever produces such a record we want a loud failure rather than
-- showing a misleading "first" seller.
--
-- Performance: GROUP BY with a PL/pgSQL aggregate doesn't push down to the
-- foreign server — postgres_fdw fetches all matching rows and aggregates
-- locally. At ~200 orders this is ~2ms (measured EXPLAIN ANALYZE). If the
-- order count grows past a few thousand, revisit and either materialise the
-- aggregation or move it to a remote view.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- Drop the trigger and view from 003 first — we replace both.
DROP TRIGGER IF EXISTS parcels_iud ON parcels;
DROP VIEW IF EXISTS parcels;

-- ── single_or_raise aggregate ──────────────────────────────────────────────
-- State transition: returns the new value if state is null, the existing state
-- if values agree, raises otherwise. Nulls are ignored.
CREATE OR REPLACE FUNCTION _single_or_raise_sfunc(state text, value text)
RETURNS text AS $$
BEGIN
    IF value IS NULL THEN RETURN state; END IF;
    IF state IS NULL THEN RETURN value; END IF;
    IF state = value THEN RETURN state; END IF;
    RAISE EXCEPTION 'single_or_raise: conflicting values "%" vs "%"', state, value
        USING ERRCODE = 'data_exception';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP AGGREGATE IF EXISTS single_or_raise(text);
CREATE AGGREGATE single_or_raise(text) (
    SFUNC = _single_or_raise_sfunc,
    STYPE = text
);

-- ── parcels VIEW with per-tracking aggregation ────────────────────────────
-- agg CTE collapses (order_tracking_numbers ⨝ orders ⨝ order_items) into
-- exactly one row per tracking_number. The outer SELECT joins parcels_mutations
-- (left side, owns the tracking_number set) with agg.
CREATE VIEW parcels AS
WITH agg AS (
    SELECT
        t.tracking_number,
        single_or_raise(o.sold_by)                                     AS sold_by,
        SUM(o.order_total_usd)                                         AS order_total_usd,
        MAX(o.delivered_date)::timestamptz                             AS arrived_usa_at,
        STRING_AGG(DISTINCT i.item_title, ' · ' ORDER BY i.item_title) AS item_title
    FROM ebay_remote.order_tracking_numbers t
    LEFT JOIN ebay_remote.orders o      ON o.order_id = t.order_id
    LEFT JOIN ebay_remote.order_items i ON i.order_id = o.order_id
    GROUP BY t.tracking_number
)
SELECT
    pm.tracking_number,
    pm.status,
    pm.problem,
    pm.ordered_at,
    pm.eta_usa,
    agg.arrived_usa_at,
    pm.received_usa_at,
    pm.shipment_usa_to_kg_id,
    pm.arrived_kg_at,
    pm.weight_kg,
    pm.shipment_kg_to_ru_id,
    pm.delivered_ru_at,
    pm.notes,
    pm.source_order_number,
    agg.sold_by,
    agg.item_title,
    agg.order_total_usd,
    pm.shipping_cost_usd_snapshot,
    pm.tariff_snapshot_usd_per_kg,
    pm.created_at,
    pm.updated_at
FROM parcels_mutations pm
LEFT JOIN agg ON agg.tracking_number = pm.tracking_number;

-- ── INSTEAD OF trigger (re-create from 003 verbatim) ──────────────────────
-- Lets old SQL like "UPDATE parcels SET notes='...'" still work; new code
-- targets parcels_mutations directly.
CREATE OR REPLACE FUNCTION parcels_mutations_upsert() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO parcels_mutations (
            tracking_number, status, problem, ordered_at, eta_usa,
            received_usa_at, shipment_usa_to_kg_id, arrived_kg_at, weight_kg,
            shipment_kg_to_ru_id, delivered_ru_at, notes,
            source_order_number, shipping_cost_usd_snapshot, tariff_snapshot_usd_per_kg
        ) VALUES (
            NEW.tracking_number, COALESCE(NEW.status, 'ordered'::parcel_status),
            NEW.problem, NEW.ordered_at, NEW.eta_usa,
            NEW.received_usa_at, NEW.shipment_usa_to_kg_id, NEW.arrived_kg_at, NEW.weight_kg,
            NEW.shipment_kg_to_ru_id, NEW.delivered_ru_at, NEW.notes,
            NEW.source_order_number, NEW.shipping_cost_usd_snapshot, NEW.tariff_snapshot_usd_per_kg
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE parcels_mutations SET
            status = NEW.status,
            problem = NEW.problem,
            ordered_at = NEW.ordered_at,
            eta_usa = NEW.eta_usa,
            received_usa_at = NEW.received_usa_at,
            shipment_usa_to_kg_id = NEW.shipment_usa_to_kg_id,
            arrived_kg_at = NEW.arrived_kg_at,
            weight_kg = NEW.weight_kg,
            shipment_kg_to_ru_id = NEW.shipment_kg_to_ru_id,
            delivered_ru_at = NEW.delivered_ru_at,
            notes = NEW.notes,
            shipping_cost_usd_snapshot = NEW.shipping_cost_usd_snapshot,
            tariff_snapshot_usd_per_kg = NEW.tariff_snapshot_usd_per_kg,
            updated_at = now()
        WHERE tracking_number = OLD.tracking_number;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM parcels_mutations WHERE tracking_number = OLD.tracking_number;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parcels_iud
    INSTEAD OF INSERT OR UPDATE OR DELETE ON parcels
    FOR EACH ROW EXECUTE FUNCTION parcels_mutations_upsert();

COMMIT;
