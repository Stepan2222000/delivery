-- 004_fdw_parcels_aggregate.sql — one physical parcel can carry several eBay
-- orders sharing the same tracking number (7 such cases in prod, up to 4
-- orders each). Aggregate per tracking_number so the VIEW returns one row
-- per parcel. `single_or_raise` fails loudly if a tracking ever spans two
-- sellers — better than silently picking one.
--
-- GROUP BY with a PL/pgSQL aggregate is not pushed down by postgres_fdw —
-- all matching rows come back and aggregate locally. ~2ms at current scale;
-- revisit past a few thousand orders.

BEGIN;

DROP TRIGGER IF EXISTS parcels_iud ON parcels;
DROP VIEW IF EXISTS parcels;

CREATE OR REPLACE FUNCTION _single_or_raise_sfunc(state text, value text)
RETURNS text AS $$
BEGIN
    IF value IS NULL THEN RETURN state; END IF;
    IF state IS NULL THEN RETURN value; END IF;
    IF state = value THEN RETURN state; END IF;
    RAISE EXCEPTION 'single_or_raise: conflicting values "%" vs "%"', state, value
        USING ERRCODE = 'data_exception';
END;
$$ LANGUAGE plpgsql;

DROP AGGREGATE IF EXISTS single_or_raise(text);
CREATE AGGREGATE single_or_raise(text) (
    SFUNC = _single_or_raise_sfunc,
    STYPE = text
);

CREATE VIEW parcels AS
WITH agg AS (
    SELECT
        t.tracking_number,
        single_or_raise(o.sold_by)                                     AS sold_by,
        SUM(o.order_total_usd)                                         AS order_total_usd,
        MAX(o.delivered_date)::timestamptz                             AS arrived_usa_at,
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

-- Re-attach the INSTEAD OF trigger; the function from 003 survives DROP VIEW.
CREATE TRIGGER parcels_iud
    INSTEAD OF INSERT OR UPDATE OR DELETE ON parcels
    FOR EACH ROW EXECUTE FUNCTION parcels_mutations_upsert();

COMMIT;
