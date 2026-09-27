-- GIPE Dashboard — schéma de données courant
-- À exécuter dans le projet Supabase utilisé par le dashboard.
-- Aucune donnée réelle n'est incluse ici.

create extension if not exists pgcrypto;

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists school_years_one_active_idx
  on public.school_years (is_active)
  where is_active;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  name text not null,
  level text,
  kind text not null default 'real' check (kind in ('real', 'demo')),
  access_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, name)
);

create index if not exists classes_active_idx on public.classes (school_year_id, active);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  last_name text not null,
  first_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists students_class_idx on public.students (class_id, active);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_teachers (
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject text not null default '',
  is_pp boolean not null default false,
  primary key (class_id, teacher_id, subject)
);

create table if not exists public.school_management (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  term text not null,
  meeting_date date,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now(),
  unique (class_id, term)
);

create table if not exists public.gipe_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists school_years_set_updated_at on public.school_years;
create trigger school_years_set_updated_at
before update on public.school_years
for each row execute function public.set_updated_at();

drop trigger if exists classes_set_updated_at on public.classes;
create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

drop trigger if exists teachers_set_updated_at on public.teachers;
create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

-- Active-state import.
-- The class TEST is deliberately kept outside the imported real classes.
create or replace function public.replace_current_school_state(
  p_school_year_label text,
  p_classes jsonb,
  p_direction jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year_id uuid;
  v_class jsonb;
  v_student jsonb;
  v_teacher jsonb;
  v_class_id uuid;
  v_teacher_id uuid;
  v_name text;
begin
  if p_school_year_label is null or p_school_year_label !~ '^\d{4}-\d{4}$' then
    raise exception 'Année scolaire invalide';
  end if;

  update public.school_years
  set is_active = false
  where label <> p_school_year_label;

  insert into public.school_years (label, is_active)
  values (p_school_year_label, true)
  on conflict (label) do update set is_active = true
  returning id into v_year_id;

  update public.school_years
  set is_active = (id = v_year_id)
  where id <> v_year_id;

  -- Ensure the permanent demonstration class exists for the active school year.
  insert into public.classes (school_year_id, name, level, kind, access_code, active)
  values (v_year_id, 'TEST', 'Démonstration', 'demo', '1234', true)
  on conflict (school_year_id, name) do update
    set kind = 'demo', level = 'Démonstration', access_code = '1234', active = true;

  -- Real classes not present in the new college file become inactive.
  update public.classes
  set active = false
  where school_year_id = v_year_id
    and kind = 'real';

  -- Rebuild the current team/student contents of every imported real class,
  -- while keeping the class identifier stable so scheduled council dates remain attached.
  for v_class in select value from jsonb_array_elements(coalesce(p_classes, '[]'::jsonb)) loop
    v_name := trim(v_class->>'name');
    if v_name is null or v_name = '' or upper(v_name) = 'TEST' then
      continue;
    end if;

    insert into public.classes (school_year_id, name, level, kind, access_code, active)
    values (
      v_year_id,
      v_name,
      nullif(trim(v_class->>'level'), ''),
      'real',
      nullif(trim(v_class->>'accessCode'), ''),
      true
    )
    on conflict (school_year_id, name) do update set
      level = excluded.level,
      access_code = excluded.access_code,
      kind = 'real',
      active = true
    returning id into v_class_id;

    delete from public.students where class_id = v_class_id;
    delete from public.class_teachers where class_id = v_class_id;

    for v_student in select value from jsonb_array_elements(coalesce(v_class->'students', '[]'::jsonb)) loop
      if trim(coalesce(v_student->>'lastName', '')) <> '' or trim(coalesce(v_student->>'firstName', '')) <> '' then
        insert into public.students (class_id, last_name, first_name, active)
        values (
          v_class_id,
          trim(coalesce(v_student->>'lastName', '')),
          trim(coalesce(v_student->>'firstName', '')),
          true
        );
      end if;
    end loop;

    for v_teacher in select value from jsonb_array_elements(coalesce(v_class->'teachers', '[]'::jsonb)) loop
      v_name := trim(coalesce(v_teacher->>'displayName', ''));
      if v_name = '' then continue; end if;

      insert into public.teachers (display_name, active)
      values (v_name, true)
      on conflict (display_name) do update set active = true
      returning id into v_teacher_id;

      insert into public.class_teachers (class_id, teacher_id, subject, is_pp)
      values (
        v_class_id,
        v_teacher_id,
        trim(coalesce(v_teacher->>'subject', '')),
        coalesce((v_teacher->>'isPP')::boolean, false)
      )
      on conflict do nothing;
    end loop;
  end loop;

  -- Teachers no longer present in the current file are retained as inactive rows.
  update public.teachers set active = false;
  update public.teachers t
  set active = true
  where exists (
    select 1
    from public.class_teachers ct
    join public.classes c on c.id = ct.class_id
    where ct.teacher_id = t.id
      and c.school_year_id = v_year_id
      and c.active = true
      and c.kind = 'real'
  );

  -- Replace current direction/management information.
  delete from public.school_management;
  for v_name in select value::text from jsonb_array_elements_text(coalesce(p_direction, '[]'::jsonb)) loop
    if trim(v_name) <> '' then
      insert into public.school_management (display_name, active)
      values (trim(v_name), true);
    end if;
  end loop;
end;
$$;

-- Security: dashboard data is private. Only registered GIPE admins can use it.
alter table public.school_years enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.class_teachers enable row level security;
alter table public.school_management enable row level security;
alter table public.class_meetings enable row level security;
alter table public.gipe_admins enable row level security;

-- Policies are intentionally scoped to gipe_admins rather than to all authenticated users.
drop policy if exists gipe_admins_self on public.gipe_admins;
create policy gipe_admins_self
on public.gipe_admins
for select to authenticated
using (user_id = auth.uid());


drop policy if exists school_years_admin_all on public.school_years;
create policy school_years_admin_all on public.school_years
for all to authenticated
using (exists (select 1 from public.gipe_admins where user_id = auth.uid()))
with check (exists (select 1 from public.gipe_admins where user_id = auth.uid()));

drop policy if exists classes_admin_all on public.classes;
create policy classes_admin_all on public.classes
for all to authenticated
using (exists (select 1 from public.gipe_admins where user_id = auth.uid()))
with check (exists (select 1 from public.gipe_admins where user_id = auth.uid()));

drop policy if exists students_admin_all on public.students;
create policy students_admin_all on public.students
for all to authenticated
using (exists (select 1 from public.gipe_admins where user_id = auth.uid()))
with check (exists (select 1 from public.gipe_admins where user_id = auth.uid()));

drop policy if exists teachers_admin_all on public.teachers;
create policy teachers_admin_all on public.teachers
for all to authenticated
using (exists (select 1 from public.gipe_admins where user_id = auth.uid()))
with check (exists (select 1 from public.gipe_admins where user_id = auth.uid()));

drop policy if exists class_teachers_admin_all on public.class_teachers;
create policy class_teachers_admin_all on public.class_teachers
for all to authenticated
using (exists (select 1 from public.gipe_admins where user_id = auth.uid()))
with check (exists (select 1 from public.gipe_admins where user_id = auth.uid()));

drop policy if exists school_management_admin_all on public.school_management;
create policy school_management_admin_all on public.school_management
for all to authenticated
using (exists (select 1 from public.gipe_admins where user_id = auth.uid()))
with check (exists (select 1 from public.gipe_admins where user_id = auth.uid()));

drop policy if exists class_meetings_admin_all on public.class_meetings;
create policy class_meetings_admin_all on public.class_meetings
for all to authenticated
using (exists (select 1 from public.gipe_admins where user_id = auth.uid()))
with check (exists (select 1 from public.gipe_admins where user_id = auth.uid()));

revoke all on function public.replace_current_school_state(text, jsonb, jsonb) from public;
revoke all on function public.replace_current_school_state(text, jsonb, jsonb) from anon;
revoke all on function public.replace_current_school_state(text, jsonb, jsonb) from authenticated;
-- The dashboard calls this function with the server-only Supabase secret key.
grant execute on function public.replace_current_school_state(text, jsonb, jsonb) to service_role;
