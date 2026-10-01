import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseCollegeWorkbook,
  summarizeImport,
} from '@/lib/college-import';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: authData } =
    await supabase.auth.getClaims();

  const userId =
    authData?.claims?.sub;

  if (!userId) {
    return NextResponse.json(
      {
        error: 'Non authentifié.',
      },
      {
        status: 401,
      }
    );
  }

  const admin =
    createAdminClient();

  const {
    data: adminRow,
    error: adminError,
  } = await admin
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (adminError) {
    return NextResponse.json(
      {
        error:
          'Impossible de vérifier les droits administrateur.',
      },
      {
        status: 500,
      }
    );
  }

  if (!adminRow) {
    return NextResponse.json(
      {
        error:
          "Ce compte n'est pas autorisé à importer les données du collège.",
      },
      {
        status: 403,
      }
    );
  }

  const formData =
    await request.formData();

  const file =
    formData.get('file');

  const schoolYearLabel =
    String(
      formData.get(
        'schoolYearLabel'
      ) || ''
    ).trim();

  const force =
    String(
      formData.get('force') || ''
    ) === 'true';

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error:
          'Aucun fichier reçu.',
      },
      {
        status: 400,
      }
    );
  }

  if (
    !/^\d{4}-\d{4}$/.test(
      schoolYearLabel
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Année scolaire invalide. Exemple : 2026-2027.',
      },
      {
        status: 400,
      }
    );
  }

  if (
    file.size >
    10 * 1024 * 1024
  ) {
    return NextResponse.json(
      {
        error:
          'Le fichier est trop volumineux (10 Mo maximum).',
      },
      {
        status: 413,
      }
    );
  }

  if (
    !/\.(xls|xlsx)$/i.test(
      file.name
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Format non accepté. Utilise un fichier .xls ou .xlsx.',
      },
      {
        status: 415,
      }
    );
  }

  try {
    /*
     * On conserve l'ArrayBuffer original pour
     * parseCollegeWorkbook().
     */
    const fileBuffer =
      await file.arrayBuffer();

    /*
     * Calcul de l'empreinte SHA-256 du fichier.
     *
     * Buffer.from() est utilisé uniquement ici
     * pour le calcul du hash Node.js.
     */
    const fileHash =
      createHash('sha256')
        .update(
          Buffer.from(fileBuffer)
        )
        .digest('hex');

    /*
     * Vérification de l'année scolaire.
     */

    const {
      data: schoolYear,
      error: yearError,
    } = await admin
      .from('school_years')
      .select('id,label')
      .eq(
        'label',
        schoolYearLabel
      )
      .maybeSingle();

    if (yearError) {
      return NextResponse.json(
        {
          error:
            "Impossible de vérifier l'année scolaire.",
        },
        {
          status: 500,
        }
      );
    }

    if (!schoolYear) {
      return NextResponse.json(
        {
          error:
            `L'année scolaire ${schoolYearLabel} n'existe pas.`,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Vérification d'un éventuel doublon.
     */

    const {
      data: existingImport,
      error: existingImportError,
    } = await admin
      .from('gipe_college_imports')
      .select(
        'id,file_name,imported_at,classes_count,students_count,teachers_count,direction_count'
      )
      .eq(
        'school_year_id',
        schoolYear.id
      )
      .eq(
        'file_hash',
        fileHash
      )
      .maybeSingle();

    if (existingImportError) {
      return NextResponse.json(
        {
          error:
            "Impossible de vérifier l'historique des imports.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      existingImport &&
      !force
    ) {
      return NextResponse.json(
        {
          duplicate: true,

          error:
            'Ce fichier a déjà été importé pour cette année scolaire.',

          previousImport:
            existingImport,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Lecture du fichier.
     *
     * IMPORTANT :
     * parseCollegeWorkbook() attend un ArrayBuffer.
     */

    const parsed =
      parseCollegeWorkbook(
        fileBuffer
      );

    if (
      parsed.classes.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Aucune classe réelle exploitable n'a été détectée. Rien n'a été modifié.",
        },
        {
          status: 422,
        }
      );
    }

    const summary =
      summarizeImport(
        parsed
      );

    /*
     * On conserve exactement le mécanisme
     * d'import existant.
     */

    const {
      error,
    } = await admin.rpc(
      'replace_current_school_state',
      {
        p_school_year_label:
          schoolYearLabel,

        p_classes:
          parsed.classes,

        p_direction:
          parsed.direction,
      }
    );

    if (error) {
      return NextResponse.json(
        {
          error:
            `L'import n'a pas été appliqué : ${error.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Enregistrement du fichier importé.
     */

    const importData = {
      school_year_id:
        schoolYear.id,

      file_name:
        file.name,

      file_hash:
        fileHash,

      imported_at:
        new Date().toISOString(),

      classes_count:
        summary.classes,

      students_count:
        summary.students,

      teachers_count:
        summary.teachers,

      direction_count:
        summary.direction,
    };

    let historyError;

    if (existingImport) {
      const {
        error,
      } = await admin
        .from(
          'gipe_college_imports'
        )
        .update(
          importData
        )
        .eq(
          'id',
          existingImport.id
        );

      historyError =
        error;
    } else {
      const {
        error,
      } = await admin
        .from(
          'gipe_college_imports'
        )
        .insert(
          importData
        );

      historyError =
        error;
    }

    /*
     * L'import principal est réussi même si
     * l'historique rencontre un problème.
     */

    if (historyError) {
      return NextResponse.json({
        ok: true,

        historyWarning:
          "L'import a été appliqué, mais les informations de suivi du fichier n'ont pas pu être enregistrées.",

        fileName:
          file.name,

        summary,
      });
    }

    return NextResponse.json({
      ok: true,

      fileName:
        file.name,

      summary,
    });

  } catch (error) {
    console.error(
      'Erreur import collège:',
      error
    );

    return NextResponse.json(
      {
        error:
          "Erreur pendant l'import. Aucune confirmation de mise à jour n'a été donnée.",
      },
      {
        status: 500,
      }
    );
  }
}
