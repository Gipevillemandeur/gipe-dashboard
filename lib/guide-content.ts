/*
 * Guide de passation — contenu d'origine.
 *
 * Chaque section peut être modifiée par le Président depuis
 * la page « Guide de passation » : le texte modifié est alors
 * enregistré dans Supabase (table gipe_guide_sections) et
 * remplace celui-ci. « Revenir au texte d'origine » efface
 * la version modifiée et réaffiche ce texte.
 *
 * Mise en forme possible dans les textes :
 *   ## Sous-titre
 *   - élément de liste
 *   1. étape numérotée
 *   **texte en gras**
 *   > encadré « bon à savoir »
 *   ! encadré « attention »
 *   (ligne vide = nouveau paragraphe)
 */

export type GuideSectionDefinition = {
  slug: string;
  title: string;
  summary: string;
  presidentOnly: boolean;
  body: string;
};

export const GUIDE_SECTIONS: GuideSectionDefinition[] = [
  {
    slug: 'bienvenue',
    title: 'Bienvenue',
    summary: 'À quoi sert ce dashboard et comment lire ce guide.',
    presidentOnly: false,
    body: `Bienvenue dans le centre de gestion du **GIPE Villemandeur** (Groupement Indépendant de Parents d’Élèves du collège Lucie Aubrac).

Ce dashboard réunit tout ce dont le bureau a besoin au quotidien : les classes et les conseils de classe, les réunions, les adhérents, la trésorerie, l’agenda, le site internet et les documents du Google Drive.

## Qui voit quoi ?
- Chaque membre du bureau a un **poste** (Président, Trésorier, Secrétaire…) et chaque poste donne accès à certaines rubriques du menu.
- Le **Président** a accès à tout, et il est le seul à pouvoir clôturer l’année et modifier ce guide.
- Les droits se règlent dans **Configuration → Membres du bureau**.

## Comment utiliser ce guide
- Le **calendrier de l’année** dit quoi faire et quand.
- Une **fiche par rubrique** explique les gestes courants et les pièges à éviter.
- La section **Le jour de la passation** sert au moment de transmettre le bureau.
- En cas de souci, regarde d’abord la section **Dépannage**.

> Ce guide est vivant : le Président peut modifier chaque section avec le bouton « Modifier ». N’hésite pas à le compléter avec ton expérience pour le bureau suivant.`,
  },
  {
    slug: 'calendrier',
    title: 'Le calendrier de l’année',
    summary: 'Ce qu’il faut faire, mois par mois.',
    presidentOnly: false,
    body: `## Septembre — rentrée
1. Vérifier en haut du tableau de bord que la bonne **année scolaire** est active (elle est créée au moment de la clôture de l’année précédente).
2. Récupérer auprès du collège le **listing des élèves** (fichier Excel) et l’importer : **Configuration → Importer le listing collège**.
3. Vérifier la **direction du collège** : Configuration → Direction (l’import n’y touche jamais).
4. Lancer la campagne d’**adhésions** : chaque cotisation payée s’enregistre dans Adhérents.
5. Mettre à jour le **site internet** (actualités de rentrée, agenda, documents).

## Avant chaque trimestre — conseils de classe
1. Créer les réunions des conseils de classe dans l’**Agenda** en cochant « Instances ».
2. **Générer les codes** des classes : Configuration → Gérer les classes.
3. Transmettre à chaque parent délégué le code de sa classe.
4. Après les conseils, **effacer les codes** pour que l’app ne soit plus accessible jusqu’au trimestre suivant.

## Toute l’année
- Saisir les **recettes et dépenses** dans la Trésorerie au fil de l’eau.
- Après chaque réunion, ouvrir la réunion dans **Scolarité → Instances** pour écrire le compte rendu et joindre les documents.
- Ranger les documents de l’association dans **Docs Drive**.

## Fin d’année (juin / juillet)
1. Vérifier que toutes les adhésions et toutes les opérations de trésorerie sont saisies.
2. Rédiger le **bilan moral** et les perspectives.
3. **Clôturer l’année** (Président) : voir la section « La clôture d’année ».
4. Vérifier dans Docs Drive que le dossier **Archives → année** contient bien le bilan, les listes et les instances.`,
  },
  {
    slug: 'scolarite',
    title: 'Scolarité : classes, conseils et instances',
    summary: 'Vue des classes, codes des conseils, réunions et comptes rendus.',
    presidentOnly: false,
    body: `## Vue des classes
- **Scolarité → Vue des classes** montre les classes de l’année, avec leurs élèves et leurs professeurs, tels qu’ils viennent du dernier import du collège.
- Si aucune classe n’apparaît, c’est que le listing n’a pas encore été importé pour l’année.

## L’app des conseils de classe
- Les parents délégués préparent le conseil depuis **l’app des conseils de classe** : ils choisissent leur classe et tapent le **code** fourni par le GIPE.
- Le compte rendu qu’ils remplissent est envoyé en PDF à **contact@gipevillemandeur.com**.
- Sécurité : après **3 codes faux**, l’appareil est bloqué pour cette classe. Il se débloque dès que le GIPE **change le code** de la classe (Configuration → Gérer les classes → régénérer le code de cette classe).
- La **classe TEST** (code 1234) sert à faire des essais ; elle n’est jamais bloquée.

## Instances (réunions)
- Une réunion se crée depuis l’**Agenda** en cochant la case « Instances » : elle apparaît alors dans **Scolarité → Instances**.
- En ouvrant une réunion, on peut écrire le **résumé / compte rendu** et joindre des **documents** (50 Mo maximum par fichier).
- Les réunions des **années clôturées** sont archivées dans le Drive et ne sont plus modifiables.

> Le tableau de bord affiche les 3 prochaines réunions dans « À faire » : un clic ouvre directement la réunion.`,
  },
  {
    slug: 'adherents',
    title: 'Adhérents',
    summary: 'Enregistrer les adhésions et les cotisations.',
    presidentOnly: false,
    body: `## Principe
- On n’enregistre **que les adhésions payées**.
- Une adhésion = un parent adhérent + ses enfants (avec leur classe) + le paiement.

## Enregistrer une adhésion
1. Cocher **« Renouvellement »** en haut si la famille était déjà adhérente : la recherche par nom pré-remplit alors la famille.
2. Vérifier ou compléter le parent et les enfants.
3. Indiquer le paiement (montant, date, moyen de paiement, n° de chèque le cas échéant).
4. Enregistrer.

## Ce que le dashboard fait tout seul
- La cotisation reçue crée automatiquement une **recette « Adhésions »** dans la Trésorerie (et la met à jour si on modifie l’adhésion). Inutile de la saisir deux fois.
- Il refuse les **doublons** : un même parent ne peut pas adhérer deux fois la même année.
- Il prévient si un enfant est **déjà rattaché à une autre adhésion** (l’autre parent, par exemple) : on peut alors confirmer.`,
  },
  {
    slug: 'tresorerie',
    title: 'Trésorerie',
    summary: 'Recettes, dépenses et solde de l’association.',
    presidentOnly: false,
    body: `- Chaque opération est une **recette** ou une **dépense**, avec une date, une catégorie, un libellé, un montant et un moyen de paiement.
- Le type (recette / dépense) n’est **jamais pré-sélectionné** : il faut le choisir à chaque fois, pour éviter les erreurs.
- Les cotisations des adhérents arrivent **automatiquement** (catégorie « Adhésions »).
- Le solde de fin d’année devient le **solde de départ** de l’année suivante au moment de la clôture.

> Astuce : saisir les opérations au fil de l’eau, avec le relevé bancaire à côté. Le bilan de fin d’année se fait alors tout seul.`,
  },
  {
    slug: 'agenda-site',
    title: 'Agenda et site internet',
    summary: 'L’agenda interne du bureau et le site public.',
    presidentOnly: false,
    body: `## Agenda interne
- L’**Agenda** sert au bureau : réunions, permanences, événements.
- Cocher **« Instances »** crée en plus la réunion dans Scolarité → Instances (pour le compte rendu et les documents).
- Un événement peut aussi être **publié sur le site internet**.
- Chaque nuit, les **événements passés sont supprimés** de l’agenda (et du site) : les réunions, elles, restent dans Instances.

## Site internet
Dans **Site internet**, on gère ce que voient les parents sur le site du GIPE :
- **Actualités** : les nouvelles de l’association.
- **Agenda** : les dates à venir.
- **Documents** : les documents à télécharger.
- **Alerte** : un bandeau d’information important.
- **Paramètres** : les informations générales du site.`,
  },
  {
    slug: 'drive',
    title: 'Docs Drive',
    summary: 'Les documents de l’association dans Google Drive.',
    presidentOnly: false,
    body: `- **Docs Drive** affiche le Google Drive de l’association : on peut ouvrir, télécharger, importer des fichiers et créer des dossiers.
- Les Google Docs / Sheets / Slides se téléchargent convertis en Word / Excel / PowerPoint.
- **Supprimer** envoie l’élément dans la **corbeille** de Google Drive : il reste récupérable pendant 30 jours depuis drive.google.com.
- Le dossier **Archives** reçoit chaque année, à la clôture, un sous-dossier (par exemple « 2026-2027 ») avec le bilan, les listes et les instances.

! Ne jamais supprimer ni renommer le dossier « Script ne pas toucher » : il contient le script d’archivage de fin d’année. Le dossier « Archives » peut être déplacé ou renommé, mais pas supprimé.

> En haut de la page, la ligne « Relié au compte… » indique quel compte Google est utilisé. Seul le Président peut le changer ou le reconnecter.`,
  },
  {
    slug: 'configuration',
    title: 'Configuration',
    summary: 'Import du collège, classes et codes, direction, membres du bureau.',
    presidentOnly: false,
    body: `## Importer le listing du collège
- Le collège fournit chaque année un fichier Excel des élèves (et parfois des équipes pédagogiques).
- Le dashboard affiche d’abord un **aperçu** : vérifier les classes et le nombre d’élèves avant de valider.
- L’import remplace les élèves, les classes et les équipes de l’année active. Il ne touche **jamais** aux codes ni à la direction.

## Gérer les classes et les codes
- **Générer les codes** : crée un code pour chaque classe (avant les conseils).
- **Régénérer** le code d’une seule classe : en cas de code perdu ou d’appareil bloqué.
- **Effacer tous les codes** : après les conseils du trimestre.
- La classe **TEST** garde toujours le code 1234.

## Direction
- La liste de la direction (nom + fonction) apparaît sur les comptes rendus des conseils.
- Elle se gère **uniquement ici**, et se trie toute seule : principal(e), adjoint(e), CPE, puis les autres.

## Membres du bureau
- Chaque poste a ses **droits** (rubriques accessibles).
- Pour donner accès à quelqu’un : l’ajouter sur son poste avec son adresse e-mail, puis cliquer sur **« Inviter / Envoyer l’accès »** ; il reçoit un e-mail pour créer son mot de passe.
- Le compte **SUPER ADMIN** est un accès de secours : il ne peut pas être modifié ni supprimé.`,
  },
  {
    slug: 'cloture',
    title: 'La clôture d’année',
    summary: 'Fermer l’année, produire le bilan et tout archiver.',
    presidentOnly: false,
    body: `La clôture se fait en fin d’année scolaire, par le **Président** uniquement, depuis **Configuration**.

## Avant de clôturer
- Toutes les adhésions et toutes les opérations de trésorerie sont saisies.
- Les comptes rendus des réunions de l’année sont écrits.

## Pendant la clôture
1. Le dashboard affiche un **aperçu** : adhésions, finances, instances de l’année.
2. Écrire le **bilan moral**, les **perspectives** et les notes. Laissés vides, le PDF contiendra des lignes pour écrire à la main.
3. Indiquer la **nouvelle année scolaire** (par exemple 2027-2028).
4. Cocher la confirmation et valider.

## Ce qui est produit
- Un **bilan annuel en PDF** et un **fichier Excel** des listes.
- Un dossier **Archives → année** dans le Drive : bilan, Adhérents, Trésorerie, Instances (fiches et documents des réunions).
- La nouvelle année démarre avec le **solde** de l’année clôturée.

! Action définitive : une année clôturée ne peut plus être modifiée.`,
  },
  {
    slug: 'passation',
    title: 'Le jour de la passation',
    summary: 'Transmettre le bureau au suivant, étape par étape.',
    presidentOnly: false,
    body: `## Pour le bureau qui part
1. Faire la **clôture d’année** si ce n’est pas déjà fait (ou s’assurer que le prochain bureau sait la faire).
2. Dans **Configuration → Membres du bureau**, ajouter les nouveaux membres sur leurs postes et les **inviter**.
3. Vérifier avec chaque nouveau membre qu’il arrive à se connecter et voit les bonnes rubriques.
4. Retirer les accès des membres qui quittent le bureau.
5. Transmettre au nouveau Président les **accès techniques** (voir la partie technique de ce guide, visible par le Président).

## Pour le nouveau bureau
1. Accepter l’invitation reçue par e-mail et créer son mot de passe.
2. Lire ce guide, en particulier le **calendrier de l’année**.
3. Faire un essai dans la **classe TEST** (code 1234) pour comprendre l’app des conseils.

> Conseil : faire la passation ensemble, devant le dashboard, en reprenant ce guide section par section.`,
  },
  {
    slug: 'depannage',
    title: 'Dépannage',
    summary: 'Les problèmes courants et leurs solutions.',
    presidentOnly: false,
    body: `## « Le lien d’invitation ne marche pas »
- Les liens d’invitation expirent. Renvoyer l’accès avec le bouton « Inviter / Envoyer l’accès » dans Configuration → Membres du bureau.
- Vérifier aussi les courriers indésirables.

## « Un parent est bloqué dans l’app des conseils »
- Après 3 codes faux, l’appareil est bloqué pour la classe. **Régénérer le code** de la classe (Configuration → Gérer les classes) et lui transmettre le nouveau code.

## « Docs Drive affiche : Google Drive n’est pas connecté »
- Le Président clique sur **« Connecter Google Drive »** et se connecte avec le compte Google de l’association.

## « Je ne vois pas une rubrique du menu »
- Ton poste n’a pas ce droit : demander au Président de le régler dans Configuration → Membres du bureau.

## « Aucune classe n’apparaît »
- Le listing du collège n’a pas encore été importé pour l’année active.

## « La page affiche une erreur »
- Recharger la page. Si l’erreur continue, faire une capture d’écran et prévenir le Président.`,
  },
  {
    slug: 'technique',
    title: 'Partie technique',
    summary: 'Comment le dashboard fonctionne et comment le mettre à jour.',
    presidentOnly: true,
    body: `Cette section n’est visible que par le Président.

## Les briques du dashboard
- **GitHub** : le code du dashboard (dépôt gipe-dashboard) et celui de l’app des conseils (dépôt appconseils).
- **Vercel** : héberge le dashboard sur **admin.gipevillemandeur.com**. Chaque modification envoyée sur GitHub est mise en ligne automatiquement en quelques minutes.
- **Supabase** : la base de données (classes, adhérents, trésorerie…), les comptes de connexion, les e-mails d’invitation et les fichiers des réunions.
- **Google** : le Drive de l’association, la connexion Google (projet Google Cloud) et le **script d’archivage** (Apps Script « script dashboard », dans le dossier « Script ne pas toucher »).
- **Resend** : envoie par e-mail les PDF des comptes rendus des conseils de classe.

## Réglages de Vercel (Settings → Environment Variables)
Ne jamais les montrer ni les copier dans un document partagé :
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY : accès à Supabase.
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET : connexion Google Drive.
- GOOGLE_DRIVE_APPS_SCRIPT_URL, GOOGLE_DRIVE_APPS_SCRIPT_TOKEN : script d’archivage.
- RESEND_API_KEY, CONSEILS_FROM_EMAIL, CONSEILS_ALLOWED_ORIGIN : app des conseils.
- CRON_SECRET : nettoyage automatique de l’agenda chaque nuit.

## Réglages du script d’archivage (Apps Script → Paramètres du projet → Propriétés du script)
- GIPE_ARCHIVES_FOLDER_ID : identifiant du dossier « Archives » du Drive.
- GIPE_DRIVE_TOKEN : doit être identique à GOOGLE_DRIVE_APPS_SCRIPT_TOKEN dans Vercel.

## Installer une mise à jour du code
1. S’il y a un fichier **.sql**, le lancer d’abord dans **Supabase → SQL Editor** (Run, puis vérifier « Success »).
2. Faire **clic droit → Extraire tout** sur le zip (ne jamais déposer les fichiers depuis le zip ouvert).
3. Sur GitHub : **Add file → Upload files**, glisser les **dossiers** (app, lib, supabase…), puis **Commit changes**.
4. Attendre que Vercel affiche « Ready », puis tester.

! Si des fichiers « page (1).tsx », « route (2).ts »… apparaissent à la racine du dépôt GitHub, c’est qu’ils ont été envoyés hors de leurs dossiers : les supprimer et renvoyer les dossiers.`,
  },
  {
    slug: 'comptes',
    title: 'Comptes et accès à transmettre',
    summary: 'La liste des comptes à transmettre au prochain Président.',
    presidentOnly: true,
    body: `Cette section n’est visible que par le Président. **Ne jamais y écrire de mot de passe** : seulement où et comment trouver les accès.

## À transmettre au prochain Président
- **Compte Google de l’association** (Drive, script d’archivage, projet Google Cloud) : adresse : à compléter.
- **GitHub** (organisation Gipevillemandeur) : propriétaire actuel : à compléter.
- **Vercel** (hébergement) : propriétaire actuel : à compléter.
- **Supabase** (base de données) : propriétaire actuel : à compléter.
- **Resend** (envoi d’e-mails) : propriétaire actuel : à compléter.
- **Nom de domaine gipevillemandeur.com** : chez quel hébergeur, date de renouvellement : à compléter.
- **Boîte e-mail contact@gipevillemandeur.com** : à compléter.

## Bonnes pratiques
- Utiliser autant que possible des comptes **au nom de l’association** (et pas des comptes personnels), pour que la passation se résume à changer un mot de passe.
- Ajouter le nouveau Président comme **propriétaire** sur GitHub, Vercel et Supabase **avant** de retirer l’ancien.
- Changer les mots de passe partagés après la passation.

> Clique sur « Modifier » pour remplacer les « à compléter » par les vraies informations.`,
  },
];

export function getGuideSection(slug: string) {
  return GUIDE_SECTIONS.find((section) => section.slug === slug) || null;
}
