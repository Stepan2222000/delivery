-- 003_fdw_parcels.sql — switch parcels to FDW-backed VIEW. Run-once.
-- Requires `ALTER SERVER ebay_server OPTIONS (ADD use_remote_estimate 'true')`
-- (already applied to prod) for FDW pushdown to work.
-- Note: this VIEW is superseded by 004 (per-tracking aggregation).

BEGIN;

ALTER TABLE parcels RENAME TO parcels_mutations;

-- eta_usa stays local: arriving_by_date is a free-form string parsed in Python
-- and the parser isn't pushdown-friendly.
ALTER TABLE parcels_mutations DROP COLUMN sold_by;
ALTER TABLE parcels_mutations DROP COLUMN item_title;
ALTER TABLE parcels_mutations DROP COLUMN order_total_usd;
ALTER TABLE parcels_mutations DROP COLUMN arrived_usa_at;

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

-- INSTEAD OF triggers so legacy "UPDATE parcels SET ..." callers still work
-- (the VIEW joins, which can't be updated directly).
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
