#!/bin/sh
# Two roles (LLD §3): dk_owner runs migrations and owns tables; dk_app is the runtime role,
# never superuser and never BYPASSRLS, so row-level security always applies to it.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE dk_owner LOGIN PASSWORD '${DK_OWNER_PASSWORD}' NOSUPERUSER NOCREATEROLE NOCREATEDB;
CREATE ROLE dk_app   LOGIN PASSWORD '${DK_APP_PASSWORD}'   NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
ALTER DATABASE "$POSTGRES_DB" OWNER TO dk_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO dk_owner;
GRANT USAGE ON SCHEMA public TO dk_app;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL
