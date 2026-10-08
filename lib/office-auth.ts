import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type OfficeAccess = {
  authenticated: boolean
  authorized: boolean
  isSuperAdmin: boolean
  isPresident: boolean
  isLegacyAdmin: boolean
  positionId: string | null
  positionName: string | null
  permissions: string[]
  userId: string | null
  email: string | null
}

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
]

export async function getOfficeAccess(): Promise<OfficeAccess> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      authenticated: false,
      authorized: false,
      isSuperAdmin: false,
      isPresident: false,
      isLegacyAdmin: false,
      positionId: null,
      positionName: null,
      permissions: [],
      userId: null,
      email: null,
    }
  }

  const email =
    user.email?.trim().toLowerCase() || null

  const adminClient = createAdminClient()

  /*
   * ---------------------------------------------------------
   * 1. ANCIEN COMPTE ADMINISTRATEUR
   * ---------------------------------------------------------
   *
   * Les comptes historiques présents dans gipe_admins
   * conservent tous leurs droits.
   */

  const {
    data: legacyAdmin,
    error: legacyAdminError,
  } = await adminClient
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (legacyAdminError) {
    console.error(
      'Erreur vérification gipe_admins:',
      legacyAdminError
    )
  }

  if (legacyAdmin) {
    return {
      authenticated: true,
      authorized: true,
      isSuperAdmin: false,
      isPresident: false,
      isLegacyAdmin: true,
      positionId: null,
      positionName: 'Administrateur',
      permissions: FULL_PERMISSIONS,
      userId: user.id,
      email,
    }
  }

  /*
   * ---------------------------------------------------------
   * 2. SUPER ADMIN
   * ---------------------------------------------------------
   */

  const {
    data: superAdmins,
    error: superAdminError,
  } = await adminClient
    .from('office_super_admin')
    .select('user_id, email, active')
    .eq('active', true)

  if (superAdminError) {
    console.error(
      'Erreur vérification SUPER ADMIN:',
      superAdminError
    )
  }

  const superAdmin =
    superAdmins?.find(
      (item) =>
        item.user_id === user.id ||
        (
          email &&
          item.email?.trim().toLowerCase() === email
        )
    )

  if (superAdmin) {
    return {
      authenticated: true,
      authorized: true,
      isSuperAdmin: true,
      isPresident: false,
      isLegacyAdmin: false,
      positionId: null,
      positionName: 'SUPER ADMIN',
      permissions: FULL_PERMISSIONS,
      userId: user.id,
      email,
    }
  }

  /*
   * ---------------------------------------------------------
   * 3. POSTE DU BUREAU
   * ---------------------------------------------------------
   */

  const {
    data: member,
    error: memberError,
  } = await adminClient
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
    .maybeSingle()

  if (memberError) {
    console.error(
      'Erreur récupération membre du bureau:',
      memberError
    )
  }

  if (!member) {
    return {
      authenticated: true,
      authorized: false,
      isSuperAdmin: false,
      isPresident: false,
      isLegacyAdmin: false,
      positionId: null,
      positionName: null,
      permissions: [],
      userId: user.id,
      email,
    }
  }

  const position =
    Array.isArray(member.office_positions)
      ? member.office_positions[0]
      : member.office_positions

  if (
    !position ||
    !position.active
  ) {
    return {
      authenticated: true,
      authorized: false,
      isSuperAdmin: false,
      isPresident: false,
      isLegacyAdmin: false,
      positionId: null,
      positionName: null,
      permissions: [],
      userId: user.id,
      email,
    }
  }

  /*
   * ---------------------------------------------------------
   * 4. PRÉSIDENT
   * ---------------------------------------------------------
   *
   * Le Président possède tous les droits.
   */

  if (
    position.name === 'Président'
  ) {
    return {
      authenticated: true,
      authorized: true,
      isSuperAdmin: false,
      isPresident: true,
      isLegacyAdmin: false,
      positionId: position.id,
      positionName: position.name,
      permissions: FULL_PERMISSIONS,
      userId: user.id,
      email,
    }
  }

  /*
   * ---------------------------------------------------------
   * 5. PERMISSIONS DU POSTE
   * ---------------------------------------------------------
   */

  const {
    data: permissionLinks,
    error: permissionError,
  } = await adminClient
    .from('office_position_permissions')
    .select(`
      permission_id,
      office_permissions (
        code
      )
    `)
    .eq(
      'position_id',
      position.id
    )

  if (permissionError) {
    console.error(
      'Erreur récupération permissions:',
      permissionError
    )
  }

  const permissions =
    (permissionLinks || [])
      .map((link) => {
        const permission =
          Array.isArray(
            link.office_permissions
          )
            ? link.office_permissions[0]
            : link.office_permissions

        return permission?.code || null
      })
      .filter(
        (code): code is string =>
          Boolean(code)
      )

  return {
    authenticated: true,
    authorized: true,
    isSuperAdmin: false,
    isPresident: false,
    isLegacyAdmin: false,
    positionId: position.id,
    positionName: position.name,
    permissions,
    userId: user.id,
    email,
  }
}

export async function hasOfficePermission(
  permission: string
): Promise<boolean> {
  const access =
    await getOfficeAccess()

  if (!access.authorized) {
    return false
  }

  return access.permissions.includes(
    permission
  )
}

export async function requireOfficeAccess(): Promise<OfficeAccess> {
  const access =
    await getOfficeAccess()

  if (!access.authenticated) {
    throw new Error(
      'AUTHENTICATION_REQUIRED'
    )
  }

  if (!access.authorized) {
    throw new Error(
      'OFFICE_ACCESS_DENIED'
    )
  }

  return access
}

export async function requireOfficePermission(
  permission: string
): Promise<OfficeAccess> {
  const access =
    await requireOfficeAccess()

  if (
    !access.permissions.includes(
      permission
    )
  ) {
    throw new Error(
      'OFFICE_PERMISSION_DENIED'
    )
  }

  return access
}
