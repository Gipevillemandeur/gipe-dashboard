-- =====================================================================
-- GIPE Dashboard — Trésorerie v3 : banque + caisse + justificatifs
-- A exécuter UNE fois dans Supabase → SQL Editor.
--
-- - Chaque opération appartient à un compte : 'bank' (banque) ou
--   'cash' (caisse). Les opérations existantes vont à la BANQUE.
-- - Nouveau type 'transfer' : mouvement entre la caisse et la banque
--   (ni recette ni dépense).
-- - Deux soldes de départ : banque (colonne existante initial_balance)
--   et caisse (nouvelle colonne initial_cash_balance).
-- - Justificatif : lien vers le fichier rangé dans le Google Drive.
-- - Une cotisation payée en espèces (page Adhérents) va dans la caisse.
--
-- Aucune donnée existante n'est modifiée ni supprimée.
-- =====================================================================

alter table public.gipe_transactions
  add column if not exists account text not null default 'bank',
  add column if not exists transfer_to text,
  add column if not exists receipt_file_id text,
  add column if not exists receipt_file_name text,
  add column if not exists receipt_url text;

alter table public.school_years
  add column if not exists initial_cash_balance numeric(12,2) not null default 0;

/*
 * Type d'opération : on remplace l'ancienne règle
 * (recette / dépense) par recette / dépense / mouvement.
 * « not valid » : les lignes existantes ne sont pas revérifiées.
 */
do $$
declare
  c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.gipe_transactions'::regclass
      and contype = 'c'
  loop
    if c.def ilike '%transaction_type%'
       or c.conname in ('gipe_transactions_account_check', 'gipe_transactions_transfer_check') then
      execute format('alter table public.gipe_transactions drop constraint %I', c.conname);
    end if;
  end loop;
end $$;

alter table public.gipe_transactions
  add constraint gipe_transactions_type_check
  check (transaction_type in ('income', 'expense', 'transfer')) not valid;

alter table public.gipe_transactions
  add constraint gipe_transactions_account_check
  check (account in ('bank', 'cash')) not valid;

alter table public.gipe_transactions
  add constraint gipe_transactions_transfer_check
  check (
    (transaction_type = 'transfer' and transfer_to in ('bank', 'cash') and transfer_to <> account)
    or (transaction_type <> 'transfer' and transfer_to is null)
  ) not valid;

/*
 * Cotisations (créées par la page Adhérents) :
 * espèces → caisse ; chèque, virement, en ligne… → banque.
 */
create or replace function public.gipe_membership_transaction_account()
returns trigger
language plpgsql
as $$
begin
  if new.membership_id is not null then
    new.account := case when new.payment_method = 'cash' then 'cash' else 'bank' end;
    new.transfer_to := null;
  end if;
  return new;
end;
$$;

drop trigger if exists gipe_membership_transaction_account on public.gipe_transactions;

create trigger gipe_membership_transaction_account
  before insert or update on public.gipe_transactions
  for each row
  execute function public.gipe_membership_transaction_account();

/*
 * Clôture d'année : soldes de fin calculés et reportés
 * séparément pour la banque et la caisse.
 * (Même fonctionnement qu'avant pour le reste.)
 */
alter table public.gipe_year_closures
  add column if not exists solde_banque numeric(12,2),
  add column if not exists solde_caisse numeric(12,2);

