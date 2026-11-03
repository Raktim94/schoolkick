-- Exam registration. The fee is an ordinary invoice, so payment, receipts, reconciliation and refunds all work unchanged.
create table exams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  subjects text[] not null check (cardinality(subjects) between 1 and 30),
  fee_base_minor bigint not null default 0 check (fee_base_minor >= 0),
  fee_per_subject_minor bigint not null default 0 check (fee_per_subject_minor >= 0),
  late_fee_minor bigint not null default 0 check (late_fee_minor >= 0),
  opens_on date not null,
  closes_on date not null,
  late_closes_on date,
  exam_date date,
  min_attendance_pct int check (min_attendance_pct between 1 and 100),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  check (closes_on >= opens_on and (late_closes_on is null or late_closes_on >= closes_on))
);
create table exam_registrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  exam_id uuid not null references exams(id),
  learner_id uuid not null references learners(id),
  invoice_id uuid not null references invoices(id),
  subjects text[] not null,
  accommodations text,
  late boolean not null default false,
  override_reason text, -- set when staff registered a learner who failed the eligibility rule
  registered_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (exam_id, learner_id)
);
create table exam_decisions (
  registration_id uuid primary key references exam_registrations(id),
  tenant_id uuid not null references tenants(id),
  decision text not null check (decision in ('approved','rejected')),
  note text not null,
  hall_ticket text,
  decided_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['exams','exam_registrations','exam_decisions'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy tenant_isolation on %I
      using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)$p$, t);
    execute format('create trigger %I before update or delete on %I for each row execute function forbid_mutation()', t || '_immutable', t);
  end loop;
end $$;
grant select, insert on exams, exam_registrations, exam_decisions to campusos_app;
