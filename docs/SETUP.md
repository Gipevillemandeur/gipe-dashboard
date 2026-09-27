# GIPE Dashboard — installation et passage de relais

## 1. Préparer Supabase

Créer ou sélectionner le projet Supabase qui servira de base privée au dashboard.

Dans **SQL Editor**, exécuter `supabase/schema.sql`.

Créer ensuite le premier utilisateur dans **Authentication → Users** avec un mot de passe fort et confirmé.

Après création du compte, ajouter son UUID à `gipe_admins`. Par exemple, avec l'adresse du compte :

```sql
insert into public.gipe_admins (user_id)
select id
from auth.users
where email = 'ADRESSE_ADMIN_ICI'
on conflict (user_id) do nothing;
```

Ne jamais mettre le mot de passe ou la clé secrète dans GitHub.

## 2. Configurer le dashboard

Copier `.env.example` vers `.env.local` puis renseigner :

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_DEFAULT_SCHOOL_YEAR=2026-2027
```

`SUPABASE_SECRET_KEY` reste uniquement côté serveur.

## 3. Lancer

```bash
npm install
npm run build
npm run dev
```

Ouvrir `http://localhost:3000`.

Le dashboard redirige automatiquement vers `/login` lorsqu'aucune session Supabase valide n'est présente.

## 4. Tester l'import

1. Se connecter avec un compte présent dans `gipe_admins`.
2. Ouvrir **Importer le collège**.
3. Choisir le fichier `.xls` ou `.xlsx` envoyé par le collège.
4. Vérifier le nombre de classes et d'élèves détectés.
5. Choisir l'année scolaire.
6. Appliquer l'import.

L'import réécrit la situation courante des classes réelles. La classe `TEST` est indépendante et conservée.

Les dates de conseils sont liées à l'identifiant de classe et ne sont pas supprimées pour une classe qui reste présente lors d'un nouvel import.

## 5. Ce qui reste à faire ensuite

- brancher la page **Conseils** sur Supabase ;
- ajouter la gestion des dates/termes/codes des conseils ;
- générer la source compatible avec `appconseils` ;
- reprendre dans le dashboard les fonctions `/admin` du site `siteV2` ;
- créer le guide de passation complet pour le prochain bureau ;
- déployer le dashboard sur une plateforme capable d'exécuter les Route Handlers Next.js.

## Règle de sécurité

Le dépôt GitHub peut rester public uniquement tant qu'il ne contient que du code et des données de démonstration. Les élèves, enseignants, codes réels et secrets doivent rester dans la base privée et les variables d'environnement du déploiement.
