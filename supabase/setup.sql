-- Premium Car · instalação completa (gerado a partir de supabase/migrations + seed.sql)
-- Cole tudo no SQL Editor do Supabase e execute uma única vez.

-- >>> supabase/migrations/20261016000001_esquema.sql
-- =====================================================================
-- Premium Car · Sistema de gestão interna
-- 01 — Esquema: tipos, tabelas, relacionamentos e índices
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'employee');
create type public.person_type as enum ('PF', 'PJ');
create type public.vehicle_type as enum ('carro', 'suv', 'picape', 'utilitario', 'van', 'moto', 'caminhao', 'outro');
create type public.order_status as enum (
  'received',         -- 1. Recebido
  'evaluation',       -- 2. Em avaliação
  'waiting',          -- 3. Aguardando início
  'in_progress',      -- 4. Em execução
  'quality_control',  -- 5. Em controle de qualidade
  'completed',        -- 6. Concluído
  'awaiting_pickup',  -- 7. Aguardando retirada
  'delivered',        -- 8. Entregue
  'cancelled'         -- 9. Cancelado
);
create type public.item_status as enum ('pending', 'in_progress', 'done');
create type public.payment_status as enum ('pending', 'partial', 'paid', 'refunded');
create type public.payment_entry_status as enum ('confirmed', 'refunded');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'cancelled', 'no_show', 'converted');
create type public.photo_kind as enum ('entry', 'damage', 'progress', 'final');

