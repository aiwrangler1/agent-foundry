create type public.ooda_loop_kind as enum ('company','business_unit','harness','objective','workflow','agent');
create type public.ooda_phase as enum ('observe','orient','decide','act');
create type public.ooda_loop_status as enum ('active','paused','completed','retired');
create type public.ooda_review_outcome as enum ('continue','adjust','rollback','stop');

create table if not exists public.ooda_loops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id),
  parent_loop_id uuid references public.ooda_loops(id),
  kind public.ooda_loop_kind not null,
  name text not null,
  objective text not null,
  owner_id uuid not null,
  current_phase public.ooda_phase not null default 'observe',
  cycle_number integer not null default 1 check (cycle_number > 0),
  cadence text not null,
  status public.ooda_loop_status not null default 'active',
  next_review_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ooda_cycles (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null references public.ooda_loops(id),
  cycle_number integer not null check (cycle_number > 0),
  observations jsonb not null default '[]',
  orientations jsonb not null default '[]',
  decisions jsonb not null default '[]',
  actions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (loop_id, cycle_number)
);

create table if not exists public.ooda_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id),
  loop_id uuid not null references public.ooda_loops(id),
  cycle_number integer not null check (cycle_number > 0),
  outcome public.ooda_review_outcome not null,
  findings jsonb not null default '[]',
  metric_changes jsonb not null default '{}',
  follow_up_actions jsonb not null default '[]',
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now(),
  unique (loop_id, cycle_number)
);

alter table public.ooda_loops enable row level security;
alter table public.ooda_cycles enable row level security;
alter table public.ooda_reviews enable row level security;

create policy scoped_ooda_loops_can_read on public.ooda_loops for select using (organization_id = public.current_organization_id());
create policy scoped_ooda_cycles_can_read on public.ooda_cycles for select using (loop_id in (select id from public.ooda_loops where organization_id = public.current_organization_id()));
create policy scoped_ooda_reviews_can_read on public.ooda_reviews for select using (organization_id = public.current_organization_id());

-- Loop transitions and reviews require a trusted workflow role; client writes
-- are intentionally absent until that role is explicitly configured.
