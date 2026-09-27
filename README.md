# GIPE Dashboard

Centre de gestion du GIPE Villemandeur.

## Objectif

Réunir dans une interface unique la gestion du site, des conseils de classe, des classes/élèves du collège, de l'agenda et des paramètres de l'association, afin que le prochain bureau puisse reprendre le système sans avoir à connaître le code.

## Version actuelle

Cette première version est un **prototype fonctionnel d'interface** :

- tableau de bord ;
- gestion des classes ;
- classe TEST permanente ;
- import local de fichiers `.xls` / `.xlsx` du collège ;
- lecture automatique des onglets et comptage élèves/enseignants ;
- schéma Supabase cible ;
- documentation de l'architecture et des règles métier.

Les connexions Supabase/Google et l'écriture dans les dépôts existants ne sont volontairement pas activées à cette étape.

## Lancer le prototype

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Prochaine phase

1. Créer le dépôt GitHub `Gipevillemandeur/gipe-dashboard`.
2. Déployer le dashboard sur un environnement avec backend/server functions (par exemple Vercel), afin de ne pas exposer de secrets Google.
3. Créer le projet Supabase cible et appliquer `supabase/schema.sql`.
4. Implémenter l'import réel vers Supabase.
5. Générer le Google Sheets de compatibilité pour `appconseils`.
6. Remplacer progressivement les écrans `/admin` de `siteV2` par le centre de gestion.

## Important sécurité

Ne jamais committer de mots de passe, clés API, service-role keys ou autres secrets dans ce dépôt. Les données réelles d'élèves ne doivent pas être ajoutées au code source.
