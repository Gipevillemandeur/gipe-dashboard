-- GIPE Dashboard — Clôture annuelle v2
-- A exécuter UNE fois dans Supabase → SQL Editor.
-- Ajoute uniquement des colonnes : ne modifie ni ne supprime aucune donnée.

alter table public.gipe_year_closures
  add column if not exists moral_report text,
  add column if not exists perspectives text,
  add column if not exists notes text,
  add column if not exists drive_folder_url text,
  add column if not exists archived_at timestamptz;
