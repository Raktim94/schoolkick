-- Working without a payment gateway: the school's UPI id (for a payment QR) and UPI payments confirmed by the office.
alter table tenants add column upi_id text, add column upi_name text;
alter table payments drop constraint payments_method_check;
alter table payments add constraint payments_method_check check (method in ('online','upi','cash','bank_transfer','cheque','other'));
drop index one_open_online_payment;
-- Still one unfinished gateway-or-UPI payment per invoice, so a family is never asked to pay twice.
create unique index one_open_online_payment on payments (invoice_id) where method in ('online','upi') and status in ('initiated','processing','needs_reconciliation');

-- Server-held secrets (receipt verification signing). Not granted to the app role, so tenant requests cannot read it.
create table app_secrets (name text primary key, value text not null);

-- Refunds need a second step: finance requests, the owner decides. Both are immutable; an approval creates the refund row.
create table refund_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  payment_id uuid not null references payments(id),
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null,
  requested_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create table refund_decisions (
  request_id uuid primary key references refund_requests(id),
  tenant_id uuid not null references tenants(id),
  decision text not null check (decision in ('approved','rejected')),
  note text not null,
  decided_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['refund_requests','refund_decisions'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy tenant_isolation on %I
      using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)$p$, t);
    execute format('create trigger %I before update or delete on %I for each row execute function forbid_mutation()', t || '_immutable', t);
  end loop;
end $$;
grant select, insert on refund_requests, refund_decisions to campusos_app;
