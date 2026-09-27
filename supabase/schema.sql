-- Schéma cible du futur GIPE Dashboard.
-- Ce fichier définit la structure ; aucune donnée réelle n'est incluse.

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  name text not null,
  level text,
  kind text not null default 'real' check (kind in ('real','demo')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_year_id, name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  last_name text not null,
  first_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.class_teachers (
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject text not null,
  is_pp boolean not null default false,
  primary key (class_id, teacher_id, subject)
);

create table if not exists public.school_management (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text,
  active boolean not null default true
);

create table if not exists public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  term text not null,
  meeting_date date,
  access_code text,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  created_at timestamptz not null default now()
);

-- Important : la classe TEST est une donnée de démonstration permanente.
-- Le flux d'import doit toujours l'ignorer lorsqu'il remplace les classes réelles,
-- puis la conserver / recréer si nécessaire dans l'année active.
