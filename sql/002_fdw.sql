-- postgres_fdw setup: read-only access from delivery to ebay_orders.
-- Pattern follows parts_photos/api/sql/fdw_smart.sql.
-- Re-runnable.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Foreign server: ebay_orders DB on the same host, separate Postgres instance.
DROP SERVER IF EXISTS ebay_server CASCADE;
CREATE SERVER ebay_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (
        host '194.164.245.107',
        port '5405',
        dbname 'ebay_orders',
        fetch_size '1000'
    );

CREATE USER MAPPING FOR admin
    SERVER ebay_server
    OPTIONS (user 'admin', password 'Password123');

DROP SCHEMA IF EXISTS ebay_remote CASCADE;
CREATE SCHEMA ebay_remote;

-- Mirror only the columns we need (avoid IMPORT FOREIGN SCHEMA — picks up enums/triggers we don't want).
CREATE FOREIGN TABLE ebay_remote.orders (
    order_id           bigint,
    order_number       text,
    sold_by            text,
    ordered_at         timestamptz,
    order_total_usd    numeric(14,2),
    item_subtotal_usd  numeric(14,2),
    shipping_usd       numeric(14,2),
    sales_tax_usd      numeric(14,2),
    delivery_status    text,
    delivered_date     date,
    arriving_by_date   text,
    shipping_service   text,
    is_untracked       boolean,
    created_at         timestamptz,
    updated_at         timestamptz
) SERVER ebay_server
  OPTIONS (schema_name 'public', table_name 'orders');

CREATE FOREIGN TABLE ebay_remote.order_tracking_numbers (
    order_id        bigint,
    tracking_number text
) SERVER ebay_server
  OPTIONS (schema_name 'public', table_name 'order_tracking_numbers');

CREATE FOREIGN TABLE ebay_remote.order_items (
    order_id    bigint,
    item_title  text,
    quantity    int
) SERVER ebay_server
  OPTIONS (schema_name 'public', table_name 'order_items');

ANALYZE ebay_remote.orders;
ANALYZE ebay_remote.order_tracking_numbers;

COMMIT;
