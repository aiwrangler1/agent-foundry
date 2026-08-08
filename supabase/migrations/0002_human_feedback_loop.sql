create type public.feedback_category as enum ('correction','preference','decision','explanation','policy_proposal');
create type public.feedback_target as enum ('assistant_behavior','agent_behavior','human_team','procedure','policy');
create type public.feedback_persistence as enum ('one_time','durable');
create type public.feedback_source as enum ('control_panel','codex_conversation','human_request','review');
create type public.feedback_status as enum ('pending_confirmation','confirmed','rejected','converted','expired');
create type public.preference_status as enum ('proposed','active','superseded','expired','rejected','requires_policy_review');
create type public.preference_applies_to as enum ('codex','agents','human_team','control_plane');

create table if not exists public.human_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id),
  submitted_by_human_id uuid not null references public.human_users(id),
  source public.feedback_source not null,
  category public.feedback_category not null,
  target public.feedback_target not null,
  statement text not null check (char_length(statement) between 1 and 4000),
  context text not null default '' check (char_length(context) <= 8000),
  persistence public.feedback_persistence not null,
  provenance text not null check (char_length(provenance) between 1 and 2000),
  status public.feedback_status not null default 'pending_confirmation',
  submitted_at timestamptz not null default now(),
  confirmed_by_human_id uuid references public.human_users(id),
  confirmed_at timestamptz,
  rejection_reason text,
  review_at timestamptz,
  expires_at timestamptz,
  check ((status <> 'confirmed' and status <> 'converted') or confirmed_by_human_id is not null)
);

create table if not exists public.preference_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id),
  source_feedback_id uuid not null references public.human_feedback(id),
  preference_key text not null check (char_length(preference_key) between 1 and 200),
  version integer not null default 1 check (version > 0),
  statement text not null check (char_length(statement) between 1 and 4000),
  rationale text not null check (char_length(rationale) between 1 and 4000),
  applies_to public.preference_applies_to not null,
  status public.preference_status not null default 'proposed',
  created_by_human_id uuid not null references public.human_users(id),
  approved_by_human_id uuid references public.human_users(id),
  created_at timestamptz not null default now(),
  effective_at timestamptz,
  review_at timestamptz,
  expires_at timestamptz,
  supersedes_preference_id uuid references public.preference_records(id),
  authority_effect text not null default 'none' check (authority_effect = 'none'),
  unique (organization_id, business_unit_id, preference_key, version)
);

create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id),
  feedback_id uuid not null references public.human_feedback(id),
  preference_id uuid references public.preference_records(id),
  actor_human_id uuid not null references public.human_users(id),
  event_type text not null,
  details text not null,
  occurred_at timestamptz not null default now()
);

alter table public.human_feedback enable row level security;
alter table public.preference_records enable row level security;
alter table public.feedback_events enable row level security;

create policy scoped_human_feedback_can_read on public.human_feedback for select using (organization_id = public.current_organization_id());
create policy scoped_preferences_can_read on public.preference_records for select using (organization_id = public.current_organization_id());
create policy scoped_feedback_events_can_read on public.feedback_events for select using (organization_id = public.current_organization_id());

-- Client-facing writes remain absent. A trusted server/workflow role must validate
-- the human actor, transition, audit event, and authority boundary together.
