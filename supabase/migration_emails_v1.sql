-- =====================================================================
-- GIPE Dashboard — E-mails aux adhérents
-- A exécuter UNE fois dans Supabase → SQL Editor.
-- Ajoute le suivi des e-mails envoyés. Ne modifie aucune donnée
-- existante (la nouvelle colonne est vide pour tout le monde).
-- =====================================================================

-- Date d'envoi du reçu d'adhésion (vide = jamais envoyé).
alter table public.gipe_memberships
  add column if not exists receipt_sent_at timestamptz;

-- Un envoi (reçus ou message à un groupe).
create table if not exists public.gipe_email_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text,
  school_year_id uuid references public.school_years(id) on delete cascade,
  kind text not null check (kind in ('receipt', 'message', 'test')),
  audience text,
  subject text not null,
  body text
);

-- Les destinataires d'un envoi (sent_at vide = pas encore parti).
create table if not exists public.gipe_email_recipients (
  message_id uuid not null references public.gipe_email_messages(id) on delete cascade,
  membership_id uuid references public.gipe_memberships(id) on delete cascade,
  email text not null,
  sent_at timestamptz,
  error text,
  primary key (message_id, email)
);

create index if not exists gipe_email_recipients_sent_at_idx
  on public.gipe_email_recipients (sent_at);

-- Accessible uniquement par le serveur du dashboard.
alter table public.gipe_email_messages enable row level security;
alter table public.gipe_email_recipients enable row level security;
