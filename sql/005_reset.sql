-- 005_reset.sql — wipe our overlay on top of ebay_orders.
-- Removes everything we wrote ourselves: parcel state, shipments, history,
-- photo metadata. The remote ebay_orders DB (accessed via FDW) is NOT touched —
-- this file only references local tables.
--
-- After running:
--   * parcels_mutations empty → `parcels` VIEW returns 0 rows.
--   * Once sync is restarted, it will re-import every eligible tracking number
--     with status='ordered' and a fresh eta_usa, exactly as on first import.
--
-- Run order (the operator must do this):
--   1. docker-compose stop sync          # prevent re-import during edits
--   2. psql ... -f sql/005_reset.sql
--   3. (do manual edits in DB)
--   4. docker-compose start sync         # resumes auto-import
--
-- Idempotent: re-running on an already-empty DB is a no-op.

BEGIN;

-- One statement nukes everything via FK cascade:
--   shipments        → shipment_waybills (CASCADE), parcels_mutations (SET NULL, but TRUNCATE bulldozes)
--   parcels_mutations → parcel_history (CASCADE), parcel_photos (CASCADE)
-- RESTART IDENTITY resets bigserial counters in the dependent tables.
TRUNCATE shipments, parcels_mutations RESTART IDENTITY CASCADE;

COMMIT;
