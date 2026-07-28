-- ============================================================
-- CATTLE FARM APP — CORE SCHEMA
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- FARMS
-- ============================================================
create table farms (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  country              text not null default 'Uruguay',
  region               text,
  coordinates          point,
  total_hectares       numeric(10,2),
  productive_hectares  numeric(10,2),
  currency             text not null default 'USD',
  weight_unit          text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  date_format          text not null default 'DD-MM-YYYY',
  -- production
  production_type      text check (production_type in ('carne', 'leche', 'doble_proposito')),
  production_stage     text check (production_stage in ('cria', 'recria', 'engorde', 'ciclo_completo')),
  production_system    text check (production_system in ('intensivo', 'extensivo', 'silvopastoril')),
  target_market        text,
  target_sale_age_days integer,
  target_sale_weight   numeric(8,2),
  -- climate
  rainy_season_start   integer check (rainy_season_start between 1 and 12),
  rainy_season_end     integer check (rainy_season_end between 1 and 12),
  annual_rainfall_mm   integer,
  elevation_masl       integer,
  -- financial assumptions
  daily_cost_per_animal  numeric(10,2) default 0,
  labor_cost_monthly     numeric(10,2) default 0,
  feed_cost_monthly      numeric(10,2) default 0,
  vet_cost_monthly       numeric(10,2) default 0,
  pasture_cost_monthly   numeric(10,2) default 0,
  expected_price_per_kg  numeric(10,2) default 0,
  -- meta
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ============================================================
-- FARM MEMBERS
-- ============================================================
create table farm_members (
  id         uuid primary key default uuid_generate_v4(),
  farm_id    uuid not null references farms(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null default 'viewer' check (role in ('owner', 'manager', 'worker', 'viewer')),
  created_at timestamptz not null default now(),
  unique(farm_id, user_id)
);

-- ============================================================
-- BREEDS
-- ============================================================
create table breeds (
  id           uuid primary key default uuid_generate_v4(),
  farm_id      uuid references farms(id) on delete cascade,
  name         text not null,
  abbreviation text not null,
  description  text,
  is_system    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- System-level breeds (shared across farms)
insert into breeds (id, name, abbreviation, is_system) values
  (uuid_generate_v4(), 'Brangus Negro', 'Brangus N', true),
  (uuid_generate_v4(), 'Brangus Rojo', 'BR', true),
  (uuid_generate_v4(), 'Brangus Gyr Holando', 'Br Gyr Ho', true),
  (uuid_generate_v4(), 'Angus Negro', 'AN', true),
  (uuid_generate_v4(), 'Hereford', 'HF', true),
  (uuid_generate_v4(), 'Limousin', 'LIM', true),
  (uuid_generate_v4(), 'Simmental', 'SIM', true),
  (uuid_generate_v4(), 'Braford', 'BRAD', true),
  (uuid_generate_v4(), 'Brahman', 'BRH', true),
  (uuid_generate_v4(), 'Nelore', 'NEL', true);

-- ============================================================
-- LOTS
-- ============================================================
create table lots (
  id                  uuid primary key default uuid_generate_v4(),
  farm_id             uuid not null references farms(id) on delete cascade,
  name                text not null,
  description         text,
  production_category text check (production_category in ('cria', 'recria', 'engorde', 'reproductoras', 'toros', 'mixto')),
  status              text not null default 'activo' check (status in ('activo', 'inactivo', 'archivado')),
  entry_date          date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- PADDOCKS
-- ============================================================
create table paddocks (
  id                  uuid primary key default uuid_generate_v4(),
  farm_id             uuid not null references farms(id) on delete cascade,
  name                text not null,
  area_hectares       numeric(10,2),
  grass_type          text,
  estimated_capacity  integer,
  water_available     boolean default true,
  current_condition   text check (current_condition in ('excelente', 'bueno', 'regular', 'malo')),
  last_entry_date     date,
  last_exit_date      date,
  rest_days           integer,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- ANIMALS
-- ============================================================
create table animals (
  id              uuid primary key default uuid_generate_v4(),
  farm_id         uuid not null references farms(id) on delete cascade,
  display_id      text not null,
  ear_tag         text,
  name            text,
  category        text not null check (category in (
                    'vaca_reproductora', 'toro', 'vaquillona', 'novillo',
                    'ternero', 'ternera', 'macho_joven', 'hembra_joven'
                  )),
  sex             text not null check (sex in ('M', 'H')),
  birth_date      date,
  breed_id        uuid references breeds(id),
  breed_raw       text,
  mother_id       uuid references animals(id),
  mother_display_id text,
  father_name     text,
  current_lot_id  uuid references lots(id),
  current_paddock_id uuid references paddocks(id),
  status          text not null default 'activo' check (status in (
                    'activo', 'vendido', 'muerto', 'transferido', 'archivado'
                  )),
  sale_status     text check (sale_status in ('disponible', 'reservado', 'vendido')),
  photo_url       text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique(farm_id, display_id)
);

create index animals_farm_id_idx on animals(farm_id);
create index animals_display_id_idx on animals(farm_id, display_id);
create index animals_status_idx on animals(farm_id, status);
create index animals_category_idx on animals(farm_id, category);

-- ============================================================
-- ANIMAL EVENTS (event-sourced history — never overwrite)
-- ============================================================
create table animal_events (
  id           uuid primary key default uuid_generate_v4(),
  farm_id      uuid not null references farms(id) on delete cascade,
  animal_id    uuid not null references animals(id) on delete cascade,
  event_type   text not null check (event_type in (
                  'nacimiento', 'servicio', 'diagnostico_preñez',
                  'parto', 'destete', 'peso', 'tratamiento',
                  'vacunacion', 'movimiento_lote', 'movimiento_potrero',
                  'venta', 'muerte', 'observacion', 'div_insercion',
                  'div_remocion', 'protocolo_sincronizacion'
                )),
  event_date   date not null,
  payload      jsonb not null default '{}',
  original_note text,
  source       text not null default 'manual' check (source in (
                  'manual', 'importacion_foto', 'importacion_planilla',
                  'voz', 'integracion'
                )),
  import_id    uuid,
  user_id      uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create index animal_events_animal_idx on animal_events(animal_id, event_date desc);
create index animal_events_farm_idx on animal_events(farm_id, event_date desc);
create index animal_events_type_idx on animal_events(farm_id, event_type);

-- ============================================================
-- WEIGHT RECORDS (denormalized from events for performance)
-- ============================================================
create table weight_records (
  id                uuid primary key default uuid_generate_v4(),
  farm_id           uuid not null references farms(id) on delete cascade,
  animal_id         uuid not null references animals(id) on delete cascade,
  event_id          uuid references animal_events(id),
  weight_date       date not null,
  weight_kg         numeric(8,2) not null,
  measurement_method text check (measurement_method in ('balanza', 'cinta', 'estimado', 'otro')),
  notes             text,
  source            text not null default 'manual',
  created_at        timestamptz not null default now()
);

create index weight_records_animal_idx on weight_records(animal_id, weight_date desc);

-- ============================================================
-- REPRODUCTIVE RECORDS
-- ============================================================
create table reproductive_records (
  id                    uuid primary key default uuid_generate_v4(),
  farm_id               uuid not null references farms(id) on delete cascade,
  animal_id             uuid not null references animals(id) on delete cascade,
  -- service
  service_date          date,
  bull_name             text,
  bull_animal_id        uuid references animals(id),
  service_method        text check (service_method in (
                          'monta_natural', 'ia', 'te', 'protocolo_div', 'desconocido'
                        )),
  -- div protocol
  div_insertion_date    date,
  div_removal_date      date,
  -- pregnancy
  pregnancy_status      text not null default 'desconocido' check (pregnancy_status in (
                          'desconocido', 'pendiente', 'positivo', 'negativo'
                        )),
  pregnancy_check_date  date,
  pregnancy_raw_value   text,
  -- calving
  expected_calving_date date,
  actual_calving_date   date,
  calf_animal_id        uuid references animals(id),
  calf_sex              text check (calf_sex in ('M', 'H')),
  calf_birth_weight_kg  numeric(6,2),
  -- weaning
  expected_weaning_date date,
  actual_weaning_date   date,
  -- status
  reproductive_status   text not null default 'sin_servicio' check (reproductive_status in (
                          'sin_servicio', 'servida', 'preñez_pendiente', 'preñada',
                          'proxima_a_parir', 'parida', 'abierta', 'seca', 'destetada',
                          'en_protocolo'
                        )),
  next_service_start_date date,
  observations          text,
  -- meta
  season_year           integer,
  import_id             uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index repro_records_animal_idx on reproductive_records(animal_id, service_date desc nulls last);
create index repro_records_farm_idx on reproductive_records(farm_id);
create index repro_records_status_idx on reproductive_records(farm_id, reproductive_status);

-- ============================================================
-- TASKS / ALERTS
-- ============================================================
create table tasks (
  id           uuid primary key default uuid_generate_v4(),
  farm_id      uuid not null references farms(id) on delete cascade,
  animal_id    uuid references animals(id),
  lot_id       uuid references lots(id),
  task_type    text not null check (task_type in (
                  'palpar', 'pesar', 'vacunar', 'tratar', 'mover',
                  'destetar', 'servir', 'revisar_div', 'venta_pendiente',
                  'revision_general', 'otro'
                )),
  title        text not null,
  description  text,
  due_date     date,
  priority     text not null default 'media' check (priority in ('urgente', 'alta', 'media', 'baja')),
  status       text not null default 'pendiente' check (status in ('pendiente', 'en_proceso', 'completada', 'cancelada')),
  auto_generated boolean not null default false,
  assigned_to  uuid references profiles(id),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index tasks_farm_due_idx on tasks(farm_id, due_date, priority);

-- ============================================================
-- EXPENSES
-- ============================================================
create table expenses (
  id           uuid primary key default uuid_generate_v4(),
  farm_id      uuid not null references farms(id) on delete cascade,
  animal_id    uuid references animals(id),
  lot_id       uuid references lots(id),
  category     text not null check (category in (
                  'veterinario', 'alimentacion', 'reproduccion', 'mano_obra',
                  'infraestructura', 'otro'
                )),
  description  text not null,
  amount       numeric(12,2) not null,
  currency     text not null default 'USD',
  expense_date date not null,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- SALES
-- ============================================================
create table sales (
  id            uuid primary key default uuid_generate_v4(),
  farm_id       uuid not null references farms(id) on delete cascade,
  animal_id     uuid not null references animals(id),
  sale_date     date not null,
  sale_weight_kg numeric(8,2),
  price_per_kg  numeric(10,2),
  total_amount  numeric(12,2),
  buyer         text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- DOCUMENT IMPORTS
-- ============================================================
create table imported_documents (
  id               uuid primary key default uuid_generate_v4(),
  farm_id          uuid not null references farms(id) on delete cascade,
  document_type    text not null check (document_type in (
                     'hembras_reproductoras', 'animales_jovenes',
                     'planilla_pesos', 'desconocido'
                   )),
  storage_path     text not null,
  original_filename text,
  document_date    date,
  ai_model_used    text,
  raw_ai_response  jsonb,
  row_count        integer,
  approved_count   integer default 0,
  rejected_count   integer default 0,
  status           text not null default 'pendiente' check (status in (
                     'pendiente', 'en_revision', 'aprobado', 'rechazado', 'importado'
                   )),
  imported_by      uuid not null references profiles(id),
  imported_at      timestamptz,
  created_at       timestamptz not null default now()
);

create table imported_rows (
  id               uuid primary key default uuid_generate_v4(),
  document_id      uuid not null references imported_documents(id) on delete cascade,
  farm_id          uuid not null references farms(id) on delete cascade,
  row_index        integer not null,
  raw_data         jsonb not null,
  normalized_data  jsonb not null default '{}',
  confidence_score numeric(4,3) check (confidence_score between 0 and 1),
  validation_status text not null default 'pendiente' check (validation_status in (
                      'pendiente', 'aprobado', 'rechazado', 'con_advertencias'
                    )),
  approved_by      uuid references profiles(id),
  approved_at      timestamptz,
  animal_id        uuid references animals(id),
  created_at       timestamptz not null default now()
);

create table imported_cells (
  id               uuid primary key default uuid_generate_v4(),
  row_id           uuid not null references imported_rows(id) on delete cascade,
  field_name       text not null,
  raw_value        text,
  normalized_value text,
  confidence       numeric(4,3) check (confidence between 0 and 1),
  validation_status text not null default 'valido' check (validation_status in (
                      'valido', 'advertencia', 'invalido', 'faltante'
                    )),
  warning_message  text,
  was_corrected    boolean default false,
  corrected_value  text,
  corrected_by     uuid references profiles(id),
  corrected_at     timestamptz
);

create table validation_issues (
  id           uuid primary key default uuid_generate_v4(),
  row_id       uuid not null references imported_rows(id) on delete cascade,
  issue_type   text not null,
  severity     text not null check (severity in ('error', 'advertencia', 'info')),
  field_name   text,
  message      text not null,
  created_at   timestamptz not null default now()
);

create table import_approvals (
  id           uuid primary key default uuid_generate_v4(),
  document_id  uuid not null references imported_documents(id) on delete cascade,
  row_id       uuid references imported_rows(id),
  action       text not null check (action in ('aprobado', 'rechazado', 'modificado')),
  user_id      uuid not null references profiles(id),
  notes        text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================
create table ai_conversations (
  id         uuid primary key default uuid_generate_v4(),
  farm_id    uuid not null references farms(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ai_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  tool_calls      jsonb,
  cited_records   jsonb,
  tokens_used     integer,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger farms_updated_at before update on farms
  for each row execute procedure handle_updated_at();
create trigger animals_updated_at before update on animals
  for each row execute procedure handle_updated_at();
create trigger lots_updated_at before update on lots
  for each row execute procedure handle_updated_at();
create trigger paddocks_updated_at before update on paddocks
  for each row execute procedure handle_updated_at();
create trigger repro_updated_at before update on reproductive_records
  for each row execute procedure handle_updated_at();
create trigger tasks_updated_at before update on tasks
  for each row execute procedure handle_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
