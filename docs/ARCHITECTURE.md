# GIPE Dashboard — architecture cible

## Dépôts

- `siteV2` : site public du GIPE.
- `appconseils` : application de compte rendu des conseils de classe.
- `gipe-dashboard` : nouveau centre d'administration.

Le projet `cr-cc` est hors périmètre.

## Règles métier

1. Le fichier transmis régulièrement par le collège est la source de vérité pour les classes réelles, les élèves et les équipes pédagogiques de l'année active.
2. L'import remplace la situation actuelle sans validation ligne par ligne.
3. Le nombre de classes peut varier d'une année scolaire à l'autre.
4. La classe `TEST` est une classe de démonstration permanente, indépendante du fichier du collège, et ne doit jamais être supprimée par un import.
5. Les PDF de comptes rendus terminés ne sont pas archivés dans le dashboard : ils restent dans la boîte mail du GIPE selon le fonctionnement existant.
6. Les données réelles (élèves, enseignants, codes) ne doivent jamais être stockées dans GitHub public.
7. Les secrets Google / Supabase doivent rester côté serveur ou dans les secrets du fournisseur de déploiement.

## Architecture technique cible

Le dashboard est une application Next.js séparée. Contrairement au site public, il doit pouvoir utiliser des traitements côté serveur pour les intégrations privées (Supabase, Google).

```text
                         GIPE Dashboard
                               |
              +----------------+----------------+
              |                                 |
           Supabase                        Google APIs
              |                                 |
      +-------+-------+                         |
      |       |       |                         |
   élèves  classes  conseils                 Drive/Sheets
      |       |       |
      +-------+-------+
              |
        appconseils
              |
          PDF -> mail GIPE

siteV2 reste le site public.
```

## Import du fichier collège

Le prototype utilise SheetJS côté navigateur pour lire `.xls` et `.xlsx` sans transférer le fichier vers un service public. Dans la version connectée, après analyse et contrôle technique, le dashboard écrira les données dans Supabase.

Les onglets réservés `code classe` et `direction` sont traités à part. Tous les autres onglets correspondant à des classes réelles sont considérés comme faisant partie du fichier courant. `TEST` reste une donnée de démonstration gérée séparément.
