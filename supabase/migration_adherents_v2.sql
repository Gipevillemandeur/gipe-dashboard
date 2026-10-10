-- =====================================================================
-- GIPE Dashboard — Adhérents v2
-- A exécuter UNE fois dans Supabase → SQL Editor.
--
-- 1. Relie une recette de trésorerie à une adhésion
--    (ajout d'une colonne, aucune donnée modifiée).
-- 2. Crée la fonction d'enregistrement d'une adhésion :
--    - tout est enregistré d'un bloc, ou rien du tout ;
--    - deux enregistrements simultanés de la même personne
--      sont traités l'un après l'autre : le second est refusé ;
--    - la cotisation reçue crée / met à jour la recette
--      « Adhésions » dans la trésorerie.
-- =====================================================================

alter table public.gipe_transactions
  add column if not exists membership_id uuid
    references public.gipe_memberships(id) on delete set null;

create unique index if not exists gipe_transactions_membership_id_key
  on public.gipe_transactions (membership_id)
  where membership_id is not null;


-- Nom simplifié pour comparer : minuscules, sans accents, espaces uniques.
create or replace function public.gipe_simplify_name(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      lower(trim(coalesce(p_value, ''))),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ''’-',
      'aaaaaaceeeeiiiinooooouuuuyyoa   '
    ),
    '\s+', ' ', 'g'
  );
$$;