-- ---------------------------------------------------------------------
-- Usuários do sistema (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '',
  email             text,
  role              public.user_role not null default 'employee',
  active            boolean not null default false,          -- só acessa depois de liberado por um admin
  perm_customers    boolean not null default true,           -- cadastrar e editar clientes/veículos
  perm_all_orders   boolean not null default true,           -- ver todas as OS (senão, só as atribuídas)
  perm_payments     boolean not null default false,          -- registrar pagamentos
  perm_discounts    boolean not null default false,          -- alterar preços do catálogo e dar descontos
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funcionários (com ou sem login)
-- ---------------------------------------------------------------------
create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid unique references public.profiles (id) on delete set null,
  full_name   text not null check (char_length(trim(full_name)) between 2 and 120),
  job_title   text,
  phone       text check (phone is null or phone ~ '^\d{10,13}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Configurações da empresa
-- ---------------------------------------------------------------------
create table public.company_settings (
  id             int primary key default 1 check (id = 1),
  company_name   text not null default 'Premium Car',
  legal_name     text,
  cnpj           text check (cnpj is null or cnpj ~ '^\d{14}$'),
  phone          text,
  whatsapp       text,
  email          text,
  address        text,
  city           text,
  timezone       text not null default 'America/Sao_Paulo',
  bays           int not null default 3 check (bays between 1 and 100),          -- veículos em atendimento simultâneo
  slot_minutes   int not null default 30 check (slot_minutes between 5 and 240),
  order_terms    text,                                                           -- texto impresso na OS
  updated_at     timestamptz not null default now()
);

create table public.business_hours (
  weekday     smallint primary key check (weekday between 0 and 6),             -- 0 = domingo
  is_open     boolean not null default true,
  open_time   time not null default '08:00',
  close_time  time not null default '18:00',
  check (close_time > open_time)
);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.customers (
  id                   uuid primary key default gen_random_uuid(),
  person_type          public.person_type not null default 'PF',
  full_name            text not null check (char_length(trim(full_name)) between 2 and 160),
  document             text check (document is null or document ~ '^(\d{11}|\d{14})$'),   -- CPF/CNPJ (dígitos)
  phone                text check (phone is null or phone ~ '^\d{10,13}$'),
  whatsapp             text check (whatsapp is null or whatsapp ~ '^\d{10,13}$'),
  email                text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  zip_code             text check (zip_code is null or zip_code ~ '^\d{8}$'),
  street               text,
  number               text,
  complement           text,
  district             text,
  city                 text,
  state                text check (state is null or state ~ '^[A-Z]{2}$'),
  notes                text,                                                     -- observações internas
  active               boolean not null default true,
  deactivated_at       timestamptz,
  deactivated_by       uuid references public.profiles (id) on delete set null,
  deactivation_reason  text,
  anonymized_at        timestamptz,
  created_by           uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint customers_contact_required check (phone is not null or whatsapp is not null or email is not null or anonymized_at is not null)
);
create unique index customers_document_key on public.customers (document) where document is not null;
create index customers_name_idx on public.customers (lower(full_name));
create index customers_phone_idx on public.customers (phone);
create index customers_whatsapp_idx on public.customers (whatsapp);
create index customers_email_idx on public.customers (lower(email));
create index customers_created_idx on public.customers (created_at desc);

-- ---------------------------------------------------------------------
-- Veículos
-- ---------------------------------------------------------------------
create table public.vehicles (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete restrict,
  plate             text check (plate is null or plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),  -- ABC1234 ou Mercosul ABC1D23
  brand             text not null check (char_length(trim(brand)) between 1 and 60),
  model             text not null check (char_length(trim(model)) between 1 and 80),
  manufacture_year  int check (manufacture_year is null or manufacture_year between 1900 and 2100),
  model_year        int check (model_year is null or model_year between 1900 and 2100),
  color             text,
  vehicle_type      public.vehicle_type not null default 'carro',
  mileage_km        int check (mileage_km is null or mileage_km >= 0),
  notes             text,
  active            boolean not null default true,
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint vehicles_years check (model_year is null or manufacture_year is null or model_year between manufacture_year and manufacture_year + 1)
);
create unique index vehicles_plate_key on public.vehicles (plate) where plate is not null and active;
create index vehicles_customer_idx on public.vehicles (customer_id);
create index vehicles_model_idx on public.vehicles (lower(brand), lower(model));

-- ---------------------------------------------------------------------
-- Catálogo de serviços e formas de pagamento
-- ---------------------------------------------------------------------
create table public.services (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(trim(name)) between 2 and 100),
  description        text,
  category           text not null default 'Geral',
  default_price      numeric(10, 2) not null default 0 check (default_price >= 0),
  price_reviewed     boolean not null default false,   -- falso = preço de exemplo ainda não revisado pela empresa
  estimated_minutes  int not null default 60 check (estimated_minutes between 5 and 10080),
  active             boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index services_name_key on public.services (lower(name));

create table public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  sort_order  int not null default 0
);
create unique index payment_methods_name_key on public.payment_methods (lower(name));

-- ---------------------------------------------------------------------
-- Agenda interna
-- ---------------------------------------------------------------------
create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete restrict,
  vehicle_id        uuid not null references public.vehicles (id) on delete restrict,
  employee_id       uuid references public.employees (id) on delete set null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            public.appointment_status not null default 'scheduled',
  channel           text not null default 'telefone' check (channel in ('telefone', 'whatsapp', 'presencial', 'outro')),
  notes             text,
  cancel_reason     text,
  service_order_id  uuid unique,                       -- FK adicionada após service_orders
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  -- O mesmo funcionário não pode ter compromissos ativos sobrepostos
  constraint appointments_employee_overlap exclude using gist (
    employee_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (employee_id is not null and status in ('scheduled', 'confirmed'))
);
create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_customer_idx on public.appointments (customer_id);

create table public.appointment_services (
  appointment_id     uuid not null references public.appointments (id) on delete cascade,
  service_id         uuid not null references public.services (id) on delete restrict,
  name               text not null,
  price              numeric(10, 2) not null default 0,
  estimated_minutes  int not null default 60,
  primary key (appointment_id, service_id)
);

-- ---------------------------------------------------------------------
-- Ordens de serviço
-- ---------------------------------------------------------------------
create table public.service_orders (
  id                 uuid primary key default gen_random_uuid(),
  number             bigint generated always as identity (start with 1001) unique,
  customer_id        uuid not null references public.customers (id) on delete restrict,
  vehicle_id         uuid not null references public.vehicles (id) on delete restrict,
  appointment_id     uuid unique references public.appointments (id) on delete set null,
  responsible_id     uuid references public.employees (id) on delete set null,
  status             public.order_status not null default 'received',
  entered_at         timestamptz not null default now(),
  expected_at        timestamptz,
  completed_at       timestamptz,
  delivered_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  mileage_km         int check (mileage_km is null or mileage_km >= 0),
  fuel_level         text,
  initial_condition  text,
  damages            text,
  notes              text,
  subtotal           numeric(12, 2) not null default 0,
  discount           numeric(12, 2) not null default 0 check (discount >= 0),
  total              numeric(12, 2) not null default 0,
  amount_paid        numeric(12, 2) not null default 0,
  payment_status     public.payment_status not null default 'pending',
  created_by         uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index service_orders_status_idx on public.service_orders (status);
create index service_orders_customer_idx on public.service_orders (customer_id);
create index service_orders_vehicle_idx on public.service_orders (vehicle_id);
create index service_orders_responsible_idx on public.service_orders (responsible_id);
create index service_orders_entered_idx on public.service_orders (entered_at desc);
create index service_orders_open_idx on public.service_orders (entered_at) where status not in ('delivered', 'cancelled');
-- Um veículo só pode ter uma OS em aberto
create unique index service_orders_one_open_per_vehicle on public.service_orders (vehicle_id) where status not in ('delivered', 'cancelled');

alter table public.appointments
  add constraint appointments_service_order_fk foreign key (service_order_id) references public.service_orders (id) on delete set null;

create table public.service_order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.service_orders (id) on delete cascade,
  service_id   uuid references public.services (id) on delete set null,
  description  text not null check (char_length(trim(description)) between 2 and 160),
  quantity     numeric(8, 2) not null default 1 check (quantity > 0),
  unit_price   numeric(10, 2) not null default 0 check (unit_price >= 0),
  discount     numeric(10, 2) not null default 0 check (discount >= 0),
  line_total   numeric(12, 2) generated always as (round(quantity * unit_price - discount, 2)) stored,
  status       public.item_status not null default 'pending',
  employee_id  uuid references public.employees (id) on delete set null,         -- quem executa
  started_at   timestamptz,
  finished_at  timestamptz,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint items_discount_le_value check (round(quantity * unit_price - discount, 2) >= 0)
);
create index items_order_idx on public.service_order_items (order_id);
create index items_service_idx on public.service_order_items (service_id);
create index items_employee_idx on public.service_order_items (employee_id);

-- Histórico de status (auditoria das mudanças de andamento)
create table public.order_status_history (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.service_orders (id) on delete cascade,
  from_status  public.order_status,
  to_status    public.order_status not null,
  changed_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  changed_at   timestamptz not null default now()
);
create index status_history_order_idx on public.order_status_history (order_id, changed_at);

-- Linha do tempo da OS (somente inclusão)
create table public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.service_orders (id) on delete cascade,
  kind        text not null check (kind in ('created', 'status', 'item_added', 'item_updated', 'item_removed', 'note', 'photo',
                                            'photo_removed', 'forecast', 'discount', 'responsible', 'payment', 'refund', 'updated')),
  message     text not null,
  data        jsonb,
  actor_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.order_photos (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.service_orders (id) on delete cascade,
  storage_path  text not null unique,
  kind          public.photo_kind not null default 'entry',
  caption       text,
  removed_at    timestamptz,                    -- remoção lógica: o arquivo é preservado
  removed_by    uuid references public.profiles (id) on delete set null,
  uploaded_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index order_photos_order_idx on public.order_photos (order_id);

-- ---------------------------------------------------------------------
-- Pagamentos (dinheiro efetivamente recebido)
-- ---------------------------------------------------------------------
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.service_orders (id) on delete restrict,
  amount         numeric(12, 2) not null check (amount > 0),
  method_id      uuid not null references public.payment_methods (id) on delete restrict,
  paid_at        timestamptz not null default now(),
  status         public.payment_entry_status not null default 'confirmed',
  notes          text,
  refunded_at    timestamptz,
  refunded_by    uuid references public.profiles (id) on delete set null,
  refund_reason  text,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_paid_idx on public.payments (paid_at);
create index payments_refunded_idx on public.payments (refunded_at) where refunded_at is not null;

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_entity_idx on public.audit_log (entity, entity_id);
create index audit_created_idx on public.audit_log (created_at desc);

-- >>> supabase/migrations/20261016000002_regras.sql
-- =====================================================================
-- Premium Car · 02 — Regras de negócio: funções e gatilhos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identidade e permissões
-- ---------------------------------------------------------------------
create or replace function public.request_role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
$$;

create or replace function public.is_service_role() returns boolean
language sql stable as $$ select public.request_role() = 'service_role'; $$;

-- Sem usuário na requisição = operação do servidor (service_role) ou do SQL Editor.
create or replace function public.is_privileged() returns boolean
language sql stable as $$ select auth.uid() is null; $$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;

-- customers | all_orders | payments | discounts
create or replace function public.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.active and (p.role = 'admin' or case p_perm
      when 'customers' then p.perm_customers
      when 'all_orders' then p.perm_all_orders
      when 'payments' then p.perm_payments
      when 'discounts' then p.perm_discounts
      else false end)
    from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.my_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.employees where profile_id = auth.uid() limit 1;
$$;

-- Acesso a uma OS: quem vê todas, ou o responsável/executor/criador
create or replace function public.can_access_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_order_id is not null and (
    public.has_perm('all_orders') or (
      public.is_active_user() and exists (
        select 1 from public.service_orders o
         where o.id = p_order_id and (
               o.responsible_id = public.my_employee_id()
            or o.created_by = auth.uid()
            or exists (select 1 from public.service_order_items i where i.order_id = o.id and i.employee_id = public.my_employee_id())))));
$$;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------
create or replace function public.only_digits(p text) returns text
language sql immutable as $$ select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), ''); $$;

create or replace function public.company_tz() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select timezone from public.company_settings where id = 1), 'America/Sao_Paulo');
$$;

create or replace function public.local_day_start(p date) returns timestamptz
language sql stable as $$ select p::timestamp at time zone public.company_tz(); $$;

create or replace function public.fmt_money(p numeric) returns text
language sql immutable as $$ select 'R$ ' || replace(to_char(coalesce(p, 0), 'FM999999990.00'), '.', ','); $$;

create or replace function public.status_label(p public.order_status) returns text
language sql immutable as $$
  select case p when 'received' then 'Recebido' when 'evaluation' then 'Em avaliação' when 'waiting' then 'Aguardando início'
    when 'in_progress' then 'Em execução' when 'quality_control' then 'Em controle de qualidade' when 'completed' then 'Concluído'
    when 'awaiting_pickup' then 'Aguardando retirada' when 'delivered' then 'Entregue' when 'cancelled' then 'Cancelado' end;
$$;

