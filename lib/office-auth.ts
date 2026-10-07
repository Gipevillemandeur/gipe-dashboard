import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

const FULL_PERMISSIONS = [
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

export async function getOfficeAccess(): Promise<OfficeAccess> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

  const email =
    user.email?.trim().toLowerCase() || null;

  /*
   * On utilise le client administrateur uniquement pour
   * déterminer le rôle du compte connecté.
   */
  const adminClient = createAdminClient();

  /*
   * 1. Vérification SUPER ADMIN
   *
   * Le SUPER ADMIN est identifié par son user_id lorsque
   * celui-ci est renseigné.
   *
   * Pour les comptes déjà configurés avec seulement
   * l'adresse e-mail, on accepte également la correspondance
   * sur l'adresse.
   */
  const { data: superAdmins } =
    await adminClient
      .from('office_super_admin')
      .select('user_id, email, active')
      .eq('active', true);

  const superAdmin =
    superAdmins?.find(
      (item) =>
        item.user_id === user.id ||
        (
          email &&
          item.email?.trim().toLowerCase() === email
        )
    );

  if (superAdmin) {
    return {
      authenticated: true,
      authorized: true,
      isSuperAdmin: true,
      isPresident: false,
      positionId: null,
      positionName: 'SUPER ADMIN',
      permissions: FULL_PERMISSIONS,
      userId: user.id,
      email,
    };
  }

  /*
   * 2. Vérification du poste occupé
   */
  const { data: member } =
    await adminClient
      .from('office_position_members')
      .select(`
        user_id,
        email,
        position_id,
        active,
        office_positions (
          id,
          name,
          active
        )
      `)
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle();

  if (!member) {
    return {
      authenticated: true,
      authorized: false,
      isSuperAdmin: false,
      isPresident: false,
      positionId: null,
      positionName: null,
      permissions: [],
      userId: user.id,
      email,
    };
  }

  const position = Array.isArray(member.office_positions)
    ? member.office_positions[0]
    : member.office_positions;

  if (!position || !position.active) {
    return {
      authenticated: true,
      authorized: false,
      isSuperAdmin: false,
      isPresident: false,
      positionId: null,
      positionName: null,
      permissions: [],
      userId: user.id,
      email,
    };
  }

  /*
   * 3. Président
   *
   * Le Président possède exactement les mêmes droits
   * que le SUPER ADMIN, mais n'est pas le SUPER ADMIN.
   */
  if (position.name === 'Président') {
    return {
      authenticated: true,
      authorized: true,
      isSuperAdmin: false,
      isPresident: true,
      positionId: position.id,
      positionName: position.name,
      permissions: FULL_PERMISSIONS,
      userId: user.id,
      email,
    };
  }

  /*
   * 4. Permissions du poste
   */
  const { data: permissionLinks } =
    await adminClient
      .from('office_position_permissions')
      .select(`
        permission_id,
        office_permissions (
          code
        )
      `)
      .eq('position_id', position.id);

  const permissions =
    (permissionLinks || [])
      .map((link) => {
        const permission =
          Array.isArray(link.office_permissions)
            ? link.office_permissions[0]
            : link.office_permissions;

        return permission?.code || null;
      })
      .filter(
        (code): code is string =>
          Boolean(code)
      );

  return {
    authenticated: true,
    authorized: true,
    isSuperAdmin: false,
    isPresident: false,
    positionId: position.id,
    positionName: position.name,
    permissions,
    userId: user.id,
    email,
  };
}

export async function hasOfficePermission(
  permission: string
): Promise<boolean> {
  const access = await getOfficeAccess();

  if (!access.authorized) {
    return false;
  }

  return access.permissions.includes(permission);
}

export async function requireOfficeAccess(): Promise<OfficeAccess> {
  const access = await getOfficeAccess();

  if (!access.authenticated) {
    throw new Error('AUTHENTICATION_REQUIRED');
  }

  if (!access.authorized) {
    throw new Error('OFFICE_ACCESS_DENIED');
  }

  return access;
}

export async function requireOfficePermission(
  permission: string
): Promise<OfficeAccess> {
  const access = await requireOfficeAccess();

  if (!access.permissions.includes(permission)) {
    throw new Error('OFFICE_PERMISSION_DENIED');
  }

  return access;
}
