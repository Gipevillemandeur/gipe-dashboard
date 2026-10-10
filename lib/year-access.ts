import { NextResponse } from 'next/server';
import { getOfficeAccess, type OfficeAccess } from '@/lib/office-auth';

/*
 * Contrôle d'accès des routes de fin d'année.
 *
 * - 'president' : Président ou SUPER ADMIN (clôture, archivage)
 * - une autorisation (ex. 'configuration') : consultation
 */
export async function checkYearAccess(
  level: 'president' | string
): Promise<{ access: OfficeAccess } | { error: NextResponse }> {
  try {
    const access = await getOfficeAccess();

    if (!access.authenticated) {
      return {
        error: NextResponse.json(
          { error: 'Non authentifié.' },
          { status: 401 }
        ),
      };
    }

    const allowed =
      access.authorized &&
      (level === 'president'
        ? access.isPresident || access.isSuperAdmin
        : access.permissions.includes(level));

    if (!allowed) {
      return {
        error: NextResponse.json(
          {
            error:
              level === 'president'
                ? 'Seul le Président peut effectuer cette action.'
                : 'Compte non autorisé.',
          },
          { status: 403 }
        ),
      };
    }

    return { access };
  } catch (error) {
    console.error('Erreur contrôle accès fin d’année :', error);

    return {
      error: NextResponse.json(
        { error: 'Erreur de contrôle des accès.' },
        { status: 500 }
      ),
    };
  }
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
