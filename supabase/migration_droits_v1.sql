-- =====================================================================
-- GIPE Dashboard — Droits « Voir » / « Modifier »
-- A exécuter UNE fois dans Supabase → SQL Editor.
--
-- Ajoute un droit « Voir » (lecture seule) pour 6 rubriques.
-- Dans Configuration → Membres du bureau, chaque rubrique se règle
-- ensuite sur : Aucun · Voir · Modifier.
--
-- Rien ne change pour les postes existants : ceux qui pouvaient
-- modifier une rubrique gardent « Modifier ».
-- Sans danger si on le relance (rien n'est ajouté deux fois).
-- =====================================================================

insert into public.office_permissions (code, label)
select v.code, v.label
from (
  values
    ('treasury_view',  'Trésorerie (voir)'),
    ('members_view',   'Adhérents (voir)'),
    ('schooling_view', 'Scolarité (voir)'),
    ('agenda_view',    'Agenda (voir)'),
    ('website_view',   'Site internet (voir)'),
    ('drive_view',     'Docs Drive (voir)')
) as v(code, label)
where not exists (
  select 1
  from public.office_permissions p
  where p.code = v.code
);

-- Vérification : doit afficher les 6 lignes « (voir) ».
select code, label
from public.office_permissions
where code like '%\_view'
order by label;
