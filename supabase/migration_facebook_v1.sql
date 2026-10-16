-- =====================================================================
-- GIPE Dashboard — Page Facebook
-- A exécuter UNE fois dans Supabase → SQL Editor
-- (après migration_droits_v1.sql).
--
-- 1. Rubrique « Facebook » dans les droits (Aucun · Voir · Modifier).
-- 2. Table qui garde la connexion à la Page Facebook de l'association.
--    Elle n'est lisible que par le serveur du dashboard (jamais par
--    le navigateur) : le jeton de la Page n'en sort pas.
-- Sans danger si on le relance.
-- =====================================================================

insert into public.office_permissions (code, label)
select v.code, v.label
from (
  values
    ('facebook',      'Facebook'),
    ('facebook_view', 'Facebook (voir)')
) as v(code, label)
where not exists (
  select 1
  from public.office_permissions p
  where p.code = v.code
);

create table if not exists public.gipe_facebook_connection (
  -- Une seule connexion pour toute l'association.
  id            smallint primary key default 1 check (id = 1),
  page_id       text,
  page_name     text,
  page_token    text,
  facebook_user text,
  -- Plusieurs Pages possibles : liste en attente du choix du Président.
  pending_pages jsonb,
  connected_by  uuid,
  updated_at    timestamptz not null default now()
);

alter table public.gipe_facebook_connection enable row level security;

-- Aucune règle d'accès : seul le serveur (clé « service role ») peut lire.
revoke all on public.gipe_facebook_connection from anon, authenticated;

-- Vérification : doit afficher « Facebook » et « Facebook (voir) ».
select code, label
from public.office_permissions
where code in ('facebook', 'facebook_view')
order by code;
