-- Alter tasks table
alter table public.tasks alter column plan_id drop not null;
alter table public.tasks add column if not exists organization_id uuid references public.organizations(id);
alter table public.tasks add column if not exists objective_id uuid references public.objectives(id);
alter table public.tasks add column if not exists id_label text;
alter table public.tasks add column if not exists short_id text;
alter table public.tasks add column if not exists title text;
alter table public.tasks add column if not exists state text;
alter table public.tasks add column if not exists priority text;
alter table public.tasks add column if not exists requested_by uuid;
alter table public.tasks add column if not exists reviewer_id uuid;
alter table public.tasks add column if not exists business_unit_id uuid references public.business_units(id);
alter table public.tasks add column if not exists workflow_id uuid references public.workflow_runs(id);
alter table public.tasks add column if not exists cost_center text;
alter table public.tasks add column if not exists due_at timestamptz;
alter table public.tasks add column if not exists blocked_reason text;
alter table public.tasks add column if not exists progress_percent integer not null default 0;
alter table public.tasks add column if not exists updated_at timestamptz not null default now();
alter table public.tasks add column if not exists tags text[] not null default '{}';
alter table public.tasks add column if not exists checklist jsonb not null default '[]';
alter table public.tasks add column if not exists area text;

-- Alter approval_requests table
alter table public.approval_requests add column if not exists id_label text;
alter table public.approval_requests add column if not exists title text;
alter table public.approval_requests add column if not exists expected_outcome text;
alter table public.approval_requests add column if not exists alternatives text[] not null default '{}';
alter table public.approval_requests add column if not exists recommendation text;
alter table public.approval_requests add column if not exists blocked boolean not null default false;
alter table public.approval_requests add column if not exists task_id uuid references public.tasks(id);

-- Alter human_requests table
alter table public.human_requests add column if not exists id_label text;
alter table public.human_requests add column if not exists organization_id uuid references public.organizations(id);
alter table public.human_requests add column if not exists business_unit_id uuid references public.business_units(id);
alter table public.human_requests add column if not exists workflow_id uuid references public.workflow_runs(id);
alter table public.human_requests add column if not exists task_id uuid references public.tasks(id);
alter table public.human_requests add column if not exists title text;
alter table public.human_requests add column if not exists exact_action text;
alter table public.human_requests add column if not exists status text not null default 'open';
alter table public.human_requests add column if not exists required_role text not null default 'CEO';
alter table public.human_requests add column if not exists created_at timestamptz not null default now();

-- Alter agents table
alter table public.agents add column if not exists id_label text;
alter table public.agents add column if not exists tone text;
alter table public.agents add column if not exists initials text;
alter table public.agents add column if not exists workload integer not null default 0;
alter table public.agents add column if not exists quality integer not null default 100;
alter table public.agents add column if not exists cost_minor bigint not null default 0;
alter table public.agents add column if not exists escalations integer not null default 0;

-- Alter workflow_runs table
alter table public.workflow_runs add column if not exists id_label text;
alter table public.workflow_runs add column if not exists organization_id uuid references public.organizations(id);
alter table public.workflow_runs add column if not exists name text;
alter table public.workflow_runs add column if not exists objective text;
alter table public.workflow_runs add column if not exists current_step text;
alter table public.workflow_runs add column if not exists agent_name text;
alter table public.workflow_runs add column if not exists elapsed text;
alter table public.workflow_runs add column if not exists cost_minor bigint not null default 0;
alter table public.workflow_runs add column if not exists progress integer not null default 0;
alter table public.workflow_runs add column if not exists steps jsonb not null default '[]';

-- Alter business_units table
alter table public.business_units add column if not exists id_label text;
alter table public.business_units add column if not exists stage text;
alter table public.business_units add column if not exists owner_name text;
alter table public.business_units add column if not exists owner_initials text;
alter table public.business_units add column if not exists revenue_minor bigint not null default 0;
alter table public.business_units add column if not exists cost_minor bigint not null default 0;
alter table public.business_units add column if not exists margin_percent integer not null default 0;
alter table public.business_units add column if not exists budget_used_percent integer not null default 0;
alter table public.business_units add column if not exists forecast_minor bigint not null default 0;
alter table public.business_units add column if not exists objective text;
alter table public.business_units add column if not exists recommendation text;
alter table public.business_units add column if not exists kpis jsonb not null default '[]';

-- Alter audit_events table
alter table public.audit_events add column if not exists id_label text;
alter table public.audit_events add column if not exists idempotency_key text unique;
