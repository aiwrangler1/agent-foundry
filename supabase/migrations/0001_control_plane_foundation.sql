create extension if not exists pgcrypto;

create type public.agent_status as enum ('candidate','shadow','active','suspended','retired');
create type public.data_classification as enum ('public','internal','confidential','restricted');

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.human_users (
  id uuid primary key references auth.users(id), organization_id uuid not null references public.organizations(id),
  role text not null check (role in ('CEO','finance operator','human operator','reviewer','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null, status text not null default 'active', created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id), name text not null,
  status text not null default 'active', created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id), team_id uuid references public.teams(id),
  parent_agent_id uuid references public.agents(id), name text not null, role text not null,
  authority_level text not null default 'none', status public.agent_status not null default 'candidate',
  cost_center text not null, memory_scope text not null, created_at timestamptz not null default now()
);

create table if not exists public.agent_versions (
  id uuid primary key default gen_random_uuid(), agent_id uuid not null references public.agents(id),
  version integer not null, prompt_sha256 text not null, policy_sha256 text not null,
  approved_models jsonb not null default '[]', approved_tools jsonb not null default '[]',
  approved_data public.data_classification[] not null default '{}', created_by uuid not null, created_at timestamptz not null default now(),
  unique (agent_id, version)
);

create table if not exists public.capability_registry (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id), kind text not null, name text not null,
  version integer not null, qualified boolean not null default false, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create table if not exists public.objectives (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id), requested_by uuid not null, title text not null,
  status text not null default 'queued', created_at timestamptz not null default now()
);
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(), objective_id uuid not null references public.objectives(id),
  version integer not null default 1, plan jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id),
  assigned_agent_id uuid references public.agents(id), status text not null default 'queued', idempotency_key text unique, created_at timestamptz not null default now()
);
create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(), objective_id uuid references public.objectives(id),
  status text not null default 'running', paused_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(), workflow_run_id uuid not null references public.workflow_runs(id),
  step_key text not null, status text not null, attempt integer not null default 0, result jsonb, created_at timestamptz not null default now(), unique (workflow_run_id, step_key)
);

