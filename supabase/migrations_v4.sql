-- GIPE Dashboard V4 — migration non destructive
-- A executer une seule fois dans Supabase SQL Editor.
-- Cette migration ne supprime aucune donnee.

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
    set kind = 'demo', level = 'Démonstration', active = true;

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
      access_code = coalesce(excluded.access_code, public.classes.access_code),
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
  update public.teachers set active = false where active = true;
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

  -- Replace current direction/management information only when the source file provides it.
  -- The college workbook may not contain a direction sheet; in that case preserve the current data.
  if jsonb_array_length(coalesce(p_direction, '[]'::jsonb)) > 0 then
    delete from public.school_management;
    for v_name in select value::text from jsonb_array_elements_text(coalesce(p_direction, '[]'::jsonb)) loop
      if trim(v_name) <> '' then
        insert into public.school_management (display_name, active)
        values (trim(v_name), true);
      end if;
    end loop;
  end if;
end;
$$;
