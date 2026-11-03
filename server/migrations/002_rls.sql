-- Defence in depth: Postgres itself refuses cross-tenant rows, independent of application code.
-- Requests run as `campusos_app` (via SET LOCAL ROLE) with app.tenant_id set for the transaction.
do $$ begin
  if not exists (select from pg_roles where rolname = 'campusos_app') then create role campusos_app nologin; end if;
  execute format('grant campusos_app to %I', current_user);
end $$;

alter table enrollments add column tenant_id uuid references tenants(id);
update enrollments e set tenant_id = c.tenant_id from classes c where c.id = e.class_id;
alter table enrollments alter column tenant_id set not null;
alter table class_teachers add column tenant_id uuid references tenants(id);
update class_teachers t set tenant_id = c.tenant_id from classes c where c.id = t.class_id;
alter table class_teachers alter column tenant_id set not null;

do $$ declare t text; begin
  foreach t in array array['learners','guardianships','classes','class_teachers','enrollments','attendance_events','audit_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy tenant_isolation on %I
      using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)$p$, t);
  end loop;
end $$;

grant usage on schema public to campusos_app;
grant select, insert, update, delete on learners, guardianships, classes, class_teachers, enrollments to campusos_app;
grant select, insert on attendance_events, audit_events to campusos_app; -- append-only at the privilege level too
grant select, insert, update on users to campusos_app;
grant select on tenants to campusos_app;
grant usage, select on all sequences in schema public to campusos_app;
