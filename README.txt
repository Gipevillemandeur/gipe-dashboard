GIPE Dashboard — mise à jour Trésorerie + Configuration

1. Remplacer app/api/tresorerie/route.ts
   - ajoute la suppression sécurisée d'une opération (DELETE)
   - reste limitée à l'année scolaire active et aux administrateurs

2. Remplacer app/tresorerie/page.tsx
   - ajoute un bouton Supprimer à côté de Modifier
   - demande une confirmation avant suppression

3. Remplacer app/configuration/page.tsx
   - titre : Configuration du tableau de bord
   - sous-texte : Gère les différents paramètres du tableau de bord.

Aucun changement SQL n'est nécessaire.
