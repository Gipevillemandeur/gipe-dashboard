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
    .eq('user_id', userId)
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

/* =========================================================
   GET
   Configuration générale
   ========================================================= */

export async function GET() {
  const auth =
    await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } =
    auth;

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
    return NextResponse.json({
      schoolYear: null,
      classes: [],
      direction: [],
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
      direction ?? [],

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
    await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } =
    auth;

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
    await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } =
    auth;

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

  /*
   * On conserve le fonctionnement
   * existant de la gestion de direction.
   */

  const {
    error: deleteError,
  } = await admin
    .from(
      'school_management'
    )
    .delete()
    .eq(
      'active',
      true
    );

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          deleteError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (
    clean.length > 0
  ) {
    const {
      error: insertError,
    } = await admin
      .from(
        'school_management'
      )
      .insert(
        clean.map(
          ({
            display_name,
            role,
            active,
          }) => ({
            display_name,
            role,
            active,
          })
        )
      );

    if (insertError) {
      return NextResponse.json(
        {
          error:
            insertError.message,
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
