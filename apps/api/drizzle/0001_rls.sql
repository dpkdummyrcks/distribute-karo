-- Row-level security, grants and triggers (LLD §3). Runs as dk_owner.
-- Every tenant table is filtered by app.distributor_id, which withTenant() sets per transaction
-- with set_config(..., true). A missing setting resolves to NULL, so queries see no rows
-- instead of erroring. FORCE applies the policies to the table owner too.

CREATE OR REPLACE FUNCTION app_current_distributor() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.distributor_id', true), '')::uuid $$;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['items', 'stock_movements', 'storefronts', 'delivery_zones', 'retailers',
                           'access_requests', 'enquiries', 'orders', 'order_items', 'order_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (distributor_id = app_current_distributor()) WITH CHECK (distributor_id = app_current_distributor())', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- updated_at maintenance
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['distributors', 'password_reset_codes', 'items', 'retailers', 'orders', 'order_items',
                           'storefronts', 'delivery_zones', 'access_requests', 'enquiries', 'sessions']
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Name search (pg_trgm is created by the database init script)
CREATE INDEX items_name_trgm_idx ON items USING gin (name gin_trgm_ops);
--> statement-breakpoint

-- Runtime role: data access only, no DDL. Ledgers are append-only.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dk_app;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON stock_movements, order_events FROM dk_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE dk_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dk_app;