create table if not exists public.tool_definitions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null, action_class text not null, required_authority text not null, data_classification public.data_classification not null,
  reversible boolean not null, cost_class text not null, creates_external_commitment boolean not null default false,
  approval_policy jsonb not null default '{}', rollback_handler text, idempotency_required boolean not null default true, enabled boolean not null default false
);
create table if not exists public.tool_calls (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id), tool_id uuid not null references public.tool_definitions(id),
  agent_id uuid not null references public.agents(id), workflow_run_id uuid references public.workflow_runs(id), idempotency_key text not null unique,
  status text not null, cost jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), provider text not null,
  account_reference text, auth_method text, scopes jsonb not null default '[]', environment text not null default 'sandbox', health text not null default 'unknown', revoked_at timestamptz
);
create table if not exists public.credential_references (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references public.integrations(id), secret_reference text not null, classification public.data_classification not null default 'restricted'
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id),
  requesting_agent_id uuid not null references public.agents(id), workflow_run_id uuid references public.workflow_runs(id), action text not null, reasoning text not null,
  evidence jsonb not null default '[]', cost_minor bigint not null default 0, risk text not null, status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.human_requests (
  id uuid primary key default gen_random_uuid(), approval_request_id uuid references public.approval_requests(id), request_type text not null,
  continuation jsonb not null default '{}', response jsonb, responded_by uuid, responded_at timestamptz
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, current_version integer not null default 1
);
create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(), policy_id uuid not null references public.policies(id), version integer not null, policy jsonb not null,
  sha256 text not null, created_by uuid not null, created_at timestamptz not null default now(), unique (policy_id, version)
);
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id),
  parent_budget_id uuid references public.budgets(id), budget_class text not null, allocated_minor bigint not null default 0, currency text not null default 'USD'
);
create table if not exists public.budget_allocations (
  id uuid primary key default gen_random_uuid(), budget_id uuid not null references public.budgets(id), child_type text not null, child_id uuid not null, allocated_minor bigint not null
);
create table if not exists public.spend_reservations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), budget_id uuid not null references public.budgets(id), workflow_run_id uuid references public.workflow_runs(id),
  amount_minor bigint not null check (amount_minor >= 0), currency text not null, status text not null default 'reserved', created_at timestamptz not null default now()
);
create table if not exists public.spend_authorizations (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.spend_reservations(id), tool_id uuid not null references public.tool_definitions(id),
  agent_id uuid not null references public.agents(id), workflow_run_id uuid references public.workflow_runs(id), cost_center text not null, max_amount_minor bigint not null,
  idempotency_key text not null unique, expires_at timestamptz not null
);
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), external_reference text, amount_minor bigint not null, status text not null default 'proposed'
);
create table if not exists public.operational_accounts (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, account_type text not null);
create table if not exists public.journal_entries (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), idempotency_key text not null unique, occurred_at timestamptz not null default now());
create table if not exists public.journal_lines (id uuid primary key default gen_random_uuid(), journal_entry_id uuid not null references public.journal_entries(id), account_id uuid not null references public.operational_accounts(id), debit_minor bigint not null default 0, credit_minor bigint not null default 0, check (debit_minor >= 0 and credit_minor >= 0));
create table if not exists public.forecasts (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id), forecast jsonb not null, created_at timestamptz not null default now());
create table if not exists public.experiments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id), hypothesis text not null, status text not null default 'proposed');
create table if not exists public.metrics (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id), name text not null, value numeric not null, measured_at timestamptz not null default now());
create table if not exists public.artifacts (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id), classification public.data_classification not null, uri text not null, checksum text not null);
create table if not exists public.artifact_provenance (id uuid primary key default gen_random_uuid(), artifact_id uuid not null references public.artifacts(id), source text not null, provenance jsonb not null default '{}');
create table if not exists public.evaluation_runs (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), agent_id uuid references public.agents(id), model text, task_class text not null, result jsonb not null, created_at timestamptz not null default now());
create table if not exists public.incidents (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), severity text not null, status text not null default 'open', summary text not null, created_at timestamptz not null default now());
create table if not exists public.audit_events (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id), actor_id uuid, event_type text not null, object_type text not null, object_id uuid, payload jsonb not null default '{}', occurred_at timestamptz not null default now());
create table if not exists public.kill_switches (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id), scope text not null, enabled boolean not null default false, reason text, updated_at timestamptz not null default now());
create table if not exists public.memory_records (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id), kind text not null, content text not null, provenance text not null, confidence numeric not null check (confidence between 0 and 1), author_id uuid not null, review_at timestamptz, expires_at timestamptz);
create table if not exists public.cache_entries (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), business_unit_id uuid references public.business_units(id), kind text not null, data_classification public.data_classification not null, source text not null, provenance text not null, invalidation_policy text not null, cost_avoided_minor bigint not null default 0, hits bigint not null default 0, misses bigint not null default 0, created_at timestamptz not null default now());

create or replace function public.current_organization_id() returns uuid language sql stable as $$
  select organization_id from public.human_users where id = auth.uid()
$$;

alter table public.organizations enable row level security;
alter table public.human_users enable row level security;
alter table public.business_units enable row level security;
alter table public.teams enable row level security;
alter table public.agents enable row level security;
alter table public.agent_versions enable row level security;
alter table public.capability_registry enable row level security;
alter table public.objectives enable row level security;
alter table public.plans enable row level security;
alter table public.tasks enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.tool_definitions enable row level security;
alter table public.tool_calls enable row level security;
alter table public.integrations enable row level security;
alter table public.credential_references enable row level security;
alter table public.approval_requests enable row level security;
alter table public.human_requests enable row level security;
alter table public.policies enable row level security;
alter table public.policy_versions enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_allocations enable row level security;
alter table public.spend_reservations enable row level security;
alter table public.spend_authorizations enable row level security;
alter table public.commitments enable row level security;
alter table public.operational_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.forecasts enable row level security;
alter table public.experiments enable row level security;
alter table public.metrics enable row level security;
alter table public.artifacts enable row level security;
alter table public.artifact_provenance enable row level security;
alter table public.evaluation_runs enable row level security;
alter table public.incidents enable row level security;
alter table public.audit_events enable row level security;
alter table public.kill_switches enable row level security;
alter table public.memory_records enable row level security;
alter table public.cache_entries enable row level security;

create policy organization_members_can_read on public.organizations for select using (id = public.current_organization_id());
create policy scoped_records_can_read on public.business_units for select using (organization_id = public.current_organization_id());
create policy scoped_agents_can_read on public.agents for select using (organization_id = public.current_organization_id());
create policy scoped_objectives_can_read on public.objectives for select using (organization_id = public.current_organization_id());
create policy scoped_audit_can_read on public.audit_events for select using (organization_id = public.current_organization_id());

-- All writes are intentionally absent from this initial client-facing policy set.
-- Trusted server/workflow roles must be introduced explicitly and reviewed.