create or replace function public.gipe_save_membership(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_year_id uuid;
  v_membership_id uuid := nullif(p_payload->>'membershipId', '')::uuid;
  v_adherent_id uuid := nullif(p_payload->>'adherentId', '')::uuid;
  v_last_name text := trim(coalesce(p_payload->>'lastName', ''));
  v_first_name text := trim(coalesce(p_payload->>'firstName', ''));
  v_key text;
  v_existing record;
  v_shared text;
  v_child jsonb;
  v_child_id uuid;
  v_amount numeric := nullif(p_payload->>'amount', '')::numeric;
  v_paid boolean := coalesce((p_payload->>'paymentReceived')::boolean, false);
  v_payment_date date := nullif(p_payload->>'paymentDate', '')::date;
  v_payment_method text := nullif(p_payload->>'paymentMethod', '');
  v_cheque text := nullif(trim(coalesce(p_payload->>'chequeNumber', '')), '');
  v_label text;
begin
  if v_last_name = '' or v_first_name = '' then
    raise exception 'INVALID: Le nom et le prénom sont obligatoires.';
  end if;

  select id into v_year_id
  from public.school_years
  where is_active = true;

  if v_year_id is null then
    raise exception 'INVALID: Aucune année scolaire active.';
  end if;

  /*
   * VERROU : deux enregistrements de la même personne sur
   * la même année attendent leur tour (même à quelques
   * millisecondes d'écart). Le second verra donc le premier.
   */
  v_key := v_year_id::text || '|' ||
    public.gipe_simplify_name(v_last_name) || '|' ||
    public.gipe_simplify_name(v_first_name);

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  -- En modification : l'adhésion doit appartenir à l'année en cours.
  if v_membership_id is not null then
    select m.id, m.adherent_id into v_existing
    from public.gipe_memberships m
    where m.id = v_membership_id
      and m.school_year_id = v_year_id;

    if not found then
      raise exception 'INVALID: Adhésion introuvable pour l''année en cours.';
    end if;

    v_adherent_id := v_existing.adherent_id;

    -- Verrou aussi sur l'ancien nom (si on renomme).
    perform pg_advisory_xact_lock(hashtextextended(
      v_year_id::text || '|' || (
        select public.gipe_simplify_name(a.last_name) || '|' ||
               public.gipe_simplify_name(a.first_name)
        from public.gipe_adherents a where a.id = v_adherent_id
      ), 0));
  end if;

  /*
   * DOUBLON : même personne (nom + prénom, sans tenir compte
   * des majuscules ni des accents) déjà adhérente cette année.
   */
  select m.id, m.created_at, a.last_name, a.first_name into v_existing
  from public.gipe_memberships m
  join public.gipe_adherents a on a.id = m.adherent_id
  where m.school_year_id = v_year_id
    and m.id is distinct from v_membership_id
    and (
      (v_adherent_id is not null and m.adherent_id = v_adherent_id)
      or (
        public.gipe_simplify_name(a.last_name) = public.gipe_simplify_name(v_last_name)
        and public.gipe_simplify_name(a.first_name) = public.gipe_simplify_name(v_first_name)
      )
    )
  limit 1;

  if found then
    raise exception 'DUPLICATE: % % est déjà adhérent(e) cette année (enregistré le %).',
      upper(v_existing.last_name), v_existing.first_name,
      to_char(v_existing.created_at at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI:SS');
  end if;

  /*
   * ENFANT DÉJÀ RATTACHÉ à une autre adhésion de l'année
   * (ex. l'autre parent) : on prévient, sauf si confirmé.
   */
  if not coalesce((p_payload->>'allowSharedChildren')::boolean, false) then
    select string_agg(distinct upper(c.last_name) || ' ' || c.first_name, ', ')
    into v_shared
    from jsonb_array_elements(coalesce(p_payload->'children', '[]'::jsonb)) as pc(value)
    join public.gipe_membership_children mc on true
    join public.gipe_memberships m on m.id = mc.membership_id
    join public.gipe_children c on c.id = mc.child_id
    where m.school_year_id = v_year_id
      and m.id is distinct from v_membership_id
      and trim(coalesce(pc.value->>'lastName', '')) <> ''
      and public.gipe_simplify_name(c.last_name) = public.gipe_simplify_name(pc.value->>'lastName')
      and public.gipe_simplify_name(c.first_name) = public.gipe_simplify_name(pc.value->>'firstName')
      -- en modification : seuls les enfants AJOUTÉS sont vérifiés
      and not exists (
        select 1
        from public.gipe_membership_children mc2
        join public.gipe_children c2 on c2.id = mc2.child_id
        where mc2.membership_id = v_membership_id
          and public.gipe_simplify_name(c2.last_name) = public.gipe_simplify_name(pc.value->>'lastName')
          and public.gipe_simplify_name(c2.first_name) = public.gipe_simplify_name(pc.value->>'firstName')
      );

    if v_shared is not null then
      raise exception 'SHARED_CHILD: Déjà rattaché(s) à une autre adhésion cette année : %.', v_shared;
    end if;
  end if;

  /*
   * ADHÉRENT (parent)
   */
  if v_adherent_id is null then
    insert into public.gipe_adherents (last_name, first_name, address, phone, email)
    values (
      v_last_name, v_first_name,
      nullif(trim(coalesce(p_payload->>'address', '')), ''),
      nullif(trim(coalesce(p_payload->>'phone', '')), ''),
      nullif(trim(coalesce(p_payload->>'email', '')), '')
    )
    returning id into v_adherent_id;
  else
    update public.gipe_adherents set
      last_name = v_last_name,
      first_name = v_first_name,
      address = nullif(trim(coalesce(p_payload->>'address', '')), ''),
      phone = nullif(trim(coalesce(p_payload->>'phone', '')), ''),
      email = nullif(trim(coalesce(p_payload->>'email', '')), ''),
      updated_at = now()
    where id = v_adherent_id;

    if not found then
      raise exception 'INVALID: Adhérent introuvable.';
    end if;
  end if;

  if v_paid and v_payment_date is null then
    v_payment_date := (now() at time zone 'Europe/Paris')::date;
  end if;

  /*
   * ADHÉSION
   */
  if v_membership_id is null then
    insert into public.gipe_memberships (
      adherent_id, school_year_id, renewal, council_participation,
      board_member, ca_member, payment_received, payment_date,
      payment_method, cheque_number, amount
    ) values (
      v_adherent_id, v_year_id,
      coalesce((p_payload->>'renewal')::boolean, false),
      coalesce(nullif(p_payload->>'councilParticipation', ''), 'no'),
      coalesce((p_payload->>'boardMember')::boolean, false),
      coalesce((p_payload->>'caMember')::boolean, false),
      v_paid, v_payment_date, v_payment_method, v_cheque, v_amount
    )
    returning id into v_membership_id;
  else
    update public.gipe_memberships set
      renewal = coalesce((p_payload->>'renewal')::boolean, false),
      council_participation = coalesce(nullif(p_payload->>'councilParticipation', ''), 'no'),
      board_member = coalesce((p_payload->>'boardMember')::boolean, false),
      ca_member = coalesce((p_payload->>'caMember')::boolean, false),
      payment_received = v_paid,
      payment_date = v_payment_date,
      payment_method = v_payment_method,
      cheque_number = v_cheque,
      amount = v_amount,
      updated_at = now()
    where id = v_membership_id;

    delete from public.gipe_membership_children
    where membership_id = v_membership_id;
  end if;

  /*
   * ENFANTS
   * Un enfant déjà connu (même famille) est réutilisé ;
   * sinon il est créé.
   */
  for v_child in
    select value from jsonb_array_elements(coalesce(p_payload->'children', '[]'::jsonb))
  loop
    if trim(coalesce(v_child->>'lastName', '')) = ''
       or trim(coalesce(v_child->>'firstName', '')) = '' then
      continue;
    end if;

    v_child_id := nullif(v_child->>'id', '')::uuid;

    if v_child_id is not null and not exists (
      select 1
      from public.gipe_membership_children mc
      join public.gipe_memberships m on m.id = mc.membership_id
      where mc.child_id = v_child_id
        and m.adherent_id = v_adherent_id
    ) then
      v_child_id := null; -- enfant d'une autre famille : on n'y touche pas
    end if;

    if v_child_id is null then
      insert into public.gipe_children (last_name, first_name)
      values (trim(v_child->>'lastName'), trim(v_child->>'firstName'))
      returning id into v_child_id;
    else
      update public.gipe_children set
        last_name = trim(v_child->>'lastName'),
        first_name = trim(v_child->>'firstName'),
        updated_at = now()
      where id = v_child_id;
    end if;

    insert into public.gipe_membership_children (membership_id, child_id, class_id)
    values (v_membership_id, v_child_id, nullif(v_child->>'classId', '')::uuid);
  end loop;

  /*
   * TRÉSORERIE : la cotisation reçue = une recette « Adhésions »
   * reliée à l'adhésion (créée, mise à jour ou supprimée).
   */
  if v_paid and coalesce(v_amount, 0) > 0 then
    v_label := 'Cotisation ' || upper(v_last_name) || ' ' || v_first_name;

    insert into public.gipe_transactions (
      school_year_id, transaction_date, transaction_type, category,
      label, amount, payment_method, note, membership_id
    ) values (
      v_year_id, v_payment_date, 'income', 'Adhésions',
      v_label, round(v_amount, 2), v_payment_method,
      case when v_cheque is not null then 'Chèque n° ' || v_cheque end,
      v_membership_id
    )
    on conflict (membership_id) where membership_id is not null
    do update set
      transaction_date = excluded.transaction_date,
      label = excluded.label,
      amount = excluded.amount,
      payment_method = excluded.payment_method,
      note = excluded.note,
      updated_at = now();
  else
    delete from public.gipe_transactions
    where membership_id = v_membership_id;
  end if;

  return jsonb_build_object(
    'membershipId', v_membership_id,
    'adherentId', v_adherent_id
  );
end;
$$;
