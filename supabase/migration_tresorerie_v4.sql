-- =====================================================================
-- GIPE Dashboard — Trésorerie v4 : chèques à remettre
-- A exécuter UNE fois dans Supabase → SQL Editor
-- (après migration_tresorerie_v3.sql).
--
-- - Nouveau « compte » 'cheques' : chèques reçus, pas encore déposés
--   à la banque. Ils ne comptent sur le compte bancaire qu'une fois
--   « remis en banque » (date de remise dans deposited_at).
-- - Toute recette payée par chèque arrive dans 'cheques', y compris
--   les cotisations saisies dans Adhérents.
-- - Les recettes par chèque déjà saisies passent en « à remettre » :
--   indique ensuite la date de remise de celles déjà déposées.
-- - La clôture de l'année est refusée tant qu'il reste des chèques
--   à remettre.
-- =====================================================================

alter table public.gipe_transactions
  add column if not exists deposited_at date;

alter table public.gipe_transactions
  drop constraint if exists gipe_transactions_account_check;

alter table public.gipe_transactions
  add constraint gipe_transactions_account_check
  check (account in ('bank', 'cash', 'cheques')) not valid;

-- Un chèque en attente est forcément une recette.
alter table public.gipe_transactions
  drop constraint if exists gipe_transactions_cheques_check;

alter table public.gipe_transactions
  add constraint gipe_transactions_cheques_check
  check (account <> 'cheques' or transaction_type = 'income') not valid;

/*
 * Cotisations (page Adhérents) :
 *   espèces → caisse ; chèque → chèques à remettre
 *   (ou banque s'il a déjà été remis) ; le reste → banque.
 */
create or replace function public.gipe_membership_transaction_account()
returns trigger
language plpgsql
as $$
begin
  if new.membership_id is not null then
    new.transfer_to := null;

    if new.payment_method = 'cash' then
      new.account := 'cash';
      new.deposited_at := null;
    elsif new.payment_method = 'cheque' then
      -- Chèque remis (date de remise connue) → banque ; sinon en attente.
      new.account := case when new.deposited_at is not null then 'bank' else 'cheques' end;
    else
      new.account := 'bank';
      new.deposited_at := null;
    end if;
  end if;

  return new;
end;
$$;

/*
 * Recettes par chèque déjà saisies (pas encore remises) :
 * elles passent dans « chèques à remettre ».
 */
update public.gipe_transactions t
set account = 'cheques'
from public.school_years y
where y.id = t.school_year_id
  and y.is_active
  and t.transaction_type = 'income'
  and t.payment_method = 'cheque'
  and t.account = 'bank'
  and t.deposited_at is null;

/*
 * Clôture : refusée s'il reste des chèques à remettre
 * (sinon ils seraient perdus dans le report des soldes).
 */
create or replace function public.gipe_check_no_pending_cheques()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  if old.is_active and not new.is_active then
    select count(*) into v_count
    from public.gipe_transactions
    where school_year_id = new.id
      and account = 'cheques';

    if v_count > 0 then
      raise exception 'Il reste % chèque(s) à remettre en banque : fais la remise (Trésorerie → Chèques à remettre) avant de clôturer l''année.', v_count;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists gipe_check_no_pending_cheques on public.school_years;

create trigger gipe_check_no_pending_cheques
  before update on public.school_years
  for each row
  execute function public.gipe_check_no_pending_cheques();
