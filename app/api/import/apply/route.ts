import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  requireOfficePermission,
} from '@/lib/office-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseCollegeWorkbook,
  summarizeImport,
} from '@/lib/college-import';

export const runtime = 'nodejs';

export async function POST(
  request: Request
) {
  try {
    await requireOfficePermission(
      'configuration'
    );
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        'AUTHENTICATION_REQUIRED'
      ) {
        return NextResponse.json(
          {
            error:
              'Non authentifié.',
          },
          {
            status: 401,
          }
        );
      }

      if (
        error.message ===
          'OFFICE_ACCESS_DENIED' ||
        error.message ===
          'OFFICE_PERMISSION_DENIED'
      ) {
        return NextResponse.json(
          {
            error:
              'Compte non autorisé.',
          },
          {
            status: 403,
          }
        );
      }
    }

    console.error(
      'Erreur contrôle accès import apply:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Erreur de contrôle des accès.',
      },
      {
        status: 500,
      }
    );
  }

  const admin =
    createAdminClient();

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
     */
    const fileHash =
      createHash('sha256')
        .update(
          Buffer.from(
            fileBuffer
          )
        )
        .digest('hex');

    /*
     * L'import se fait TOUJOURS dans l'année en cours.
     *
     * (Importer dans une autre année réactiverait cette
     * année-là — par exemple une année déjà clôturée.)
     */
    const {
      data: schoolYear,
      error: yearError,
    } = await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle();

    if (yearError) {
      return NextResponse.json(
        { error: "Impossible de vérifier l'année scolaire." },
        { status: 500 }
      );
    }

    if (!schoolYear) {
      return NextResponse.json(
        { error: "Aucune année scolaire active n'est définie." },
        { status: 409 }
      );
    }

    if (schoolYear.label !== schoolYearLabel) {
      return NextResponse.json(
        {
          error: `L'import se fait dans l'année en cours (${schoolYear.label}), pas dans ${schoolYearLabel}. Recharge la page.`,
        },
        { status: 409 }
      );
    }

    /*
     * Vérification d'un éventuel doublon.
     */
    const {
      data: existingImport,
      error:
        existingImportError,
    } = await admin
      .from(
        'gipe_college_imports'
      )
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
     * Import principal.
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
