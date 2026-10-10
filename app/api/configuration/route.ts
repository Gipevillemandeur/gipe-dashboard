import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOfficeAccess } from '@/lib/office-auth';
import { sortDirection } from '@/lib/direction';

async function requireConfigurationAccess() {
  /*
   * Règles d'accès communes : lib/access-core.ts
   */
  const access = await getOfficeAccess();

  if (!access.authenticated) {
    return {
      error: NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      ),
    };
  }

  if (
    !access.authorized ||
    !access.permissions.includes('configuration')
  ) {
    return {
      error: NextResponse.json(
        { error: 'Compte non autorisé.' },
        { status: 403 }
      ),
    };
  }

  return {
    admin: createAdminClient(),
    access,
  };
}

/* =========================================================
   GET
   Configuration générale
   ========================================================= */

export async function GET() {
  const auth =
    await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  /*
   * Année scolaire active
   */

  const {
    data: year,
    error: yearError,
  } = await admin
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
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
    /*
     * La direction ne dépend pas de l'année :
     * elle est renvoyée même sans année active
     * (sinon la page l'afficherait vide et un
     * enregistrement l'effacerait).
     */
    const {
      data: direction,
      error: directionError,
    } = await admin
      .from('school_management')
      .select('id,display_name,role,active')
      .eq('active', true);

    if (directionError) {
      return NextResponse.json(
        { error: directionError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      schoolYear: null,
      classes: [],
      direction: sortDirection(direction ?? []),
      lastImport: null,
    });
  }

  /*
   * Classes
   * Direction
   * Dernier import du listing collège
   */

  const [
    {
      data: classes,
      error: classesError,
    },
    {
      data: direction,
      error: directionError,
    },
    {
      data: lastImport,
      error: importError,
    },
  ] = await Promise.all([
    admin
      .from('classes')
      .select(
        'id,name,level,kind,access_code,active'
      )
      .eq(
        'school_year_id',
        year.id
      )
      .eq(
        'active',
        true
      )
      .order(
        'kind'
      )
      .order(
        'name'
      ),

    admin
      .from('school_management')
      .select(
        'id,display_name,role,active'
      )
      .eq(
        'active',
        true
      )
      .order(
        'display_name'
      ),

    admin
      .from('gipe_college_imports')
      .select(
        'file_name,imported_at,classes_count,students_count,teachers_count,direction_count'
      )
      .eq(
        'school_year_id',
        year.id
      )
      .order(
        'imported_at',
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    classesError ||
    directionError ||
    importError
  ) {
    return NextResponse.json(
      {
        error:
          classesError?.message ||
          directionError?.message ||
          importError?.message ||
          'Lecture impossible.',
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    schoolYear:
      year.label,

    classes:
      classes ?? [],

    direction:
      sortDirection(direction ?? []),

    lastImport:
      lastImport ?? null,
  });
}

/* =========================================================
   PATCH
   Modification des codes d'accès des classes
   ========================================================= */

export async function PATCH(
  request: Request
) {
  const auth =
    await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const body =
    await request
      .json()
      .catch(
        () => null
      ) as {
        classes?: Array<{
          id: string;
          accessCode:
            | string
            | null;
        }>;
      } | null;

  if (
    !body?.classes ||
    !Array.isArray(
      body.classes
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Liste de codes invalide.',
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: year,
  } = await admin
    .from('school_years')
    .select('id')
    .eq(
      'is_active',
      true
    )
    .maybeSingle();

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

  for (
    const item of body.classes
  ) {
    if (!item.id) {
      continue;
    }

    const accessCode =
      item.accessCode
        ?.trim() || null;

    const {
      error,
    } = await admin
      .from('classes')
      .update({
        access_code:
          accessCode,
      })
      .eq(
        'id',
        item.id
      )
      .eq(
        'school_year_id',
        year.id
      );

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de modifier un code : ${error.message}`,
        },
        {
          status: 500,
        }
      );
    }
  }

  return NextResponse.json({
    ok: true,
  });
}

/* =========================================================
   PUT
   Gestion de la direction
   ========================================================= */

export async function PUT(
  request: Request
) {
  const auth =
    await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const body =
    await request
      .json()
      .catch(
        () => null
      ) as {
        members?: Array<{
          id?: string;
          displayName: string;
          role?: string;
          active?: boolean;
        }>;
      } | null;

  if (
    !body?.members ||
    !Array.isArray(
      body.members
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Liste de direction invalide.',
      },
      {
        status: 400,
      }
    );
  }

  const clean =
    body.members
      .map(
        (
          member
        ) => ({
          id:
            member.id,

          display_name:
            String(
              member.displayName ||
                ''
            ).trim(),

          role:
            String(
              member.role ||
                ''
            ).trim() ||
            null,

          active:
            member.active !==
            false,
        })
      )
      .filter(
        (
          member
        ) =>
          member.display_name
      );

  if (clean.some((member) => member.display_name.length > 120)) {
    return NextResponse.json(
      { error: 'Un nom est trop long (120 caractères maximum).' },
      { status: 400 }
    );
  }

  /*
   * Enregistrement « en douceur » : on ne touche qu'à ce qui
   * a changé. Ajouts et modifications d'abord, suppressions
   * en dernier : si quelque chose échoue en route, la
   * direction n'est jamais effacée.
   */
  const {
    data: existingRows,
    error: readError,
  } = await admin
    .from('school_management')
    .select('id')
    .eq('active', true);

  if (readError) {
    return NextResponse.json(
      { error: readError.message },
      { status: 500 }
    );
  }

  const existingIds = new Set(
    (existingRows ?? []).map((row) => row.id as string)
  );

  const keptIds = new Set<string>();

  for (const member of clean) {
    if (member.id && existingIds.has(member.id)) {
      keptIds.add(member.id);

      const { error } = await admin
        .from('school_management')
        .update({
          display_name: member.display_name,
          role: member.role,
        })
        .eq('id', member.id);

      if (error) {
        return NextResponse.json(
          { error: `Modification impossible : ${error.message}` },
          { status: 500 }
        );
      }
    }
  }

  const toInsert = clean
    .filter((member) => !(member.id && existingIds.has(member.id)))
    .map(({ display_name, role }) => ({
      display_name,
      role,
      active: true,
    }));

  if (toInsert.length > 0) {
    const { error } = await admin
      .from('school_management')
      .insert(toInsert);

    if (error) {
      return NextResponse.json(
        { error: `Ajout impossible : ${error.message}` },
        { status: 500 }
      );
    }
  }

  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await admin
      .from('school_management')
      .delete()
      .in('id', toDelete);

    if (error) {
      return NextResponse.json(
        { error: `Suppression impossible : ${error.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
  });
}
