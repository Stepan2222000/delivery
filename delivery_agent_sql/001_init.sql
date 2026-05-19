-- delivery_agent: lookup requests for unknown tracks + AI chat.
-- Lives in a separate DB so AI state is isolated from the main delivery schema.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE lookup_request_status AS ENUM (
        'draft',          -- created, AI not yet asked
        'searching',      -- chat in progress
        'pending_admin',  -- forwarder picked a match, awaits admin
        'linked',         -- admin confirmed, extra_track written to ebay_orders
        'rejected'        -- admin rejected the picked match
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS lookup_requests (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number    text,
    note               text,
    status             lookup_request_status NOT NULL DEFAULT 'draft',
    linked_order_id    bigint,
    linked_evidence    text,
    proposed_order_id  bigint,           -- forwarder's pick awaiting admin
    proposed_evidence  text,
    created_by         text NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    submitted_by       text,
    submitted_at       timestamptz,
    decided_by         text,
    decided_at         timestamptz,
    deleted_at         timestamptz,
    deleted_by         text
);

CREATE INDEX IF NOT EXISTS lookup_requests_status_idx
    ON lookup_requests(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS lookup_requests_created_at_idx
    ON lookup_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS lookup_requests_tn_idx
    ON lookup_requests(tracking_number) WHERE tracking_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS lookup_request_photos (
    id            bigserial PRIMARY KEY,
    request_id    uuid NOT NULL REFERENCES lookup_requests(id) ON DELETE CASCADE,
    object_key    text NOT NULL,
    public_url    text NOT NULL,
    mime_type     text NOT NULL,
    bytes         bigint NOT NULL,
    source        text NOT NULL CHECK (source IN ('initial', 'chat')),
    uploaded_by   text NOT NULL,
    uploaded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lookup_request_photos_req_idx
    ON lookup_request_photos(request_id, uploaded_at);

CREATE TABLE IF NOT EXISTS ai_messages (
    id            bigserial PRIMARY KEY,
    request_id    uuid NOT NULL REFERENCES lookup_requests(id) ON DELETE CASCADE,
    role          text NOT NULL CHECK (role IN ('system','user','assistant')),
    author_login  text,
    content_text  text,
    attachments   jsonb,
    structured    jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_messages_req_idx
    ON ai_messages(request_id, created_at);

CREATE OR REPLACE FUNCTION lookup_requests_touch() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lookup_requests_touch_trg ON lookup_requests;
CREATE TRIGGER lookup_requests_touch_trg
    BEFORE UPDATE ON lookup_requests
    FOR EACH ROW EXECUTE FUNCTION lookup_requests_touch();

COMMIT;
