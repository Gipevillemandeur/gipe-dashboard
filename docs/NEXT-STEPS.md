# GIPE Dashboard — avancement

## Préparé dans cette version

- Authentification Supabase par email/mot de passe.
- Session Supabase côté serveur avec cookies.
- Protection des pages par middleware.
- Comptes autorisés via la table privée `gipe_admins`.
- Parser commun des fichiers `.xls` / `.xlsx` du collège.
- Détection des classes, élèves, enseignants, direction et codes de classe.
- Aperçu de l'import avant application.
- Endpoint serveur d'application de l'import.
- Fonction SQL transactionnelle pour remplacer l'état courant.
- Classe `TEST` permanente, hors import collège.
- Conservation des identifiants de classes afin de ne pas casser les dates de conseils déjà préparées.
- Règles RLS du dashboard.
- Documentation d'installation et de passage de relais.

## À développer ensuite

### 1. Conseils de classe

Brancher `/conseils` sur Supabase et afficher :

- classes actives ;
- effectifs ;
- équipe pédagogique ;
- direction ;
- code d'accès ;
- date du conseil ;
- trimestre ;
- état : brouillon / ouvert / fermé.

### 2. Compatibilité avec `appconseils`

Créer une couche de synchronisation qui expose uniquement les données nécessaires à l'application de conseil de classe. Le fichier Google Sheets actuel peut rester comme compatibilité transitoire.

### 3. Gestion du site

Reprendre progressivement dans le dashboard les fonctions actuellement présentes dans `siteV2` : actualités, événements, documents, bandeau et paramètres.

### 4. Déploiement

Déployer sur une plateforme prenant en charge Next.js côté serveur. Renseigner les variables d'environnement dans les secrets de la plateforme.

### 5. Passation

Ajouter un écran « Guide de passation » avec les opérations annuelles :

1. recevoir le fichier du collège ;
2. importer ;
3. contrôler les éventuelles anomalies ;
4. vérifier les conseils ;
5. ouvrir les conseils ;
6. utiliser `TEST` pour les démonstrations ;
7. maintenir le site depuis le même centre de gestion.
