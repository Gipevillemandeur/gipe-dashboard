# Changelog — 27 septembre 2026

## Version préparée pour la mise en place manuelle

### Authentification

- Ajout du login Supabase.
- Ajout du middleware de protection des pages.
- Ajout de la gestion de session serveur avec cookies.
- Ajout de `gipe_admins` pour distinguer les comptes autorisés.

### Import collège

- Création d'un parser commun `.xls/.xlsx`.
- Détection des onglets `code classe` et `direction`.
- Détection des classes réelles.
- Déduplication des élèves et enseignants dans chaque classe.
- Récupération des codes de classe sans les afficher en clair dans l'interface.
- Endpoint `/api/import/preview`.
- Endpoint `/api/import/apply`.
- Taille maximale d'import : 10 Mo.

### Base Supabase

- Schéma privé complet.
- Classe `TEST` permanente.
- Fonction `replace_current_school_state`.
- RLS réservé aux administrateurs GIPE.
- Conservation des identifiants de classes existantes pour ne pas casser les dates de conseils déjà préparées.

### Documentation

- `docs/SETUP.md` : installation et première configuration.
- `docs/NEXT-STEPS.md` : prochaines fonctions à développer.
- `docs/ARCHITECTURE.md` : architecture métier et technique.

## V4 — configuration dashboard
- Ajout d'un espace Configuration pour modifier les codes de déverrouillage des conseils.
- Ajout d'un espace Direction, indépendant du fichier du collège.
- Un import sans onglet `direction` conserve désormais la direction enregistrée dans le dashboard.
- Un import sans codes conserve désormais les codes existants par classe.
- Le code de la classe TEST est conservé lors des imports.
