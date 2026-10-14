'use client';

import { useEffect, useState } from 'react';

/*
 * Droits de la personne connectée, côté navigateur.
 *
 * Sert uniquement à MASQUER les boutons de modification
 * pour les personnes qui ont seulement « Voir » une rubrique.
 * La vraie protection est faite par le serveur (routes /api) :
 * même si un bouton apparaissait, l'enregistrement serait refusé.
 *
 *   const { canEdit } = useCanEdit('treasury');
 *
 * Pendant le chargement, canEdit vaut false (aucun bouton
 * de modification n'apparaît puis disparaît).
 */

let cache: Promise<string[]> | null = null;
let cachedAt = 0;

function loadPermissions(): Promise<string[]> {
  // Relu au plus tard toutes les 60 s (droits modifiés entre-temps).
  if (!cache || Date.now() - cachedAt > 60_000) {
    cachedAt = Date.now();
    cache = fetch('/api/auth/access', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        Array.isArray(data?.permissions) ? (data.permissions as string[]) : []
      )
      .catch(() => {
        cache = null;
        return [];
      });
  }

  return cache;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadPermissions().then((list) => {
      if (!cancelled) setPermissions(list);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return permissions;
}

export function useCanEdit(section: string) {
  const permissions = usePermissions();

  return {
    loaded: permissions !== null,
    canEdit: permissions !== null && permissions.includes(section),
    readOnly:
      permissions !== null &&
      !permissions.includes(section) &&
      permissions.includes(`${section}_view`),
  };
}
