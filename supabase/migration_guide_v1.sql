-- =====================================================================
-- GIPE Dashboard — Guide de passation
-- A exécuter UNE fois dans Supabase → SQL Editor.
-- Crée une table pour enregistrer les sections du guide modifiées
-- par le Président. Ne modifie aucune donnée existante.
-- (Les textes d'origine sont dans le code : lib/guide-content.ts)
-- =====================================================================

create table if not exists public.gipe_guide_sections (
  slug text primary key,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Accessible uniquement par le serveur du dashboard.
alter table public.gipe_guide_sections enable row level security;