-- ---------------------------------------------------------------------
-- updated_at e auditoria
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('de', to_jsonb(old) -> n.key, 'para', n.value)) into v
      from jsonb_each(to_jsonb(new)) n
     where (to_jsonb(old) -> n.key) is distinct from n.value and n.key <> 'updated_at';
    if v is null then return new; end if;
  else
    v := to_jsonb(coalesce(new, old));
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, to_jsonb(coalesce(new, old)) ->> 'id', v);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'employees', 'customers', 'vehicles', 'services', 'appointments', 'service_orders', 'company_settings'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
  foreach t in array array['profiles', 'employees', 'customers', 'vehicles', 'services', 'payment_methods', 'company_settings', 'business_hours', 'appointments'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)), lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.guard_profile() returns trigger
language plpgsql set search_path = public as $$
begin
  if not (public.is_admin() or public.is_privileged()) and (
       new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email
    or (new.perm_customers, new.perm_all_orders, new.perm_payments, new.perm_discounts)
       is distinct from (old.perm_customers, old.perm_all_orders, old.perm_payments, old.perm_discounts)) then
    raise exception 'Somente administradores podem alterar acesso e permissões.' using errcode = '42501';
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and (select count(*) from public.profiles where role = 'admin' and active) <= 1 then
    raise exception 'O sistema precisa de pelo menos um administrador ativo.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- ---------------------------------------------------------------------
-- Clientes e veículos
-- ---------------------------------------------------------------------
create or replace function public.customers_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.active is distinct from old.active then
    if not new.active then
      if exists (select 1 from public.service_orders where customer_id = new.id and status not in ('delivered', 'cancelled')) then
        raise exception 'O cliente possui ordens de serviço em aberto.' using errcode = 'P0001';
      end if;
      new.deactivated_at := now();
      new.deactivated_by := auth.uid();
    else
      new.deactivated_at := null; new.deactivated_by := null; new.deactivation_reason := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger customers_before before update on public.customers for each row execute function public.customers_before_update();

create or replace function public.vehicles_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.active is distinct from old.active and not new.active
     and exists (select 1 from public.service_orders where vehicle_id = new.id and status not in ('delivered', 'cancelled')) then
    raise exception 'O veículo possui uma ordem de serviço em aberto.' using errcode = 'P0001';
  end if;
  if new.customer_id is distinct from old.customer_id
     and exists (select 1 from public.service_orders where vehicle_id = new.id and status not in ('delivered', 'cancelled')) then
    raise exception 'Conclua a OS em aberto antes de transferir o veículo.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger vehicles_before before update on public.vehicles for each row execute function public.vehicles_before_update();

-- Possíveis duplicados de um cadastro (aviso antes de salvar)
create or replace function public.find_customer_duplicates(
  p_name text, p_document text default null, p_phone text default null, p_email text default null, p_ignore uuid default null
) returns table (id uuid, full_name text, document text, phone text, whatsapp text, email text, active boolean, reason text)
language sql stable security invoker set search_path = public as $$
  select c.id, c.full_name, c.document, c.phone, c.whatsapp, c.email, c.active,
         concat_ws(', ',
           case when public.only_digits(p_document) is not null and c.document = public.only_digits(p_document) then 'mesmo CPF/CNPJ' end,
           case when public.only_digits(p_phone) is not null and public.only_digits(p_phone) in (c.phone, c.whatsapp) then 'mesmo telefone' end,
           case when nullif(trim(p_email), '') is not null and lower(c.email) = lower(trim(p_email)) then 'mesmo e-mail' end,
           case when lower(trim(c.full_name)) = lower(trim(p_name)) then 'mesmo nome' end)
    from public.customers c
   where (p_ignore is null or c.id <> p_ignore) and c.anonymized_at is null
     and ((public.only_digits(p_document) is not null and c.document = public.only_digits(p_document))
       or (public.only_digits(p_phone) is not null and public.only_digits(p_phone) in (c.phone, c.whatsapp))
       or (nullif(trim(p_email), '') is not null and lower(c.email) = lower(trim(p_email)))
       or (char_length(trim(coalesce(p_name, ''))) >= 5 and lower(trim(c.full_name)) = lower(trim(p_name))))
   order by c.full_name
   limit 10;
$$;

-- Pares de cadastros que parecem ser a mesma pessoa
create or replace function public.possible_duplicate_customers()
returns table (a_id uuid, a_name text, a_contact text, b_id uuid, b_name text, b_contact text, reason text)
language sql stable security invoker set search_path = public as $$
  select a.id, a.full_name, coalesce(a.phone, a.whatsapp, a.email), b.id, b.full_name, coalesce(b.phone, b.whatsapp, b.email),
         concat_ws(', ',
           case when (a.phone is not null and a.phone in (b.phone, b.whatsapp)) or (a.whatsapp is not null and a.whatsapp in (b.phone, b.whatsapp)) then 'telefone' end,
           case when a.email is not null and lower(a.email) = lower(b.email) then 'e-mail' end,
           case when lower(trim(a.full_name)) = lower(trim(b.full_name)) then 'nome' end)
    from public.customers a
    join public.customers b on a.id < b.id
   where a.anonymized_at is null and b.anonymized_at is null
     and ((a.phone is not null and a.phone in (b.phone, b.whatsapp))
       or (a.whatsapp is not null and a.whatsapp in (b.phone, b.whatsapp))
       or (a.email is not null and lower(a.email) = lower(b.email))
       or lower(trim(a.full_name)) = lower(trim(b.full_name)))
   order by a.full_name
   limit 200;
$$;

-- LGPD: remove dados pessoais preservando o histórico operacional e financeiro
create or replace function public.anonymize_customer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Somente administradores.' using errcode = '42501'; end if;
  if exists (select 1 from public.service_orders where customer_id = p_id and status not in ('delivered', 'cancelled')) then
    raise exception 'O cliente possui ordens de serviço em aberto.' using errcode = 'P0001';
  end if;
  update public.customers
     set full_name = 'Cliente anonimizado', document = null, phone = null, whatsapp = null, email = null, zip_code = null,
         street = null, number = null, complement = null, district = null, city = null, state = null, notes = null,
         anonymized_at = now(), active = false, deactivation_reason = 'Anonimização (LGPD)'
   where id = p_id;
  update public.vehicles set notes = null where customer_id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Ordens de serviço: totais
-- ---------------------------------------------------------------------
create or replace function public.recalc_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_sub numeric(12, 2); v_paid numeric(12, 2); v_ref boolean;
begin
  select coalesce(sum(line_total), 0) into v_sub from public.service_order_items where order_id = p_order_id;
  select coalesce(sum(amount) filter (where status = 'confirmed'), 0), coalesce(bool_or(status = 'refunded'), false)
    into v_paid, v_ref from public.payments where order_id = p_order_id;
  update public.service_orders o
     set subtotal = v_sub,
         total = greatest(v_sub - o.discount, 0),
         amount_paid = v_paid,
         payment_status = (case
           when greatest(v_sub - o.discount, 0) > 0 and v_paid >= greatest(v_sub - o.discount, 0) then 'paid'
           when v_paid > 0 then 'partial'
           when v_ref then 'refunded'
           else 'pending' end)::public.payment_status
   where o.id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Ordens de serviço: regras e linha do tempo
