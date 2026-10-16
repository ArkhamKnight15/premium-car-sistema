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
