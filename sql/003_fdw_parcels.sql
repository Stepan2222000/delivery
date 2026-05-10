-- ───────────────────────────────────────────────────────────────────────────
-- 003_fdw_parcels.sql — switch parcels from local-duplicated to FDW-backed VIEW.
--
-- Before this migration: parcels was a local table that duplicated 5 columns
-- from ebay_remote.orders (sold_by, item_title, order_total_usd, eta_usa,
-- arrived_usa_at). A sync worker UPDATEd them every 5 minutes — drift &
-- complexity for ~5 columns that almost never change after the order is paid.
--
-- After this migration:
--   - parcels_mutations  = our own fields only (status, weight, dates we own,
--                          shipment FKs, snapshots, notes, source_order_number,
--                          parsed eta_usa cache).
--   - parcels (VIEW)     = LEFT JOIN parcels_mutations ⨝ ebay_remote.* via FDW.
--                          API/sync see the same 19-column shape as before.
--
-- Run-once. Foreign tables and ebay_server are assumed to exist (002_fdw.sql).
-- Requires:
--   ALTER SERVER ebay_server OPTIONS (ADD use_remote_estimate 'true');
-- which was already applied to prod.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Rename existing table — its rows already have all data we need.
ALTER TABLE parcels RENAME TO parcels_mutations;

-- 2. Drop columns that now come from ebay_remote via the VIEW.
--    sold_by / item_title / order_total_usd / arrived_usa_at — pure projection.
--    eta_usa stays: parsed once from arriving_by_date string by the sync worker
--    (parser is not pushdown-friendly and arriving_by_date doesn't change after
--    the order is created).
ALTER TABLE parcels_mutations DROP COLUMN sold_by;
ALTER TABLE parcels_mutations DROP COLUMN item_title;
ALTER TABLE parcels_mutations DROP COLUMN order_total_usd;
ALTER TABLE parcels_mutations DROP COLUMN arrived_usa_at;

-- 3. Index on source_order_number stays — used by VIEW JOIN.
--    parcels_mutations_pkey covers tracking_number lookups.

-- 4. The VIEW reproduces the old parcels shape exactly so API code is unchanged.
--    Pattern: simple INNER JOIN on the FDW; pushdown handles the heavy lifting.
--    LEFT JOIN to order_items so a missing item doesn't drop the parcel row.
--    DISTINCT ON via subquery — postgres_fdw on PG18 pushes ROW_NUMBER-style
--    aggregations down only sometimes, so we materialise the first item via a
--    subquery; for ~200 orders this is irrelevant, for 10k+ may need rework.
CREATE OR REPLACE VIEW parcels AS
SELECT
    pm.tracking_number,
    pm.status,
    pm.problem,
    pm.ordered_at,
    pm.eta_usa,
    o.delivered_date::timestamptz                              AS arrived_usa_at,
    pm.received_usa_at,
    pm.shipment_usa_to_kg_id,
    pm.arrived_kg_at,
    pm.weight_kg,
    pm.shipment_kg_to_ru_id,
    pm.delivered_ru_at,
    pm.notes,
    pm.source_order_number,
    o.sold_by,
    (SELECT i.item_title
       FROM ebay_remote.order_items i
      WHERE i.order_id = o.order_id
      LIMIT 1)                                                 AS item_title,
    o.order_total_usd,
    pm.shipping_cost_usd_snapshot,
    pm.tariff_snapshot_usd_per_kg,
    pm.created_at,
    pm.updated_at
FROM parcels_mutations pm
LEFT JOIN ebay_remote.order_tracking_numbers t
       ON t.tracking_number = pm.tracking_number
LEFT JOIN ebay_remote.orders o
       ON o.order_id = t.order_id;

-- 5. INSTEAD OF triggers for INSERT/UPDATE/DELETE so existing API code that
--    writes to "parcels" routes through to parcels_mutations transparently.
--    Without this, FastAPI's UPDATE parcels SET status=... would fail (can't
--    update a join VIEW).
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

DROP TRIGGER IF EXISTS parcels_iud ON parcels;
CREATE TRIGGER parcels_iud
    INSTEAD OF INSERT OR UPDATE OR DELETE ON parcels
    FOR EACH ROW EXECUTE FUNCTION parcels_mutations_upsert();

COMMIT;
