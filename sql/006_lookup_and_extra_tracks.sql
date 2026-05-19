-- Manual lookup requests support:
--   * is_manual flag in parcels_mutations
--   * source_order_number becomes nullable (orphan parcel before link)
--   * parcels VIEW now unions order_tracking_numbers and orders.delivery_extra_tracks
--   * parcels foreign table extended to expose delivery_extra_tracks columns
-- Re-runnable: DROP VIEW + CREATE VIEW, IF NOT EXISTS on column adds.

BEGIN;

-- 1. is_manual flag
ALTER TABLE parcels_mutations
    ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

-- 2. allow orphan parcel: source_order_number is nullable for manual rows
ALTER TABLE parcels_mutations
    ALTER COLUMN source_order_number DROP NOT NULL;

-- 3. rebuild foreign table for orders with extra-track columns.
--    Drop the view first so we can drop the foreign table cleanly.
DROP TRIGGER IF EXISTS parcels_iud ON parcels;
DROP VIEW IF EXISTS parcels;
DROP FOREIGN TABLE IF EXISTS ebay_remote.orders;

CREATE FOREIGN TABLE ebay_remote.orders (
    order_id                   bigint,
    order_number               text,
    sold_by                    text,
    ordered_at                 timestamptz,
    order_total_usd            numeric(14,2),
    item_subtotal_usd          numeric(14,2),
    shipping_usd               numeric(14,2),
    sales_tax_usd              numeric(14,2),
    delivery_status            text,
    delivered_date             date,
    arriving_by_date           text,
    shipping_service           text,
    is_untracked               boolean,
    delivery_extra_tracks      text[],
    delivery_extra_tracks_meta jsonb,
    created_at                 timestamptz,
    updated_at                 timestamptz
) SERVER ebay_server
  OPTIONS (schema_name 'public', table_name 'orders');

ANALYZE ebay_remote.orders;

-- 4. parcels VIEW with unioned track sources
CREATE VIEW parcels AS
WITH all_tracks AS (
    SELECT t.order_id, t.tracking_number
      FROM ebay_remote.order_tracking_numbers t
    UNION ALL
    SELECT o.order_id, unnest(o.delivery_extra_tracks) AS tracking_number
      FROM ebay_remote.orders o
     WHERE o.delivery_extra_tracks IS NOT NULL
       AND array_length(o.delivery_extra_tracks, 1) > 0
),
agg AS (
    SELECT
        at.tracking_number,
        single_or_raise(o.sold_by)                                     AS sold_by,
        SUM(o.order_total_usd)                                         AS order_total_usd,
        MAX(o.delivered_date)::timestamptz                             AS arrived_usa_at,
        STRING_AGG(DISTINCT i.item_title, ' · ' ORDER BY i.item_title) AS item_title
      FROM all_tracks at
      LEFT JOIN ebay_remote.orders o      ON o.order_id = at.order_id
      LEFT JOIN ebay_remote.order_items i ON i.order_id = o.order_id
     GROUP BY at.tracking_number
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
    pm.is_manual,
    pm.created_at,
    pm.updated_at
FROM parcels_mutations pm
LEFT JOIN agg ON agg.tracking_number = pm.tracking_number;

-- 5. INSTEAD OF trigger supports is_manual + nullable source_order_number
CREATE OR REPLACE FUNCTION parcels_mutations_upsert() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO parcels_mutations (
            tracking_number, status, problem, ordered_at, eta_usa,
            received_usa_at, shipment_usa_to_kg_id, arrived_kg_at, weight_kg,
            shipment_kg_to_ru_id, delivered_ru_at, notes,
            source_order_number, shipping_cost_usd_snapshot, tariff_snapshot_usd_per_kg,
            is_manual
        ) VALUES (
            NEW.tracking_number, COALESCE(NEW.status, 'ordered'::parcel_status),
            NEW.problem, NEW.ordered_at, NEW.eta_usa,
            NEW.received_usa_at, NEW.shipment_usa_to_kg_id, NEW.arrived_kg_at, NEW.weight_kg,
            NEW.shipment_kg_to_ru_id, NEW.delivered_ru_at, NEW.notes,
            NEW.source_order_number, NEW.shipping_cost_usd_snapshot, NEW.tariff_snapshot_usd_per_kg,
            COALESCE(NEW.is_manual, false)
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
            is_manual = COALESCE(NEW.is_manual, OLD.is_manual),
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
