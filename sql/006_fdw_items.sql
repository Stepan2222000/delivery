-- 006_fdw_items.sql — upstream ebay_orders normalized item titles out of
-- `order_items` into a new `items` table: order_items now carries item_number
-- (FK -> items.item_number), and item_title lives on items. Update the FDW
-- foreign tables and the parcels VIEW to read item_title via items.
--
-- Symptom this fixes: GET /parcels (and /parcels/untracked) returned 500 with
--   asyncpg UndefinedColumnError: column "item_title" does not exist
-- because the VIEW / queries still selected order_items.item_title.
--
-- Re-runnable. Does NOT touch the foreign server definition (prod points it at
-- the internal docker host, which differs from 002_fdw.sql).

BEGIN;

DROP TRIGGER IF EXISTS parcels_iud ON parcels;
DROP VIEW IF EXISTS parcels;

-- order_items lost item_title, gained item_number (FK -> items).
DROP FOREIGN TABLE IF EXISTS ebay_remote.order_items;
CREATE FOREIGN TABLE ebay_remote.order_items (
    order_id      bigint,
    item_number   text,
    item_quantity int
) SERVER ebay_server
  OPTIONS (schema_name 'public', table_name 'order_items');

-- New source of truth for titles.
DROP FOREIGN TABLE IF EXISTS ebay_remote.items;
CREATE FOREIGN TABLE ebay_remote.items (
    item_number text,
    item_title  text
) SERVER ebay_server
  OPTIONS (schema_name 'public', table_name 'items');

CREATE VIEW parcels AS
WITH agg AS (
    SELECT
        t.tracking_number,
        single_or_raise(o.sold_by)                                       AS sold_by,
        SUM(o.order_total_usd)                                           AS order_total_usd,
        MAX(o.delivered_date)::timestamptz                               AS arrived_usa_at,
        STRING_AGG(DISTINCT it.item_title, ' · ' ORDER BY it.item_title) AS item_title
    FROM ebay_remote.order_tracking_numbers t
    LEFT JOIN ebay_remote.orders o      ON o.order_id = t.order_id
    LEFT JOIN ebay_remote.order_items i ON i.order_id = o.order_id
    LEFT JOIN ebay_remote.items it      ON it.item_number = i.item_number
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

-- Re-attach the INSTEAD OF trigger; parcels_mutations_upsert() survives DROP VIEW.
CREATE TRIGGER parcels_iud
    INSTEAD OF INSERT OR UPDATE OR DELETE ON parcels
    FOR EACH ROW EXECUTE FUNCTION parcels_mutations_upsert();

COMMIT;
