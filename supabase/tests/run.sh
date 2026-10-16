#!/usr/bin/env bash
# Recria um banco de teste e executa migrações + seed + testes.
# Uso: PGHOST=localhost PGUSER=postgres bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-premium_car_teste}
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/00_stub_supabase.sql 2>&1 | grep -v -e wal_level -e HINT || true
for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f seed.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/01_testes.sql 2>&1 | grep -E "ok - |FALHOU|==|ERROR" | sed -E 's/^(psql:[^ ]* )?NOTICE:  /  /'