CREATE OR REPLACE FUNCTION public.gipe_cloturer_annee(p_new_year_label text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_current_year public.school_years%ROWTYPE;
  v_new_year public.school_years%ROWTYPE;

  v_total_adherents integer;
  v_by_class jsonb;

  v_total_recettes numeric := 0;
  v_total_depenses numeric := 0;
  v_solde_banque numeric := 0;
  v_solde_caisse numeric := 0;
  v_solde_final numeric := 0;

  v_closed_at timestamptz := now();
BEGIN
  p_new_year_label := NULLIF(trim(p_new_year_label), '');

  IF p_new_year_label IS NULL THEN
    RAISE EXCEPTION 'Le libellé de la nouvelle année scolaire est obligatoire.';
  END IF;

  SELECT * INTO v_current_year
  FROM public.school_years
  WHERE is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune année scolaire active.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.school_years WHERE label = p_new_year_label) THEN
    RAISE EXCEPTION 'L''année scolaire % existe déjà.', p_new_year_label;
  END IF;

  SELECT COUNT(*)::integer INTO v_total_adherents
  FROM public.gipe_memberships
  WHERE school_year_id = v_current_year.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('className', class_data.class_name, 'count', class_data.adherent_count)
      ORDER BY class_data.class_name
    ),
    '[]'::jsonb
  )
  INTO v_by_class
  FROM (
    SELECT c.name AS class_name, COUNT(DISTINCT gmc.membership_id)::integer AS adherent_count
    FROM public.gipe_membership_children gmc
    INNER JOIN public.classes c ON c.id = gmc.class_id
    INNER JOIN public.gipe_memberships gm ON gm.id = gmc.membership_id
    WHERE gm.school_year_id = v_current_year.id
    GROUP BY c.id, c.name
  ) AS class_data;

  /*
   * Recettes et dépenses : les mouvements entre la caisse
   * et la banque n'en font pas partie.
   */
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'income'), 0),
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'expense'), 0)
  INTO v_total_recettes, v_total_depenses
  FROM public.gipe_transactions
  WHERE school_year_id = v_current_year.id;

  /*
   * Solde de chaque compte = solde de départ
   *   + recettes du compte - dépenses du compte
   *   + mouvements reçus - mouvements envoyés.
   */
  SELECT
    COALESCE(v_current_year.initial_balance, 0) + COALESCE(SUM(
      CASE
        WHEN transaction_type = 'income' AND account = 'bank' THEN amount
        WHEN transaction_type = 'expense' AND account = 'bank' THEN -amount
        WHEN transaction_type = 'transfer' AND account = 'bank' THEN -amount
        WHEN transaction_type = 'transfer' AND transfer_to = 'bank' THEN amount
        ELSE 0
      END), 0),
    COALESCE(v_current_year.initial_cash_balance, 0) + COALESCE(SUM(
      CASE
        WHEN transaction_type = 'income' AND account = 'cash' THEN amount
        WHEN transaction_type = 'expense' AND account = 'cash' THEN -amount
        WHEN transaction_type = 'transfer' AND account = 'cash' THEN -amount
        WHEN transaction_type = 'transfer' AND transfer_to = 'cash' THEN amount
        ELSE 0
      END), 0)
  INTO v_solde_banque, v_solde_caisse
  FROM public.gipe_transactions
  WHERE school_year_id = v_current_year.id;

  v_solde_final := v_solde_banque + v_solde_caisse;

  INSERT INTO public.gipe_year_closures (
    school_year_id, total_adherents, adherents_by_class,
    total_recettes, total_depenses, solde, solde_banque, solde_caisse, closed_at
  )
  VALUES (
    v_current_year.id, v_total_adherents, v_by_class,
    v_total_recettes, v_total_depenses, v_solde_final, v_solde_banque, v_solde_caisse, v_closed_at
  );

  UPDATE public.school_years
  SET is_active = false, closed_at = v_closed_at
  WHERE id = v_current_year.id;

  /*
   * Nouvelle année : chaque compte repart de son solde de fin.
   */
  INSERT INTO public.school_years (label, is_active, initial_balance, initial_cash_balance)
  VALUES (p_new_year_label, true, v_solde_banque, v_solde_caisse)
  RETURNING * INTO v_new_year;

  RETURN jsonb_build_object(
    'success', true,
    'closedYear', v_current_year.label,
    'newYear', v_new_year.label,
    'totalAdherents', v_total_adherents,
    'adherentsByClass', v_by_class,
    'soldeInitial', COALESCE(v_current_year.initial_balance, 0) + COALESCE(v_current_year.initial_cash_balance, 0),
    'totalRecettes', v_total_recettes,
    'totalDepenses', v_total_depenses,
    'solde', v_solde_final,
    'soldeBanque', v_solde_banque,
    'soldeCaisse', v_solde_caisse,
    'nouveauSoldeInitial', v_new_year.initial_balance + v_new_year.initial_cash_balance,
    'closedAt', v_closed_at
  );
END;
$function$;