-- ---------------------------------------------------------------------
create or replace function public.orders_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_power boolean := public.is_admin() or public.is_privileged();
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.vehicles v where v.id = new.vehicle_id and v.customer_id = new.customer_id) then
      raise exception 'O veículo não pertence a este cliente.' using errcode = 'P0001';
    end if;
    if new.discount > 0 and not (v_power or public.has_perm('discounts')) then
      raise exception 'Você não tem permissão para conceder descontos.' using errcode = '42501';
    end if;
    new.subtotal := 0; new.total := 0; new.amount_paid := 0; new.payment_status := 'pending';
    new.completed_at := null; new.delivered_at := null; new.cancelled_at := null;
    return new;
  end if;

  if pg_trigger_depth() <= 1 then
    -- Valores financeiros só mudam pelo recálculo interno
    new.subtotal := old.subtotal; new.total := old.total; new.amount_paid := old.amount_paid; new.payment_status := old.payment_status;
    if old.status in ('delivered', 'cancelled') and not v_power then
      raise exception 'OS encerrada. Somente administradores podem alterá-la.' using errcode = '42501';
    end if;
  end if;

  if (new.customer_id, new.vehicle_id) is distinct from (old.customer_id, old.vehicle_id) then
    raise exception 'Cliente e veículo não podem ser trocados. Cancele e abra outra OS.' using errcode = 'P0001';
  end if;
  if new.discount is distinct from old.discount and not (v_power or public.has_perm('discounts')) then
    raise exception 'Você não tem permissão para conceder descontos.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      if nullif(trim(coalesce(new.cancel_reason, '')), '') is null then
        raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
      end if;
      if exists (select 1 from public.payments where order_id = new.id and status = 'confirmed') then
        raise exception 'Estorne os pagamentos antes de cancelar a OS.' using errcode = 'P0001';
      end if;
      new.cancelled_at := now();
    else
      new.cancelled_at := null;
      new.cancel_reason := null;
    end if;
    if new.status in ('completed', 'awaiting_pickup', 'delivered') then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
    new.delivered_at := case when new.status = 'delivered' then now() end;
  end if;
  return new;
end;
$$;

create or replace function public.orders_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tz text := public.company_tz();
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status) values (new.id, null, new.status);
    insert into public.order_events (order_id, kind, message)
    values (new.id, 'created', 'OS aberta · entrada do veículo em ' || to_char(new.entered_at at time zone v_tz, 'DD/MM/YYYY HH24:MI'));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status) values (new.id, old.status, new.status);
    insert into public.order_events (order_id, kind, message, data)
    values (new.id, 'status',
            public.status_label(old.status) || ' → ' || public.status_label(new.status)
              || case when new.status = 'cancelled' then ' · motivo: ' || new.cancel_reason
                      when new.status = 'delivered' then ' · saída registrada às ' || to_char(new.delivered_at at time zone v_tz, 'HH24:MI')
                      else '' end,
            jsonb_build_object('de', old.status, 'para', new.status));
  end if;
  if new.expected_at is distinct from old.expected_at then
    insert into public.order_events (order_id, kind, message, data)
    values (new.id, 'forecast',
            'Previsão de conclusão: ' || coalesce(to_char(old.expected_at at time zone v_tz, 'DD/MM HH24:MI'), 'sem previsão')
              || ' → ' || coalesce(to_char(new.expected_at at time zone v_tz, 'DD/MM HH24:MI'), 'sem previsão'),
            jsonb_build_object('de', old.expected_at, 'para', new.expected_at));
  end if;
  if new.discount is distinct from old.discount then
    perform public.recalc_order(new.id);
    insert into public.order_events (order_id, kind, message, data)
    values (new.id, 'discount', 'Desconto na OS: ' || public.fmt_money(old.discount) || ' → ' || public.fmt_money(new.discount),
            jsonb_build_object('de', old.discount, 'para', new.discount));
  end if;
  if new.responsible_id is distinct from old.responsible_id then
    insert into public.order_events (order_id, kind, message, data)
    values (new.id, 'responsible', 'Responsável: ' || coalesce((select full_name from public.employees where id = new.responsible_id), 'nenhum'),
            jsonb_build_object('de', old.responsible_id, 'para', new.responsible_id));
  end if;
  if (new.initial_condition, new.damages, new.notes, new.mileage_km, new.fuel_level)
     is distinct from (old.initial_condition, old.damages, old.notes, old.mileage_km, old.fuel_level) then
    insert into public.order_events (order_id, kind, message, data)
    values (new.id, 'updated', 'Dados de entrada/observações alterados',
            jsonb_build_object(
              'de', jsonb_build_object('estado_inicial', old.initial_condition, 'avarias', old.damages, 'observacoes', old.notes, 'km', old.mileage_km, 'combustivel', old.fuel_level),
              'para', jsonb_build_object('estado_inicial', new.initial_condition, 'avarias', new.damages, 'observacoes', new.notes, 'km', new.mileage_km, 'combustivel', new.fuel_level)));
  end if;
  return new;
end;
$$;

create trigger orders_before before insert or update on public.service_orders for each row execute function public.orders_before();
create trigger orders_after after insert or update on public.service_orders for each row execute function public.orders_after();

-- Itens da OS
create or replace function public.items_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_status public.order_status;
  v_default numeric(10, 2);
  v_power boolean := public.is_admin() or public.is_privileged();
begin
  select status into v_status from public.service_orders where id = coalesce(new.order_id, old.order_id);
  if v_status in ('delivered', 'cancelled') and not v_power then
    raise exception 'OS encerrada: os serviços não podem ser alterados.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if not (v_power or public.has_perm('discounts')) then
    if new.discount > 0 and (tg_op = 'INSERT' or new.discount is distinct from old.discount) then
      raise exception 'Você não tem permissão para conceder descontos.' using errcode = '42501';
    end if;
    if new.service_id is not null and (tg_op = 'INSERT' or new.unit_price is distinct from old.unit_price or new.service_id is distinct from old.service_id) then
      select default_price into v_default from public.services where id = new.service_id;
      if new.unit_price is distinct from v_default then
        raise exception 'Você não tem permissão para alterar o preço de serviços do catálogo.' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'pending' then new.started_at := null; new.finished_at := null; end if;
    if new.status = 'in_progress' then new.started_at := coalesce(new.started_at, now()); new.finished_at := null; end if;
    if new.status = 'done' then new.started_at := coalesce(new.started_at, now()); new.finished_at := now(); end if;
  elsif tg_op = 'INSERT' and new.status <> 'pending' then
    new.started_at := coalesce(new.started_at, now());
    if new.status = 'done' then new.finished_at := now(); end if;
  end if;
  return new;
end;
$$;

create or replace function public.items_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_msg text;
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, kind, message, data)
    values (new.order_id, 'item_added', 'Serviço incluído: ' || new.description || ' · ' || public.fmt_money(new.line_total), to_jsonb(new));
  elsif tg_op = 'DELETE' then
    insert into public.order_events (order_id, kind, message, data)
    values (old.order_id, 'item_removed', 'Serviço removido: ' || old.description || ' · ' || public.fmt_money(old.line_total), to_jsonb(old));
  else
    v_msg := concat_ws('; ',
      case when new.status is distinct from old.status then
        case new.status when 'pending' then 'voltou para pendente' when 'in_progress' then 'iniciado' else 'concluído' end end,
      case when new.unit_price is distinct from old.unit_price then 'preço ' || public.fmt_money(old.unit_price) || ' → ' || public.fmt_money(new.unit_price) end,
      case when new.discount is distinct from old.discount then 'desconto ' || public.fmt_money(old.discount) || ' → ' || public.fmt_money(new.discount) end,
      case when new.quantity is distinct from old.quantity then 'quantidade ' || old.quantity || ' → ' || new.quantity end,
      case when new.employee_id is distinct from old.employee_id then
        'executor: ' || coalesce((select full_name from public.employees where id = new.employee_id), 'nenhum') end,
      case when new.description is distinct from old.description then 'descrição alterada' end);
    if coalesce(v_msg, '') = '' then return new; end if;
    insert into public.order_events (order_id, kind, message, data)
    values (new.order_id, 'item_updated', new.description || ': ' || v_msg, jsonb_build_object('de', to_jsonb(old), 'para', to_jsonb(new)));
  end if;
  perform public.recalc_order(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end;
$$;

create trigger items_before before insert or update or delete on public.service_order_items for each row execute function public.items_before();
create trigger items_after after insert or update or delete on public.service_order_items for each row execute function public.items_after();

-- Fotos
create or replace function public.photos_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_kind text;
begin
  v_kind := case new.kind when 'entry' then 'entrada' when 'damage' then 'avaria' when 'progress' then 'andamento' else 'finalização' end;
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, kind, message, data)
    values (new.order_id, 'photo', 'Foto anexada (' || v_kind || ')' || coalesce(': ' || new.caption, ''), jsonb_build_object('photo_id', new.id));
  elsif new.removed_at is not null and old.removed_at is null then
    insert into public.order_events (order_id, kind, message, data)
    values (new.order_id, 'photo_removed', 'Foto retirada da OS (' || v_kind || ')' || coalesce(': ' || new.caption, ''), jsonb_build_object('photo_id', new.id));
  end if;
  return new;
