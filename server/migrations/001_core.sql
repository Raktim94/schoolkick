create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  country text,
  created_at timestamptz not null default now()
);
create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  email text not null,
  name text not null,
  pw_hash text not null,
  roles text[] not null check (roles <@ array['owner','registrar','teacher','finance','guardian']),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);
create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id),
  tenant_id uuid not null references tenants(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on sessions (user_id);
create table learners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  external_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index on learners (tenant_id, external_id) where external_id is not null;
create table guardianships (
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references users(id),
  learner_id uuid not null references learners(id),
  primary key (user_id, learner_id)
);
create table classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  created_at timestamptz not null default now()
);
create table class_teachers (
  class_id uuid not null references classes(id),
  user_id uuid not null references users(id),
  primary key (class_id, user_id)
);
create table enrollments (
  class_id uuid not null references classes(id),
  learner_id uuid not null references learners(id),
  primary key (class_id, learner_id)
);
-- Append-only: a correction is a new row; current status is the latest row per (class, learner, day).
create table attendance_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id),
  class_id uuid not null references classes(id),
  learner_id uuid not null references learners(id),
  day date not null,
  status text not null check (status in ('present','absent','late','excused')),
  reason text,
  actor_id uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index on attendance_events (class_id, day, learner_id, id desc);
create table audit_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id),
  actor_id uuid references users(id),
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on audit_events (tenant_id, id desc);
create function forbid_mutation() returns trigger language plpgsql as
$$ begin raise exception '% is append-only', tg_table_name; end $$;
create trigger attendance_append_only before update or delete on attendance_events
  for each row execute function forbid_mutation();
create trigger audit_append_only before update or delete on audit_events
  for each row execute function forbid_mutation();
