import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/*
 * PROTECTION DES CODES
 * - 3 mauvais codes depuis un même appareil → bloqué pour la classe ;
 * - 30 mauvais codes au total sur la classe → classe bloquée ;
 * - tout est levé dès que le code de la classe change ;
 * - la classe TEST (démonstration) n'est jamais bloquée.
 */
const MAX_DEVICE_FAILURES = 3;
const MAX_CLASS_FAILURES = 30;

const BLOCKED_MESSAGE =
  'Trop de codes erronés pour cette classe. Demande un nouveau code au GIPE.';

/* Empreinte brouillée (non réversible) : rien n'est stocké en clair. */
function fingerprint(value: string, length: number) {
  const salt = process.env.SUPABASE_SECRET_KEY || 'gipe';

  return createHash('sha256')
    .update(`${salt}|${value}`)
    .digest('hex')
    .slice(0, length);
}

function deviceOf(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'inconnu';

  return fingerprint(`ip:${ip}`, 32);
}

function cors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

export async function OPTIONS() {
  return cors(
    new NextResponse(null, {
      status: 204,
    })
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const classe =
      (searchParams.get('classe') || '').trim();

    const code =
      (searchParams.get('code') || '').trim();

    const admin = createAdminClient();

    // ==========================================================
    // ANNÉE SCOLAIRE ACTIVE
    // ==========================================================

    const {
      data: year,
      error: yearError,
    } = await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle();

    if (yearError) {
      return cors(
        NextResponse.json(
          {
            error: 'Lecture année scolaire impossible.',
          },
          {
            status: 500,
          }
        )
      );
    }

    if (!year) {
      return cors(
        NextResponse.json({
          schoolYear: null,
          classes: [],
          direction: [],
        })
      );
    }

    // ==========================================================
    // LISTE DES CLASSES
    // ==========================================================

    if (!classe) {
      const {
        data: classes,
        error: classesError,
      } = await admin
        .from('classes')
        .select(
          'name,level,kind,active,access_code'
        )
        .eq('school_year_id', year.id)
        .eq('active', true)
        .order('kind')
        .order('name');

      if (classesError) {
        return cors(
          NextResponse.json(
            {
              error:
                'Lecture des classes impossible.',
            },
            {
              status: 500,
            }
          )
        );
      }

      const {
        data: direction,
        error: directionError,
      } = await admin
        .from('school_management')
        .select('display_name,role')
        .eq('active', true)
        .order('display_name');

      if (directionError) {
        return cors(
          NextResponse.json(
            {
              error:
                'Lecture de la direction impossible.',
            },
            {
              status: 500,
            }
          )
        );
      }

      // Toutes les classes nécessitent désormais
      // un code d'accès.
      const safeClasses =
        (classes ?? []).map((row) => ({
          name: row.name,
          level: row.level,
          kind: row.kind,
          active: row.active,
          requiresCode: true,
        }));

      return cors(
        NextResponse.json({
          schoolYear: year.label,
          classes: safeClasses,
          direction: direction ?? [],
        })
      );
    }

    // ==========================================================
    // CLASSE DEMANDÉE
    // ==========================================================

    const {
      data: classRow,
      error: classError,
    } = await admin
      .from('classes')
      .select(
        'id,name,level,kind,access_code,active'
      )
      .eq('school_year_id', year.id)
      .eq('name', classe)
      .eq('active', true)
      .maybeSingle();

    if (classError) {
      return cors(
        NextResponse.json(
          {
            error:
              'Lecture de la classe impossible.',
          },
          {
            status: 500,
          }
        )
      );
    }

    if (!classRow) {
      return cors(
        NextResponse.json(
          {
            error: 'Classe inconnue.',
          },
          {
            status: 404,
          }
        )
      );
    }

    // ==========================================================
    // CONTRÔLE DU CODE
    // ==========================================================

    const expected =
      String(classRow.access_code ?? '').trim();

    // Une classe sans code configuré
    // est inaccessible.
    if (!expected) {
      return cors(
        NextResponse.json(
          {
            error:
              'Aucun code d’accès n’est configuré pour cette classe.',
            requiresCode: true,
          },
          {
            status: 403,
          }
        )
      );
    }

    const isDemo =
      classRow.kind === 'demo' ||
      String(classRow.name).trim().toUpperCase() === 'TEST';

    const codeFingerprint = fingerprint(`code:${expected}`, 32);
    const device = deviceOf(request);

    if (!isDemo) {
      const { data: attempts, error: attemptsError } = await admin
        .from('gipe_code_attempts')
        .select('device,failures')
        .eq('class_id', classRow.id)
        .eq('code_fingerprint', codeFingerprint);

      if (attemptsError) {
        console.error('Erreur lecture essais de code :', attemptsError);

        return cors(
          NextResponse.json(
            { error: 'Vérification du code momentanément impossible.' },
            { status: 503 }
          )
        );
      }

      const deviceFailures =
        attempts?.find((row) => row.device === device)?.failures || 0;

      const classFailures = (attempts || []).reduce(
        (sum, row) => sum + (row.failures || 0),
        0
      );

      if (
        deviceFailures >= MAX_DEVICE_FAILURES ||
        classFailures >= MAX_CLASS_FAILURES
      ) {
        return cors(
          NextResponse.json(
            { error: BLOCKED_MESSAGE, requiresCode: true, blocked: true },
            { status: 429 }
          )
        );
      }
    }

    // Le code est obligatoire.
    if (expected !== code) {
      // Un code vide (première ouverture) ne compte pas comme un essai.
      if (!isDemo && code) {
        const { data: counts } = await admin.rpc(
          'gipe_register_code_failure',
          {
            p_class_id: classRow.id,
            p_device: device,
            p_code_fingerprint: codeFingerprint,
          }
        );

        const deviceFailures = Number(
          (counts as any)?.deviceFailures || 0
        );

        if (deviceFailures >= MAX_DEVICE_FAILURES) {
          return cors(
            NextResponse.json(
              { error: BLOCKED_MESSAGE, requiresCode: true, blocked: true },
              { status: 429 }
            )
          );
        }

        const remaining = MAX_DEVICE_FAILURES - deviceFailures;

        return cors(
          NextResponse.json(
            {
              error: `Code incorrect. Il reste ${remaining} essai${remaining > 1 ? 's' : ''}.`,
              requiresCode: true,
            },
            { status: 403 }
          )
        );
      }

      return cors(
        NextResponse.json(
          {
            error: 'Code incorrect.',
            requiresCode: true,
          },
          {
            status: 403,
          }
        )
      );
    }

    // ==========================================================
    // DONNÉES DU CONSEIL
    // ==========================================================

    const [
      {
        data: students,
        error: studentsError,
      },
      {
        data: teacherRows,
        error: teacherError,
      },
      {
        data: direction,
        error: directionError,
      },
    ] = await Promise.all([
      admin
        .from('students')
        .select('last_name,first_name')
        .eq('class_id', classRow.id)
        .eq('active', true)
        .order('last_name')
        .order('first_name'),

      admin
        .from('class_teachers')
        .select(
          'subject,is_pp,teachers(display_name)'
        )
        .eq('class_id', classRow.id),

      admin
        .from('school_management')
        .select('display_name,role')
        .eq('active', true)
        .order('display_name'),
    ]);

    if (
      studentsError ||
      teacherError ||
      directionError
    ) {
      return cors(
        NextResponse.json(
          {
            error:
              'Lecture des données du conseil impossible.',
          },
          {
            status: 500,
          }
        )
      );
    }

    // ==========================================================
    // ÉQUIPE PÉDAGOGIQUE
    // ==========================================================

    const teachers =
      (teacherRows ?? [])
        .map((row: any) => ({
          subject: row.subject ?? '',
          prof:
            row.teachers?.display_name ?? '',
          isPP: Boolean(row.is_pp),
        }))
        .filter(
          (row) => row.prof || row.subject
        );

    // ==========================================================
    // RÉPONSE
    // ==========================================================

    return cors(
      NextResponse.json({
        schoolYear: year.label,

        class: {
          name: classRow.name,
          level: classRow.level,
          kind: classRow.kind,
        },

        students: students ?? [],

        teachers,

        direction: direction ?? [],
      })
    );
  } catch (error) {
    console.error(
      'Conseils public API:',
      error
    );

    return cors(
      NextResponse.json(
        {
          error: 'Erreur serveur.',
        },
        {
          status: 500,
        }
      )
    );
  }
}
