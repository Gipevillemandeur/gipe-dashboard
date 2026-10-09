/*
 * =========================================================
 * RÈGLES D'ACCÈS — SOURCE UNIQUE
 * =========================================================
 *
 * C'est le SEUL endroit où l'on décide qui a le droit
 * de faire quoi. Tout le site (garde d'entrée, menu,
 * API, tableau de bord) passe par ici.
 *
 * Trois cas possibles :
 *
 * 1. SUPER ADMIN
 *    Un seul compte, tous les droits.
 *    Défini uniquement dans Supabase (table
 *    office_super_admin). Impossible à modifier
 *    depuis le dashboard.
 *
 * 2. PRÉSIDENT
 *    Tous les droits. Reconnu par le nom du poste
 *    (« Président », « Présidente », « President »…).
 *
 * 3. AUTRES POSTES
 *    Uniquement les autorisations cochées dans
 *    Configuration → Membres du bureau.
 *    Si une personne occupe plusieurs postes, elle
 *    cumule les autorisations.
 *
 * Ce fichier ne dépend pas de Next.js : il peut être
 * utilisé aussi bien par le garde d'entrée
 * (middleware) que par les pages et l'API.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const FULL_PERMISSIONS = [
  'dashboard',
  'schooling',
  'members',
  'treasury',
  'website',
  'agenda',
  'drive',
  'configuration',
  'office_members',
];

export type OfficeAccess = {
  authenticated: boolean;
  authorized: boolean;
  isSuperAdmin: boolean;
  isPresident: boolean;
  positionId: string | null;
  positionName: string | null;
  permissions: string[];
  userId: string | null;
  email: string | null;
};

export function anonymousAccess(): OfficeAccess {
  return {
    authenticated: false,
    authorized: false,
    isSuperAdmin: false,
    isPresident: false,
    positionId: null,
    positionName: null,
    permissions: [],
    userId: null,
    email: null,
  };
}

function normalize(value: string | null | undefined) {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function isPresidentName(
  name: string | null | undefined
) {
  return normalize(name).startsWith('president');
}

type PositionRow = {
  id: string;
  name: string;
  active: boolean;
};

type MemberRow = {
  id: string;
  office_positions:
    | PositionRow
    | PositionRow[]
    | null;
};

/*
 * Calcule les droits d'un utilisateur.
 *
 * `admin` doit être un client Supabase avec la clé
 * secrète (createAdminClient).
 */
export async function resolveOfficeAccess(
  admin: SupabaseClient,
  userId: string,
  rawEmail: string | null | undefined
): Promise<OfficeAccess> {
  const email = normalize(rawEmail) || null;

  const base: OfficeAccess = {
    ...anonymousAccess(),
    authenticated: true,
    userId,
    email,
  };

  /*
   * 1. SUPER ADMIN
   */
  const { data: superAdmins, error: superAdminError } =
    await admin
      .from('office_super_admin')
      .select('user_id, email')
      .eq('active', true);

  if (superAdminError) {
    console.error(
      'Erreur vérification SUPER ADMIN:',
      superAdminError
    );
  }

  const isSuperAdmin = (superAdmins || []).some(
    (row) =>
      row.user_id === userId ||
      (email !== null &&
        normalize(row.email) === email)
  );

  if (isSuperAdmin) {
    return {
      ...base,
      authorized: true,
      isSuperAdmin: true,
      positionName: 'SUPER ADMIN',
      permissions: [...FULL_PERMISSIONS],
    };
  }

  /*
   * 2. et 3. POSTES DU BUREAU
   *
   * On cherche par identifiant ET par e-mail :
   * une personne fraîchement invitée est retrouvée
   * même si son identifiant n'est pas encore relié.
   */
  const memberSelect = `
    id,
    office_positions (
      id,
      name,
      active
    )
  `;

  const [byId, byEmail] = await Promise.all([
    admin
      .from('office_position_members')
      .select(memberSelect)
      .eq('active', true)
      .eq('user_id', userId),
    email
      ? admin
          .from('office_position_members')
          .select(memberSelect)
          .eq('active', true)
          .eq('email', email)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (byId.error || byEmail.error) {
    console.error(
      'Erreur récupération postes du bureau:',
      byId.error || byEmail.error
    );
  }

  const positions = new Map<string, PositionRow>();

  for (const member of [
    ...((byId.data || []) as MemberRow[]),
    ...((byEmail.data || []) as MemberRow[]),
  ]) {
    const position = Array.isArray(
      member.office_positions
    )
      ? member.office_positions[0]
      : member.office_positions;

    if (position && position.active) {
      positions.set(position.id, position);
    }
  }

  if (positions.size === 0) {
    return base;
  }

  const positionList = [...positions.values()];

  const president = positionList.find((p) =>
    isPresidentName(p.name)
  );

  if (president) {
    return {
      ...base,
      authorized: true,
      isPresident: true,
      positionId: president.id,
      positionName: president.name,
      permissions: [...FULL_PERMISSIONS],
    };
  }

  const { data: links, error: linksError } =
    await admin
      .from('office_position_permissions')
      .select(`
        position_id,
        office_permissions (
          code
        )
      `)
      .in(
        'position_id',
        positionList.map((p) => p.id)
      );

  if (linksError) {
    console.error(
      'Erreur récupération permissions:',
      linksError
    );
  }

  const permissions = new Set<string>();

  for (const link of (links || []) as {
    office_permissions:
      | { code: string | null }
      | { code: string | null }[]
      | null;
  }[]) {
    const permission = Array.isArray(
      link.office_permissions
    )
      ? link.office_permissions[0]
      : link.office_permissions;

    if (permission?.code) {
      permissions.add(permission.code);
    }
  }

  return {
    ...base,
    authorized: true,
    positionId: positionList[0].id,
    positionName: positionList
      .map((p) => p.name)
      .join(' / '),
    permissions: [...permissions],
  };
}

/*
 * Quelle autorisation faut-il pour ouvrir telle page ?
 * (null = aucune autorisation particulière)
 */
export function permissionForPage(
  pathname: string
): string | null {
  const rules: [string, string][] = [
    ['/configuration/membres-bureau', 'office_members'],
    ['/configuration', 'configuration'],
    ['/import-college', 'configuration'],
    ['/conseils', 'schooling'],
    ['/instances', 'schooling'],
    ['/adherents', 'members'],
    ['/tresorerie', 'treasury'],
    ['/site', 'website'],
    ['/agenda', 'agenda'],
    ['/documents', 'drive'],
  ];

  if (pathname === '/') {
    return 'dashboard';
  }

  for (const [prefix, permission] of rules) {
    if (
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`)
    ) {
      return permission;
    }
  }

  return null;
}

/*
 * Première page que la personne a le droit d'ouvrir
 * (utilisé si elle n'a pas accès au tableau de bord).
 */
export function firstAllowedPage(
  permissions: string[]
): string | null {
  const order: [string, string][] = [
    ['dashboard', '/'],
    ['schooling', '/conseils'],
    ['members', '/adherents'],
    ['treasury', '/tresorerie'],
    ['website', '/site'],
    ['agenda', '/agenda'],
    ['drive', '/documents'],
    ['configuration', '/configuration'],
    ['office_members', '/configuration/membres-bureau'],
  ];

  for (const [permission, path] of order) {
    if (permissions.includes(permission)) {
      return path;
    }
  }

  return null;
}
