#!/usr/bin/env bash
# 6 agendamentos simultâneos no mesmo horário com 3 boxes: devem ser aceitos exatamente 3.
# Execute depois de supabase/tests/run.sh (usa os dados criados pelos testes).
set -uo pipefail
export PGDATABASE=${TEST_DB:-premium_car_teste}
Q="set role authenticated;
select set_config('request.jwt.claims', '{\"sub\":\"b0000000-0000-0000-0000-000000000001\",\"role\":\"authenticated\"}', false);
select 'OK:' || public.create_appointment(
  (select id from public.customers where document = '52998224725'),
  (select id from public.vehicles where plate = 'ABC1234'),
  ((date_trunc('week', now() at time zone 'America/Sao_Paulo'))::date + 10 + time '09:00') at time zone 'America/Sao_Paulo',
  array[(select id from public.services where name = 'Enceramento')]);"
TMP=$(mktemp -d)
for i in 1 2 3 4 5 6; do (psql -qAt -c "$Q" >"$TMP/$i" 2>&1) & done
wait
OK=$(grep -l '^OK:' "$TMP"/* | wc -l)
echo "Aceitos: $OK de 6 (esperado: 3)"
[ "$OK" -eq 3 ] && echo "ok - agenda sem excesso de reservas em pedidos simultâneos" || { echo "FALHOU"; exit 1; }
