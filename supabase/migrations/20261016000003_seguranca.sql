-- =====================================================================
-- Premium Car · 03 — Segurança: Row Level Security, Storage e Realtime
-- Sistema interno: o papel anônimo não acessa nenhum dado.
-- =====================================================================

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Usuários e funcionários
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_active_user());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy employees_select on public.employees for select to authenticated using (public.is_active_user());
create policy employees_admin on public.employees for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Configurações
create policy settings_select on public.company_settings for select to authenticated using (public.is_active_user());
create policy settings_update on public.company_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy hours_select on public.business_hours for select to authenticated using (public.is_active_user());
create policy hours_admin on public.business_hours for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Clientes e veículos: sem exclusão física (desativação preserva o histórico)
create policy customers_select on public.customers for select to authenticated using (public.is_active_user());
create policy customers_insert on public.customers for insert to authenticated with check (public.has_perm('customers'));
create policy customers_update on public.customers for update to authenticated
  using (public.has_perm('customers')) with check (public.has_perm('customers'));

create policy vehicles_select on public.vehicles for select to authenticated using (public.is_active_user());
create policy vehicles_insert on public.vehicles for insert to authenticated with check (public.has_perm('customers'));
create policy vehicles_update on public.vehicles for update to authenticated
  using (public.has_perm('customers')) with check (public.has_perm('customers'));

-- Catálogo e formas de pagamento
create policy services_select on public.services for select to authenticated using (public.is_active_user());
create policy services_admin on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy methods_select on public.payment_methods for select to authenticated using (public.is_active_user());
create policy methods_admin on public.payment_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Ordens de serviço: funcionário sem "ver todas" acessa apenas as atribuídas
create policy orders_select on public.service_orders for select to authenticated using (public.can_access_order(id));
create policy orders_insert on public.service_orders for insert to authenticated with check (public.is_active_user());
create policy orders_update on public.service_orders for update to authenticated
  using (public.can_access_order(id)) with check (public.can_access_order(id));

create policy items_select on public.service_order_items for select to authenticated using (public.can_access_order(order_id));
create policy items_insert on public.service_order_items for insert to authenticated with check (public.can_access_order(order_id));
create policy items_update on public.service_order_items for update to authenticated
  using (public.can_access_order(order_id)) with check (public.can_access_order(order_id));
create policy items_delete on public.service_order_items for delete to authenticated using (public.can_access_order(order_id));

-- Histórico e linha do tempo: somente leitura (gravados por gatilhos e funções)
create policy history_select on public.order_status_history for select to authenticated using (public.can_access_order(order_id));
create policy events_select on public.order_events for select to authenticated using (public.can_access_order(order_id));

create policy photos_select on public.order_photos for select to authenticated using (public.can_access_order(order_id));
create policy photos_insert on public.order_photos for insert to authenticated with check (public.can_access_order(order_id));

-- Pagamentos: leitura para quem registra pagamentos; gravação apenas pelas funções
create policy payments_select on public.payments for select to authenticated
  using (public.has_perm('payments') and public.can_access_order(order_id));

-- Agenda: criação e reagendamento pelas funções (que verificam conflitos)
create policy appointments_select on public.appointments for select to authenticated using (public.is_active_user());
create policy appointments_update on public.appointments for update to authenticated
  using (public.is_active_user()) with check (public.is_active_user());
create policy appt_services_select on public.appointment_services for select to authenticated using (public.is_active_user());

-- Auditoria
create policy audit_select on public.audit_log for select to authenticated using (public.is_admin());

-- =====================================================================
-- Storage: fotos em bucket privado, caminho orders/<id-da-OS>/<arquivo>
-- =====================================================================
create or replace function public.order_id_from_path(p_name text) returns uuid
language sql immutable as $$
  select case when p_name ~ '^orders/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then substring(p_name from 8 for 36)::uuid end;
$$;
grant execute on function public.order_id_from_path(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-photos', 'order-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "fotos da OS: leitura" on storage.objects for select to authenticated
  using (bucket_id = 'order-photos' and public.can_access_order(public.order_id_from_path(name)));
create policy "fotos da OS: envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-photos' and public.can_access_order(public.order_id_from_path(name)));
-- Sem update/delete: o sistema não apaga fotos (remoção lógica na OS).

-- =====================================================================
-- Realtime (respeita RLS): "Veículos na Empresa" e OS atualizam entre usuários
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.service_orders, public.order_events, public.service_order_items, public.appointments;
  end if;
end $$;
