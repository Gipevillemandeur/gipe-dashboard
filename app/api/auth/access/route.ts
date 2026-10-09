import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/office-auth';

/*
 * Renvoie le rôle et les autorisations de la personne
 * connectée (utilisé par le menu de gauche).
 * Les règles sont dans lib/access-core.ts.
 */
export async function GET() {
  try {
    const access = await getOfficeAccess();

    if (!access.authenticated) {
      return NextResponse.json(
        {
          authorized: false,
          role: null,
          permissions: [],
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authorized: access.authorized,
      role: access.positionName,
      isSuperAdmin: access.isSuperAdmin,
      isPresident: access.isPresident,
      permissions: access.permissions,
    });
  } catch (error) {
    console.error(
      'Erreur récupération accès utilisateur:',
      error
    );

    return NextResponse.json(
      {
        authorized: false,
        role: null,
        permissions: [],
      },
      { status: 500 }
    );
  }
}
