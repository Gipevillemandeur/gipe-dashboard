import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();

  const { data: authData } =
    await supabase.auth.getClaims();

  const userId =
    authData?.claims?.sub;

  if (!userId) {
    return {
      error: NextResponse.json(
        {
          error: 'Non authentifié.',
        },
        {
          status: 401,
        }
      ),
    };
  }

  const admin =
    createAdminClient();

  const {
    data,
    error,
  } = await admin
    .from('gipe_admins')
    .select('user_id')
    .eq(
      'user_id',
      userId
    )
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        {
          error:
            'Impossible de vérifier les droits administrateur.',
        },
        {
          status: 500,
        }
      ),
    };
  }

  if (!data) {
    return {
      error: NextResponse.json(
        {
          error:
            'Compte non autorisé.',
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    admin,
  };
}

export async function GET() {
  const auth =
    await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } =
    auth;

  /*
   * Recherche de l'année scolaire active.
   */

  const {
    data: year,
    error: yearError,
  } = await admin
    .from('school_years')
    .select('id,label')
    .eq(
      'is_active',
      true
    )
    .maybeSingle();

  if (yearError) {
    return NextResponse.json(
      {
        error:
          yearError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (!year) {
    return NextResponse.json(
      {
        error:
          'Aucune année scolaire active.',
      },
      {
        status: 409,
      }
    );
  }

  /*
   * Récupération des adhésions de l'année active.
   *
   * Un adhérent = une adhésion pour une année.
   */

  const {
    data: memberships,
    error: membershipsError,
  } = await admin
    .from('gipe_memberships')
    .select(
      `
        id,
        gipe_membership_children (
          class_id,
          classes (
            name
          )
        )
      `
    )
    .eq(
      'school_year_id',
      year.id
    );

  if (membershipsError) {
    return NextResponse.json(
      {
        error:
          membershipsError.message,
      },
      {
        status: 500,
      }
    );
  }

  const rows =
    memberships || [];

  /*
   * Nombre total d'adhérents.
   *
   * Une adhésion ne compte qu'une fois,
   * même si elle possède plusieurs enfants.
   */

  const totalAdherents =
    rows.length;

  /*
   * Répartition par classe.
   *
   * Un adhérent compte une fois dans chaque
   * classe concernée.
   *
   * Exemple :
   *
   * Adhérent A
   * ├── enfant en 3A
   * └── enfant en 3B
   *
   * donnera :
   *
   * 3A : +1
   * 3B : +1
   *
   * Si deux enfants sont dans la même classe,
   * l'adhérent ne compte qu'une seule fois
   * dans cette classe.
   */

  const byClass =
    new Map<string, Set<string>>();

  for (
    const membership of rows
  ) {
    const children =
      Array.isArray(
        membership.gipe_membership_children
      )
        ? membership.gipe_membership_children
        : [];

    const classesForMember =
      new Set<string>();

    for (
      const child of children
    ) {
      const classData =
        Array.isArray(
          child.classes
        )
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

    for (
      const className of classesForMember
    ) {
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

  /*
   * Transformation pour le front-end.
   */

  const adherentsByClass =
    Array.from(
      byClass.entries()
    )
      .map(
        ([
          className,
          memberIds,
        ]) => ({
          className,
          count:
            memberIds.size,
        })
      )
      .sort(
        (a, b) =>
          a.className.localeCompare(
            b.className,
            'fr',
            {
              numeric: true,
            }
          )
      );

  /*
   * La trésorerie n'existe pas encore.
   *
   * On laisse donc volontairement ces valeurs
   * à null pour l'instant.
   */

  return NextResponse.json({
    schoolYear: year.label,

    totalAdherents,

    adherentsByClass,

    totalRecettes: null,

    totalDepenses: null,

    solde: null,

    canClose: true,
  });
}
