import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  anonymousAccess,
  resolveOfficeAccess,
  type OfficeAccess,
} from '@/lib/access-core';

/*
 * Les règles d'accès sont dans lib/access-core.ts.
 * Ce fichier ne fait que récupérer l'utilisateur
 * connecté et appliquer ces règles.
 */

export type { OfficeAccess };

export async function getOfficeAccess(): Promise<OfficeAccess> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return anonymousAccess();
  }

  return resolveOfficeAccess(
    createAdminClient(),
    user.id,
    user.email
  );
}

export async function hasOfficePermission(
  permission: string
): Promise<boolean> {
  const access = await getOfficeAccess();

  return (
    access.authorized &&
    access.permissions.includes(permission)
  );
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
