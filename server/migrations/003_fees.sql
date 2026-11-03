-- Fees, verified payments, receipts, refunds. Money is integer minor units (paise, cents); never floats.
alter table tenants add column currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$');
-- A guardian can be linked to a child for information without being allowed to pay (custody, sponsor, etc.).
alter table guardianships add column can_pay boolean not null default true;

create table counters (
  tenant_id uuid not null references tenants(id),
  name text not null,
  value bigint not null,
  primary key (tenant_id, name)
);

-- Invoices are immutable. Cancelling one is a separate, recorded void; the amount is never edited.
create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  learner_id uuid not null references learners(id),
  number text not null,
  kind text not null check (kind in ('admission','tuition','exam','transport','other')),
  description text not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  due_date date not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index on invoices (tenant_id, learner_id);
create table invoice_voids (
  invoice_id uuid primary key references invoices(id),
  tenant_id uuid not null references tenants(id),
  reason text not null,
  actor_id uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- status is a small state machine driven only by verified provider events or an authorised staff action.
create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  invoice_id uuid not null references invoices(id),
  payer_id uuid references users(id),
  method text not null check (method in ('online','cash','bank_transfer','cheque','other')),
  provider text,
  provider_ref text unique,
  reference text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  status text not null check (status in ('initiated','processing','settled','failed','needs_reconciliation','reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on payments (tenant_id, invoice_id);
create index on payments (tenant_id, status);
-- At most one unfinished online payment per invoice: this is what stops a double payment, even under concurrent requests.
create unique index one_open_online_payment on payments (invoice_id) where method = 'online' and status in ('initiated','processing','needs_reconciliation');

-- Every transition and provider message, kept forever. provider_event_id makes webhook delivery idempotent.
create table payment_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id),
  payment_id uuid not null references payments(id),
  type text not null,
  provider_event_id text,
  amount_minor bigint,
  actor_id uuid references users(id),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create unique index on payment_events (tenant_id, provider_event_id) where provider_event_id is not null;
create index on payment_events (payment_id, id);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  payment_id uuid not null unique references payments(id),
  number text not null,
  amount_minor bigint not null,
  currency char(3) not null,
  snapshot jsonb not null, -- institution, learner, payer, invoice lines as they were when issued
  issued_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create table refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  payment_id uuid not null references payments(id),
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null,
  actor_id uuid not null references users(id),
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['counters','invoices','invoice_voids','payments','payment_events','receipts','refunds'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy tenant_isolation on %I
      using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)$p$, t);
  end loop;
end $$;

create trigger invoices_immutable before update or delete on invoices for each row execute function forbid_mutation();
create trigger voids_immutable before update or delete on invoice_voids for each row execute function forbid_mutation();
create trigger payment_events_append_only before update or delete on payment_events for each row execute function forbid_mutation();
create trigger receipts_immutable before update or delete on receipts for each row execute function forbid_mutation();
create trigger refunds_immutable before update or delete on refunds for each row execute function forbid_mutation();

grant select, insert, update on counters, payments to campusos_app;
grant select, insert on invoices, invoice_voids, payment_events, receipts, refunds to campusos_app;
grant update (can_pay) on guardianships to campusos_app;
grant usage, select on all sequences in schema public to campusos_app;
