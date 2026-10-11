-- =====================================================================
-- GIPE Dashboard — Ménage automatique après la clôture
-- A exécuter UNE fois dans Supabase → SQL Editor.
-- Crée une fonction. Ne supprime RIEN au moment où on la crée :
-- elle n'agit qu'à la fin de l'archivage d'une clôture d'année.
--
-- Une fois l'archivage dans le Drive terminé :
--   1. les documents des réunions de l'année clôturée sont retirés
--      de Supabase (ils sont dans le Drive) ;
--   2. on garde l'année en cours + les 2 dernières années clôturées ;
--      les années plus anciennes (déjà archivées dans le Drive) sont
--      vidées : adhérents, enfants, trésorerie, réunions, classes,
--      élèves, historique d'import.
-- On garde toujours : l'année elle-même et sa ligne de clôture
-- (pour les comparaisons d'une année sur l'autre).
--
-- Tout se fait d'un bloc : en cas de problème, RIEN n'est supprimé.
-- =====================================================================

create or replace function public.gipe_cleanup_after_archive(
  p_year_id uuid,
  p_keep integer default 2
)
returns jsonb
language plpgsql
as $$
declare
  v_files text[] := '{}';
  v_more text[];
  v_years uuid[];
  v_labels text[];
  v_memberships uuid[];
  v_adherents uuid[];
  v_children uuid[];
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
begin
  -- Un seul ménage à la fois.
  perform pg_advisory_xact_lock(hashtextextended('gipe_cleanup_after_archive', 0));

  if not exists (
    select 1 from public.gipe_year_closures
    where school_year_id = p_year_id
      and archived_at is not null
  ) then
    raise exception 'NOT_ARCHIVED: l''archivage de cette année n''est pas terminé, aucun ménage effectué.';
  end if;

  /*
   * 1. Documents des réunions de l'année clôturée.
   */
  with deleted as (
    delete from public.instance_meeting_documents d
    using public.instance_meetings m
    where d.meeting_id = m.id
      and m.school_year_id = p_year_id
    returning d.file_url
  )
  select coalesce(array_agg(file_url) filter (where file_url is not null), '{}')
  into v_files
  from deleted;

  /*
   * 2. Années trop anciennes : non active, archivée, et hors
   *    des p_keep dernières années clôturées.
   */
  select
    coalesce(array_agg(y.id), '{}'),
    coalesce(array_agg(y.label order by y.label), '{}')
  into v_years, v_labels
  from public.school_years y
  join public.gipe_year_closures c
    on c.school_year_id = y.id
   and c.archived_at is not null
  where not y.is_active
    and y.id not in (
      select y2.id
      from public.school_years y2
      join public.gipe_year_closures c2 on c2.school_year_id = y2.id
      where not y2.is_active
      order by y2.label desc
      limit greatest(p_keep, 1)
    );

  if array_length(v_years, 1) is null then
    return jsonb_build_object(
      'files', to_jsonb(v_files),
      'purgedYears', '[]'::jsonb,
      'counts', v_counts
    );
  end if;

  -- Réunions et leurs documents
  with deleted as (
    delete from public.instance_meeting_documents d
    using public.instance_meetings m
    where d.meeting_id = m.id
      and m.school_year_id = any(v_years)
    returning d.file_url
  )
  select coalesce(array_agg(file_url) filter (where file_url is not null), '{}')
  into v_more
  from deleted;

  v_files := v_files || v_more;

  delete from public.instance_meetings where school_year_id = any(v_years);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('reunions', v_n);

  -- Trésorerie
  delete from public.gipe_transactions where school_year_id = any(v_years);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('operations', v_n);

  -- Adhésions, puis adhérents et enfants qui n'ont plus aucune adhésion
  select
    coalesce(array_agg(m.id), '{}'),
    coalesce(array_agg(distinct m.adherent_id), '{}')
  into v_memberships, v_adherents
  from public.gipe_memberships m
  where m.school_year_id = any(v_years);

  select coalesce(array_agg(distinct mc.child_id), '{}')
  into v_children
  from public.gipe_membership_children mc
  where mc.membership_id = any(v_memberships);

  delete from public.gipe_membership_children where membership_id = any(v_memberships);

  delete from public.gipe_memberships where id = any(v_memberships);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('adhesions', v_n);

  delete from public.gipe_children c
  where c.id = any(v_children)
    and not exists (
      select 1 from public.gipe_membership_children mc where mc.child_id = c.id
    );

  delete from public.gipe_adherents a
  where a.id = any(v_adherents)
    and not exists (
      select 1 from public.gipe_memberships m where m.adherent_id = a.id
    );
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('adherents', v_n);

  -- Classes (et, avec elles, élèves, équipes, codes) + historique d'import
  update public.gipe_membership_children
  set class_id = null
  where class_id in (
    select id from public.classes where school_year_id = any(v_years)
  );

  delete from public.students
  where class_id in (select id from public.classes where school_year_id = any(v_years));

  delete from public.class_teachers
  where class_id in (select id from public.classes where school_year_id = any(v_years));

  delete from public.classes where school_year_id = any(v_years);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('classes', v_n);

  delete from public.gipe_college_imports where school_year_id = any(v_years);

  return jsonb_build_object(
    'files', to_jsonb(v_files),
    'purgedYears', to_jsonb(v_labels),
    'counts', v_counts
  );
end;
$$;