end;
$$;
create trigger photos_after after insert or update on public.order_photos for each row execute function public.photos_after();

-- ---------------------------------------------------------------------
-- Operações da OS
-- ---------------------------------------------------------------------
-- Abre a OS com itens numa única transação. p_items: [{service_id?, description?, quantity?, unit_price?, discount?, employee_id?}]
create or replace function public.open_service_order(
  p_customer_id uuid, p_vehicle_id uuid, p_items jsonb,
  p_responsible_id uuid default null, p_expected_at timestamptz default null, p_mileage_km int default null,
  p_fuel_level text default null, p_initial_condition text default null, p_damages text default null,
  p_notes text default null, p_discount numeric default 0, p_appointment_id uuid default null
) returns uuid
language plpgsql volatile security invoker set search_path = public as $$
declare v_id uuid; it jsonb; s public.services;
begin
  if not public.is_active_user() then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id and active) then
    raise exception 'Cliente inativo ou inexistente.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.vehicles where id = p_vehicle_id and customer_id = p_customer_id and active) then
    raise exception 'Veículo inválido para este cliente.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.service_orders where vehicle_id = p_vehicle_id and status not in ('delivered', 'cancelled')) then
    raise exception 'Este veículo já possui uma OS em aberto.' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inclua ao menos um serviço.' using errcode = 'P0001';
  end if;

  insert into public.service_orders (customer_id, vehicle_id, responsible_id, expected_at, mileage_km, fuel_level,
                                     initial_condition, damages, notes, discount, appointment_id)
  values (p_customer_id, p_vehicle_id, coalesce(p_responsible_id, public.my_employee_id()), p_expected_at, p_mileage_km,
          nullif(trim(p_fuel_level), ''), nullif(trim(p_initial_condition), ''), nullif(trim(p_damages), ''),
          nullif(trim(p_notes), ''), coalesce(p_discount, 0), p_appointment_id)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    s := null;
    if nullif(it ->> 'service_id', '') is not null then
      select * into s from public.services where id = (it ->> 'service_id')::uuid;
      if not found then raise exception 'Serviço não encontrado.' using errcode = 'P0001'; end if;
    end if;
    insert into public.service_order_items (order_id, service_id, description, quantity, unit_price, discount, employee_id)
    values (v_id, s.id, coalesce(nullif(trim(it ->> 'description'), ''), s.name),
            coalesce(nullif(it ->> 'quantity', '')::numeric, 1),
            coalesce(nullif(it ->> 'unit_price', '')::numeric, s.default_price, 0),
            coalesce(nullif(it ->> 'discount', '')::numeric, 0),
            nullif(it ->> 'employee_id', '')::uuid);
  end loop;

  if p_appointment_id is not null then
    update public.appointments set status = 'converted', service_order_id = v_id
     where id = p_appointment_id and status in ('scheduled', 'confirmed');
    if not found then raise exception 'Agendamento indisponível para conversão.' using errcode = 'P0001'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_order_status(
  p_order_id uuid, p_status public.order_status, p_note text default null, p_allow_balance boolean default false
) returns void
language plpgsql volatile security definer set search_path = public as $$
declare o public.service_orders; v_balance numeric;
begin
  if not public.can_access_order(p_order_id) then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  select * into o from public.service_orders where id = p_order_id for update;
  if not found then raise exception 'OS não encontrada.' using errcode = 'P0002'; end if;
  if o.status = p_status then return; end if;
  if o.status in ('delivered', 'cancelled') and not public.is_admin() then
    raise exception 'OS encerrada. Somente administradores podem reabrir.' using errcode = '42501';
  end if;
  v_balance := o.total - o.amount_paid;
  if p_status = 'delivered' and v_balance > 0 then
    if not p_allow_balance then
      raise exception 'Há saldo pendente de %. Confirme a entrega com saldo em aberto.', public.fmt_money(v_balance)
        using errcode = 'P0001', hint = 'pending_balance';
    end if;
    insert into public.order_events (order_id, kind, message)
    values (p_order_id, 'note', 'Entrega autorizada com saldo pendente de ' || public.fmt_money(v_balance));
  end if;

  update public.service_orders
     set status = p_status,
         cancel_reason = case when p_status = 'cancelled' then nullif(trim(p_note), '') else cancel_reason end
   where id = p_order_id;

  if p_status <> 'cancelled' and nullif(trim(p_note), '') is not null then
    insert into public.order_events (order_id, kind, message) values (p_order_id, 'note', trim(p_note));
  end if;
end;
$$;

create or replace function public.add_order_note(p_order_id uuid, p_note text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.can_access_order(p_order_id) then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_note, ''))) < 2 then raise exception 'Escreva a observação.' using errcode = 'P0001'; end if;
  insert into public.order_events (order_id, kind, message) values (p_order_id, 'note', trim(p_note));
end;
$$;

create or replace function public.remove_order_photo(p_photo_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_order uuid;
begin
  select order_id into v_order from public.order_photos where id = p_photo_id and removed_at is null;
  if v_order is null then raise exception 'Foto não encontrada.' using errcode = 'P0002'; end if;
  if not public.can_access_order(v_order) then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  update public.order_photos set removed_at = now(), removed_by = auth.uid() where id = p_photo_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Pagamentos
-- ---------------------------------------------------------------------
create or replace function public.payments_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_method text;
begin
  select name into v_method from public.payment_methods where id = new.method_id;
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, kind, message, data)
    values (new.order_id, 'payment', 'Pagamento recebido: ' || public.fmt_money(new.amount) || ' · ' || v_method, jsonb_build_object('payment_id', new.id));
  elsif new.status = 'refunded' and old.status <> 'refunded' then
    insert into public.order_events (order_id, kind, message, data)
    values (new.order_id, 'refund', 'Estorno: ' || public.fmt_money(new.amount) || ' · ' || v_method || ' · ' || coalesce(new.refund_reason, ''), jsonb_build_object('payment_id', new.id));
  end if;
  perform public.recalc_order(new.order_id);
  return new;
end;
$$;
create trigger payments_after after insert or update on public.payments for each row execute function public.payments_after();

