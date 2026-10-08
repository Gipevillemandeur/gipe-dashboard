import { NextResponse } from 'next/server';
import { requireOfficePermission } from '@/lib/office-auth';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireConfigurationAccess() {
  try {
    await requireOfficePermission('configuration');

    return {
      admin: createAdminClient(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'AUTHENTICATION_REQUIRED'
      ) {
        return {
          error: NextResponse.json(
            { error: 'Non authentifié.' },
            { status: 401 }
          ),
        };
      }

      if (
        error.message === 'OFFICE_ACCESS_DENIED' ||
        error.message === 'OFFICE_PERMISSION_DENIED'
      ) {
        return {
          error: NextResponse.json(
            { error: 'Compte non autorisé.' },
            { status: 403 }
          ),
        };
      }
    }

    console.error(
      'Erreur contrôle accès configuration :',
      error
    );

    return {
      error: NextResponse.json(
        {
          error:
            'Erreur de contrôle des accès.',
        },
        { status: 500 }
      ),
    };
  }
}

export async function GET() {
  const auth =
    await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const { data: year, error: yearError } =
    await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle();

  if (yearError) {
    return NextResponse.json(
      { error: yearError.message },
      { status: 500 }
    );
  }

  if (!year) {
    return NextResponse.json(
      {
        error:
          'Aucune année scolaire active.',
      },
      { status: 409 }
    );
  }

  const {
    data: memberships,
    error: membershipsError,
  } = await admin
    .from('gipe_memberships')
    .select(`
      id,
      gipe_membership_children (
        class_id,
        classes (
          name
        )
      )
    `)
    .eq('school_year_id', year.id);

  if (membershipsError) {
    return NextResponse.json(
      {
        error:
          membershipsError.message,
      },
      { status: 500 }
    );
  }

  const rows = memberships || [];

  /*
   * TOTAL :
   * un adhérent = une personne.
   * Même s'il a plusieurs enfants, il ne compte qu'une fois.
   */
  const totalAdherents = rows.length;

  /*
   * RÉPARTITION PAR CLASSE :
   *
   * Un adhérent est compté dans chaque classe
   * où il possède au moins un enfant.
   *
   * Deux enfants dans la même classe :
   * → une seule fois dans cette classe.
   *
   * Deux enfants dans deux classes différentes :
   * → présent dans les deux classes.
   */
  const byClass =
    new Map<string, Set<string>>();

  for (const membership of rows) {
    const children = Array.isArray(
      membership.gipe_membership_children
    )
      ? membership.gipe_membership_children
      : [];

    const classesForMember =
      new Set<string>();

    for (const child of children) {
      const classData =
        Array.isArray(child.classes)
          ? child.classes[0]
          : child.classes;

      const className =
        classData?.name;

      if (className) {
        classesForMember.add(
          className
        );
      }
    }

    for (const className of classesForMember) {
      if (!byClass.has(className)) {
        byClass.set(
          className,
          new Set<string>()
        );
      }

      byClass
        .get(className)!
        .add(membership.id);
    }
  }

  const adherentsByClass =
    Array.from(byClass.entries())
      .map(
        ([className, memberIds]) => ({
          className,
          count: memberIds.size,
        })
      )
      .sort((a, b) =>
        a.className.localeCompare(
          b.className,
          'fr',
          { numeric: true }
        )
      );

  return NextResponse.json({
    schoolYear: year.label,
    totalAdherents,
    adherentsByClass,

    // La trésorerie sera raccordée plus tard.
    totalRecettes: null,
    totalDepenses: null,
    solde: null,

    canClose: true,
  });
}
