-- =====================================================================
-- GIPE Dashboard — Journal des modifications
-- A exécuter UNE fois dans Supabase → SQL Editor.
-- Crée la table qui alimente « Dernières modifications » sur le
-- tableau de bord. Ne modifie aucune donnée existante.
-- Les lignes de plus de 6 mois sont effacées automatiquement.
-- =====================================================================

create table if not exists public.gipe_activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  actor_email text,
  actor_position text,
  area text not null,
  summary text not null
);

create index if not exists gipe_activity_log_created_at_idx
  on public.gipe_activity_log (created_at desc);

-- Accessible uniquement par le serveur du dashboard.
alter table public.gipe_activity_log enable row level security;