create or replace function public.register_payment(
  p_order_id uuid, p_amount numeric, p_method_id uuid, p_paid_at timestamptz default now(), p_notes text default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare o public.service_orders; v_id uuid;
begin
  if not (public.has_perm('payments') and public.can_access_order(p_order_id)) then
    raise exception 'Você não tem permissão para registrar pagamentos.' using errcode = '42501';
  end if;
  select * into o from public.service_orders where id = p_order_id for update;
  if not found then raise exception 'OS não encontrada.' using errcode = 'P0002'; end if;
  if o.status = 'cancelled' then raise exception 'OS cancelada não recebe pagamentos.' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'O valor deve ser maior que zero.' using errcode = 'P0001'; end if;
  if round(p_amount, 2) > round(o.total - o.amount_paid, 2) then
    raise exception 'Valor maior que o saldo pendente (%).', public.fmt_money(greatest(o.total - o.amount_paid, 0)) using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.payment_methods where id = p_method_id and active) then
    raise exception 'Forma de pagamento inválida.' using errcode = 'P0001';
  end if;
  if coalesce(p_paid_at, now()) > now() + interval '5 minutes' then
    raise exception 'A data do pagamento não pode estar no futuro.' using errcode = 'P0001';
  end if;
  insert into public.payments (order_id, amount, method_id, paid_at, notes)
  values (p_order_id, round(p_amount, 2), p_method_id, coalesce(p_paid_at, now()), nullif(trim(p_notes), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.refund_payment(p_payment_id uuid, p_reason text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare p public.payments;
begin
  if not public.is_admin() then raise exception 'Somente administradores podem estornar pagamentos.' using errcode = '42501'; end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Pagamento não encontrado.' using errcode = 'P0002'; end if;
  if p.status = 'refunded' then raise exception 'Pagamento já estornado.' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo do estorno.' using errcode = 'P0001'; end if;
  update public.payments set status = 'refunded', refunded_at = now(), refunded_by = auth.uid(), refund_reason = trim(p_reason)
   where id = p_payment_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Agenda interna
-- ---------------------------------------------------------------------
-- NULL = horário válido; senão: closed | outside_hours | bays_full | employee_busy | employee_inactive
create or replace function public.check_appointment_slot(
  p_start timestamptz, p_end timestamptz, p_employee_id uuid default null, p_ignore uuid default null
) returns text
language plpgsql stable security definer set search_path = public as $$
declare s public.company_settings; bh public.business_hours; v_ls timestamp; v_le timestamp; v_peak int;
begin
  select * into s from public.company_settings where id = 1;
  v_ls := p_start at time zone s.timezone;
  v_le := p_end at time zone s.timezone;
  select * into bh from public.business_hours where weekday = extract(dow from v_ls)::int;
  if not found or not bh.is_open then return 'closed'; end if;
  if v_ls < v_ls::date + bh.open_time or v_le > v_ls::date + bh.close_time then return 'outside_hours'; end if;

  if p_employee_id is not null then
    if not exists (select 1 from public.employees where id = p_employee_id and active) then return 'employee_inactive'; end if;
    if exists (select 1 from public.appointments a
                where a.employee_id = p_employee_id and a.status in ('scheduled', 'confirmed')
                  and (p_ignore is null or a.id <> p_ignore) and a.starts_at < p_end and a.ends_at > p_start) then
      return 'employee_busy';
    end if;
  end if;

  -- pico de ocupação simultânea no intervalo
  select coalesce(max(cnt), 0) into v_peak from (
    select (select count(*) from public.appointments a
             where a.status in ('scheduled', 'confirmed') and (p_ignore is null or a.id <> p_ignore)
               and a.starts_at <= pt.t and a.ends_at > pt.t) as cnt
      from (select p_start as t
            union select a.starts_at from public.appointments a
             where a.status in ('scheduled', 'confirmed') and (p_ignore is null or a.id <> p_ignore)
               and a.starts_at > p_start and a.starts_at < p_end) pt) x;
  if v_peak >= s.bays then return 'bays_full'; end if;
  return null;
end;
$$;

create or replace function public.create_appointment(
  p_customer_id uuid, p_vehicle_id uuid, p_starts_at timestamptz, p_service_ids uuid[],
  p_employee_id uuid default null, p_duration_minutes int default null, p_channel text default 'telefone', p_notes text default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v_min int; v_end timestamptz; v_reason text; v_id uuid;
begin
  if not public.is_active_user() then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  if not exists (select 1 from public.vehicles where id = p_vehicle_id and customer_id = p_customer_id and active) then
    raise exception 'Veículo inválido para este cliente.' using errcode = 'P0001';
  end if;
  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'Selecione ao menos um serviço.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.services where id = any (p_service_ids) and active) <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'Serviço inválido ou inativo.' using errcode = 'P0001';
  end if;
  v_min := coalesce(p_duration_minutes, (select sum(estimated_minutes) from public.services where id = any (p_service_ids)));
  if v_min < 5 then raise exception 'Duração inválida.' using errcode = 'P0001'; end if;
  v_end := p_starts_at + make_interval(mins => v_min);

  perform pg_advisory_xact_lock(hashtext('premium_car_agenda'));
  v_reason := public.check_appointment_slot(p_starts_at, v_end, p_employee_id, null);
  if v_reason is not null then
    raise exception 'Horário indisponível (%).', v_reason using errcode = 'P0001', hint = v_reason;
  end if;

  insert into public.appointments (customer_id, vehicle_id, employee_id, starts_at, ends_at, channel, notes)
  values (p_customer_id, p_vehicle_id, p_employee_id, p_starts_at, v_end, coalesce(p_channel, 'telefone'), nullif(trim(p_notes), ''))
  returning id into v_id;
  insert into public.appointment_services (appointment_id, service_id, name, price, estimated_minutes)
  select v_id, s.id, s.name, s.default_price, s.estimated_minutes from public.services s where s.id = any (p_service_ids);
  return v_id;
end;
$$;

create or replace function public.reschedule_appointment(
  p_id uuid, p_starts_at timestamptz, p_employee_id uuid default null, p_change_employee boolean default false
) returns void
language plpgsql volatile security definer set search_path = public as $$
declare a public.appointments; v_emp uuid; v_end timestamptz; v_reason text;
begin
  if not public.is_active_user() then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  select * into a from public.appointments where id = p_id for update;
  if not found then raise exception 'Compromisso não encontrado.' using errcode = 'P0002'; end if;
  if a.status not in ('scheduled', 'confirmed') then
    raise exception 'Somente compromissos ativos podem ser reagendados.' using errcode = 'P0001';
  end if;
  v_emp := case when p_change_employee then p_employee_id else a.employee_id end;
  v_end := p_starts_at + (a.ends_at - a.starts_at);
  perform pg_advisory_xact_lock(hashtext('premium_car_agenda'));
  v_reason := public.check_appointment_slot(p_starts_at, v_end, v_emp, p_id);
  if v_reason is not null then
    raise exception 'Horário indisponível (%).', v_reason using errcode = 'P0001', hint = v_reason;
  end if;
  perform set_config('app.agenda_checked', 'on', true);
  update public.appointments set starts_at = p_starts_at, ends_at = v_end, employee_id = v_emp where id = p_id;
  perform set_config('app.agenda_checked', '', true);
end;
$$;

-- Data/hora/funcionário só mudam pelo reagendamento (que verifica conflitos)
create or replace function public.appointments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.starts_at, new.ends_at, new.employee_id) is distinct from (old.starts_at, old.ends_at, old.employee_id)
     and coalesce(current_setting('app.agenda_checked', true), '') <> 'on' and not public.is_privileged() then
    raise exception 'Use o reagendamento para alterar data, horário ou funcionário.' using errcode = 'P0001';
  end if;
  if old.status in ('converted', 'cancelled') and new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Compromisso encerrado.' using errcode = 'P0001';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and nullif(trim(coalesce(new.cancel_reason, '')), '') is null then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger appointments_guard before update on public.appointments for each row execute function public.appointments_guard();

create or replace function public.convert_appointment(
  p_id uuid, p_mileage_km int default null, p_initial_condition text default null, p_damages text default null
) returns uuid
language plpgsql volatile security invoker set search_path = public as $$
declare a public.appointments; v_items jsonb;
begin
  select * into a from public.appointments where id = p_id;
  if not found then raise exception 'Compromisso não encontrado.' using errcode = 'P0002'; end if;
  if a.status not in ('scheduled', 'confirmed') then raise exception 'Compromisso indisponível para conversão.' using errcode = 'P0001'; end if;
  select jsonb_agg(jsonb_build_object('service_id', s.service_id, 'employee_id', a.employee_id)) into v_items
    from public.appointment_services s where s.appointment_id = p_id;
  return public.open_service_order(
    p_customer_id => a.customer_id, p_vehicle_id => a.vehicle_id, p_items => v_items,
    p_responsible_id => coalesce(a.employee_id, public.my_employee_id()), p_mileage_km => p_mileage_km,
    p_initial_condition => p_initial_condition, p_damages => p_damages, p_notes => a.notes, p_appointment_id => p_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboard e pesquisa global
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text := public.company_tz();
  v_today timestamptz := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  v_tomorrow timestamptz := (date_trunc('day', now() at time zone v_tz) + interval '1 day') at time zone v_tz;
  v_month timestamptz := date_trunc('month', now() at time zone v_tz) at time zone v_tz;
begin
  if not public.is_active_user() then raise exception 'Não autorizado.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'customers', (select count(*) from public.customers where active),
    'vehicles', (select count(*) from public.vehicles where active),
    'in_shop', (select count(*) from public.service_orders where status not in ('delivered', 'cancelled')),
    'in_progress', (select count(*) from public.service_orders where status in ('in_progress', 'quality_control')),
    'waiting', (select count(*) from public.service_orders where status in ('received', 'evaluation', 'waiting')),
    'ready', (select count(*) from public.service_orders where status in ('completed', 'awaiting_pickup')),
    'completed_today', (select count(*) from public.service_orders where completed_at >= v_today and completed_at < v_tomorrow and status <> 'cancelled'),
    'delivered_today', (select count(*) from public.service_orders where delivered_at >= v_today and delivered_at < v_tomorrow),
    'appointments_today', (select count(*) from public.appointments where starts_at >= v_today and starts_at < v_tomorrow and status in ('scheduled', 'confirmed')),
    -- valores financeiros apenas para administradores
    'revenue_today', case when public.is_admin() then (select coalesce(sum(amount), 0) from public.payments
                       where status = 'confirmed' and paid_at >= v_today and paid_at < v_tomorrow) end,
    'revenue_month', case when public.is_admin() then (select coalesce(sum(amount), 0) from public.payments
                       where status = 'confirmed' and paid_at >= v_month) end,
    'receivable', case when public.is_admin() then (select coalesce(sum(total - amount_paid), 0) from public.service_orders
                       where status <> 'cancelled' and total > amount_paid) end);
end;
$$;

create or replace function public.global_search(p_q text)
returns table (kind text, id uuid, title text, subtitle text)
language plpgsql stable security invoker set search_path = public as $$
declare
  v_q text := trim(coalesce(p_q, ''));
  v_digits text := public.only_digits(p_q);
  v_plate text := upper(regexp_replace(coalesce(p_q, ''), '[^A-Za-z0-9]', '', 'g'));
  v_num bigint;
begin
  if char_length(v_q) < 2 then return; end if;
  if v_q ~* '^(os)?[\s#-]*\d{1,10}$' then v_num := regexp_replace(v_q, '\D', '', 'g')::bigint; end if;
  return query
  (select 'order'::text, o.id, 'OS ' || lpad(o.number::text, 5, '0'),
          c.full_name || ' · ' || v.brand || ' ' || v.model || coalesce(' · ' || v.plate, '')
     from public.service_orders o join public.customers c on c.id = o.customer_id join public.vehicles v on v.id = o.vehicle_id
    where v_num is not null and o.number = v_num
    limit 3)
  union all
  (select 'vehicle', v.id, coalesce(v.plate, 'Sem placa') || ' · ' || v.brand || ' ' || v.model, c.full_name
     from public.vehicles v join public.customers c on c.id = v.customer_id
    where (char_length(v_plate) >= 3 and v.plate like '%' || v_plate || '%') or v.model ilike '%' || v_q || '%'
    order by v.active desc
    limit 6)
  union all
  (select 'customer', c.id, c.full_name, concat_ws(' · ', c.phone, c.email)
     from public.customers c
    where c.anonymized_at is null
      and (c.full_name ilike '%' || v_q || '%' or c.email ilike '%' || v_q || '%'
           or (char_length(coalesce(v_digits, '')) >= 4 and (c.phone like '%' || v_digits || '%' or c.whatsapp like '%' || v_digits || '%' or c.document like v_digits || '%')))
    order by c.active desc, c.full_name
    limit 8);
end;
$$;

-- ---------------------------------------------------------------------
-- Relatórios (somente administradores)
-- ---------------------------------------------------------------------
create or replace function public.assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Relatórios disponíveis apenas para administradores.' using errcode = '42501'; end if;
end;
$$;

-- Recebimentos entram na data do pagamento; estornos saem na data do estorno.
create or replace function public.report_revenue(p_from date, p_to date)
returns table (day date, method text, received numeric, refunded numeric, payments int)
language plpgsql stable security definer set search_path = public as $$
declare v_a timestamptz := public.local_day_start(p_from); v_b timestamptz := public.local_day_start(p_to + 1); v_tz text := public.company_tz();
begin
  perform public.assert_admin();
  return query
  with ev as (
    select (p.paid_at at time zone v_tz)::date d, m.name, p.amount rec, 0::numeric ref, 1 cnt
      from public.payments p join public.payment_methods m on m.id = p.method_id
     where p.paid_at >= v_a and p.paid_at < v_b
    union all
    select (p.refunded_at at time zone v_tz)::date, m.name, 0, p.amount, 0
      from public.payments p join public.payment_methods m on m.id = p.method_id
     where p.status = 'refunded' and p.refunded_at >= v_a and p.refunded_at < v_b)
  select ev.d, ev.name, sum(ev.rec), sum(ev.ref), sum(ev.cnt)::int from ev group by ev.d, ev.name order by ev.d, ev.name;
end;
$$;

create or replace function public.report_top_services(p_from date, p_to date)
returns table (service text, times int, quantity numeric, revenue numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select coalesce(s.name, i.description), count(*)::int, sum(i.quantity), sum(i.line_total)
    from public.service_order_items i
    join public.service_orders o on o.id = i.order_id
    left join public.services s on s.id = i.service_id
   where o.status <> 'cancelled' and o.entered_at >= public.local_day_start(p_from) and o.entered_at < public.local_day_start(p_to + 1)
   group by 1 order by 2 desc, 4 desc;
end;
$$;

create or replace function public.report_vehicles_served(p_from date, p_to date)
returns table (vehicle_id uuid, plate text, vehicle text, customer text, orders int, total numeric, last_entry timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select v.id, v.plate, v.brand || ' ' || v.model, c.full_name, count(o.id)::int, sum(o.total), max(o.entered_at)
    from public.service_orders o
    join public.vehicles v on v.id = o.vehicle_id
    join public.customers c on c.id = v.customer_id
   where o.status <> 'cancelled' and o.entered_at >= public.local_day_start(p_from) and o.entered_at < public.local_day_start(p_to + 1)
   group by v.id, v.plate, v.brand, v.model, c.full_name
   order by 5 desc, 6 desc;
end;
$$;

create or replace function public.report_productivity(p_from date, p_to date)
returns table (employee_id uuid, employee text, orders_responsible int, orders_completed int, items_done int, items_value numeric, avg_hours numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_a timestamptz := public.local_day_start(p_from); v_b timestamptz := public.local_day_start(p_to + 1);
begin
  perform public.assert_admin();
  return query
  select e.id, e.full_name,
    (select count(*)::int from public.service_orders o where o.responsible_id = e.id and o.status <> 'cancelled' and o.entered_at >= v_a and o.entered_at < v_b),
    (select count(*)::int from public.service_orders o where o.responsible_id = e.id and o.status <> 'cancelled' and o.completed_at >= v_a and o.completed_at < v_b),
    (select count(*)::int from public.service_order_items i join public.service_orders o on o.id = i.order_id
      where i.employee_id = e.id and i.status = 'done' and o.status <> 'cancelled' and i.finished_at >= v_a and i.finished_at < v_b),
    (select coalesce(sum(i.line_total), 0) from public.service_order_items i join public.service_orders o on o.id = i.order_id
      where i.employee_id = e.id and i.status = 'done' and o.status <> 'cancelled' and i.finished_at >= v_a and i.finished_at < v_b),
    (select round((avg(extract(epoch from (o.completed_at - o.entered_at))) / 3600)::numeric, 1) from public.service_orders o
      where o.responsible_id = e.id and o.status <> 'cancelled' and o.completed_at >= v_a and o.completed_at < v_b)
    from public.employees e
   where e.active or exists (select 1 from public.service_orders o where o.responsible_id = e.id)
   order by 4 desc, 2;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.request_role(), public.is_service_role(), public.is_privileged(), public.is_active_user(), public.is_admin(), public.has_perm(text),
  public.my_employee_id(), public.can_access_order(uuid), public.only_digits(text), public.company_tz(), public.local_day_start(date),
  public.fmt_money(numeric), public.status_label(public.order_status),
  public.find_customer_duplicates(text, text, text, text, uuid), public.possible_duplicate_customers(), public.anonymize_customer(uuid),
  public.open_service_order(uuid, uuid, jsonb, uuid, timestamptz, int, text, text, text, text, numeric, uuid),
  public.change_order_status(uuid, public.order_status, text, boolean), public.add_order_note(uuid, text), public.remove_order_photo(uuid),
  public.register_payment(uuid, numeric, uuid, timestamptz, text), public.refund_payment(uuid, text),
  public.check_appointment_slot(timestamptz, timestamptz, uuid, uuid),
  public.create_appointment(uuid, uuid, timestamptz, uuid[], uuid, int, text, text),
  public.reschedule_appointment(uuid, timestamptz, uuid, boolean), public.convert_appointment(uuid, int, text, text),
  public.dashboard_stats(), public.global_search(text),
  public.report_revenue(date, date), public.report_top_services(date, date), public.report_vehicles_served(date, date),
  public.report_productivity(date, date)
  to authenticated, service_role;
revoke execute on function public.recalc_order(uuid), public.assert_admin() from authenticated;

-- >>> supabase/migrations/20261016000003_seguranca.sql
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

-- O navegador envia o arquivo direto ao Storage (sem passar pelo servidor da
-- aplicação); o registro na OS só é aceito se o arquivo existir na pasta da
-- própria OS. O autor é sempre o usuário da sessão.
create or replace function public.photos_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.order_id_from_path(new.storage_path) is distinct from new.order_id then
    raise exception 'O arquivo não pertence a esta OS.' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'order-photos' and name = new.storage_path) then
    raise exception 'Arquivo da foto não encontrado no armazenamento.' using errcode = '22023';
  end if;
  if not public.is_privileged() then
    new.uploaded_by := auth.uid();
    new.removed_at := null;
    new.removed_by := null;
  end if;
  return new;
end;
$$;
create trigger photos_before before insert on public.order_photos for each row execute function public.photos_before();

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

-- >>> supabase/seed.sql
-- =====================================================================
-- Premium Car · Dados iniciais (editáveis pelo sistema)
-- Os preços dos serviços são apenas referência inicial e ficam marcados
-- como "a revisar" até o administrador confirmá-los.
-- =====================================================================
insert into public.company_settings (id, company_name) values (1, 'Premium Car') on conflict (id) do nothing;

insert into public.business_hours (weekday, is_open, open_time, close_time) values
  (0, false, '08:00', '12:00'), (1, true, '08:00', '18:00'), (2, true, '08:00', '18:00'), (3, true, '08:00', '18:00'),
  (4, true, '08:00', '18:00'), (5, true, '08:00', '18:00'), (6, true, '08:00', '13:00')
on conflict (weekday) do nothing;

insert into public.payment_methods (name, sort_order) values
  ('Pix', 1), ('Cartão de crédito', 2), ('Cartão de débito', 3), ('Dinheiro', 4), ('Transferência', 5)
on conflict do nothing;

insert into public.services (name, description, category, default_price, estimated_minutes, sort_order) values
  ('Lavagem detalhada', 'Lavagem externa minuciosa, rodas, caixas de roda e acabamento dos pneus.', 'Lavagem', 120, 90, 10),
  ('Lavagem técnica', 'Pré-lavagem, descontaminação, frisos, emblemas e motor externo.', 'Lavagem', 220, 180, 20),
  ('Higienização interna', 'Aspiração, painel, portas, carpetes e eliminação de odores.', 'Higienização', 280, 240, 30),
  ('Higienização de bancos e estofados', 'Extração profunda em bancos de tecido e remoção de manchas.', 'Higienização', 250, 240, 40),
  ('Polimento comercial', 'Polimento em etapa única para recuperar o brilho.', 'Polimento', 450, 300, 50),
  ('Polimento técnico', 'Correção de pintura em múltiplas etapas com medição de camada.', 'Polimento', 900, 480, 60),
  ('Vitrificação de pintura', 'Proteção cerâmica de longa duração (requer avaliação da pintura).', 'Proteção', 1500, 600, 70),
  ('Enceramento', 'Cera de carnaúba para brilho e proteção.', 'Proteção', 150, 90, 80),
  ('Limpeza e proteção de couro', 'Limpeza, hidratação e proteção dos bancos de couro.', 'Higienização', 300, 180, 90),
  ('Revitalização de faróis', 'Lixamento, polimento e proteção UV.', 'Acabamento', 180, 120, 100),
  ('Serviço personalizado', 'Para serviços fora do catálogo: ajuste a descrição e o valor na OS.', 'Outros', 0, 60, 110)
on conflict do nothing;

-- Primeiro administrador: usuários criados em Authentication → Users ANTES desta
-- instalação ganham o perfil, e o mais antigo vira administrador (se ainda não houver um).
insert into public.profiles (id, full_name, email)
select id, split_part(email, '@', 1), lower(email) from auth.users
on conflict (id) do nothing;

with primeiro as (
  select p.id from public.profiles p
  where not exists (select 1 from public.profiles where role = 'admin')
  order by p.created_at, p.email limit 1
)
update public.profiles set role = 'admin', active = true, perm_payments = true, perm_discounts = true
where id in (select id from primeiro);

insert into public.employees (full_name, job_title, profile_id)
select p.full_name, 'Administrador', p.id from public.profiles p
where p.role = 'admin' and not exists (select 1 from public.employees e where e.profile_id = p.id);

-- Resultado: deve listar o seu e-mail como admin
select email, role, active from public.profiles;
