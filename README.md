# GIPE Dashboard

Centre de gestion du GIPE Villemandeur.

## Dépôts concernés

- `siteV2` : site public du GIPE.
- `appconseils` : application de compte rendu des conseils de classe.
- `gipe-dashboard` : centre de gestion administratif.
- `cr-cc` : projet indépendant, hors périmètre.

## Ce qui est déjà préparé

- tableau de bord GIPE ;
- gestion des classes ;
- classe `TEST` permanente et indépendante des données du collège ;
- import des fichiers `.xls` / `.xlsx` du collège ;
- détection des classes, élèves, enseignants, direction et codes de classe ;
- aperçu avant application ;
- authentification Supabase par email/mot de passe ;
- protection des routes via session Supabase et cookies ;
- contrôle des droits via `gipe_admins` ;
- application de l'import côté serveur ;
- remplacement transactionnel de l'état courant dans Supabase ;
- règles RLS ;
- documentation d'installation et de passation.

## Principe métier

Le fichier transmis par le collège est la source de vérité pour l'état courant : classes, élèves et équipes pédagogiques. Le nombre de classes peut donc changer d'une année à l'autre.

L'import ne demande pas de validation ligne par ligne. Le dashboard signale uniquement les anomalies techniques détectées.

La classe `TEST` est une classe de démonstration permanente et n'est jamais supprimée par l'import.

Les comptes rendus PDF terminés restent dans la boîte mail du GIPE ; ils ne sont pas archivés dans le dashboard.

## Installation

Voir [`docs/SETUP.md`](docs/SETUP.md).

```bash
npm install
npm run dev
```

Le projet doit être déployé sur un environnement capable d'exécuter les Route Handlers Next.js. Ne pas utiliser un export purement statique pour le dashboard.

## Variables d'environnement

Copier `.env.example` vers `.env.local`.

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_DEFAULT_SCHOOL_YEAR=2026-2027
```

La clé `SUPABASE_SECRET_KEY` est strictement serveur et ne doit jamais être préfixée par `NEXT_PUBLIC_`.

## Import collège

Le workflow cible est :

1. Le collège transmet son fichier `.xls` ou `.xlsx`.
2. Le bureau l'importe dans **Importer le collège**.
3. Le fichier est analysé.
4. Le dashboard affiche le nombre de classes, élèves, enseignants et informations de direction détectés.
5. L'administrateur applique l'import.
6. Les classes réelles deviennent l'état courant de l'année active.
7. `TEST` est conservée séparément.

Le fichier n'est pas enregistré dans GitHub.

## Compatibilité future

Le dashboard devient progressivement le référentiel central. `appconseils` pourra ensuite récupérer les données depuis une couche de synchronisation dédiée, avec le Google Sheets actuel conservé uniquement comme compatibilité transitoire.

## Sécurité

Le dépôt GitHub peut rester public uniquement s'il contient du code et des données de démonstration. Ne jamais ajouter :

- noms d'élèves réels ;
- listes d'enseignants réelles ;
- vrais codes de classes ;
- mots de passe ;
- clés API ;
- clés Supabase secrètes ;
- fichiers transmis par le collège.
