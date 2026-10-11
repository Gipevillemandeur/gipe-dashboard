-- =====================================================================
-- GIPE Dashboard — E-mails : texte du reçu modifiable
-- A exécuter UNE fois dans Supabase → SQL Editor
-- (après migration_emails_v1.sql). Ne modifie aucune donnée existante.
-- =====================================================================

create table if not exists public.gipe_email_templates (
  key text primary key,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Accessible uniquement par le serveur du dashboard.
alter table public.gipe_email_templates enable row level security;
