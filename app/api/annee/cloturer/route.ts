import { NextResponse } from 'next/server';
import { requireOfficePermission } from '@/lib/office-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAnnualReportPdf,
  type AnnualReportData,
} from '@/lib/annual-report-pdf';
import { archiveInstanceMeeting } from '@/lib/instance-meeting-drive';

async function requireConfigurationAccess() {
  try {
    await requireOfficePermission('configuration');

    return {
      admin: createAdminClient(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'AUTHENTICATION_REQUIRED') {
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

function sanitizeFileNamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();
}

async function buildCurrentAnnualReport(
  admin: ReturnType<typeof createAdminClient>
) {
  const {
    data: year,
    error: yearError,
  } = await admin
    .from('school_years')
    .select('id,label,initial_balance')
    .eq('is_active', true)
    .maybeSingle();

  if (yearError) {
    throw new Error(yearError.message);
  }

  if (!year) {
    throw new Error(
      'Aucune année scolaire active.'
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
    .eq(
      'school_year_id',
      year.id
    );

  if (membershipsError) {
    throw new Error(
      membershipsError.message
    );
  }

  const rows = memberships || [];

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
          {
            numeric: true,
          }
        )
      );

  /*
   * Bilan financier
   *
   * Toutes les opérations de l'année active
   * sont regroupées par catégorie.
   */
  const {
    data: transactions,
    error: transactionsError,
  } = await admin
    .from('gipe_transactions')
    .select(
      'transaction_type, category, amount'
    )
    .eq(
      'school_year_id',
      year.id
    );

  if (transactionsError) {
    throw new Error(
      transactionsError.message
    );
  }

  const financialByCategory =
    new Map<
      string,
      {
        recettes: number;
        depenses: number;
      }
    >();

  let totalRecettes = 0;
  let totalDepenses = 0;

  for (const transaction of transactions || []) {
    const amount =
      Number(transaction.amount || 0);

    const category =
      String(
        transaction.category || 'Autre'
      ).trim() || 'Autre';

    if (
      !financialByCategory.has(category)
    ) {
      financialByCategory.set(
        category,
        {
          recettes: 0,
          depenses: 0,
        }
      );
    }

    const entry =
      financialByCategory.get(
        category
      )!;

    if (
      transaction.transaction_type ===
      'income'
    ) {
      entry.recettes += amount;
      totalRecettes += amount;
    }

    if (
      transaction.transaction_type ===
      'expense'
    ) {
      entry.depenses += amount;
      totalDepenses += amount;
    }
  }

  const financialByCategoryList =
    Array.from(
      financialByCategory.entries()
    )
      .map(
        ([category, values]) => ({
          category,
          recettes:
            Math.round(
              values.recettes * 100
            ) / 100,
          depenses:
            Math.round(
              values.depenses * 100
            ) / 100,
        })
      )
      .sort((a, b) =>
        a.category.localeCompare(
          b.category,
          'fr',
          {
            numeric: true,
          }
        )
      );

  const initialBalance =
    Number(
      year.initial_balance || 0
    );

  const roundedRecettes =
    Math.round(
      totalRecettes * 100
    ) / 100;

  const roundedDepenses =
    Math.round(
      totalDepenses * 100
    ) / 100;

  const solde =
    Math.round(
      (
        initialBalance +
        roundedRecettes -
        roundedDepenses
      ) * 100
    ) / 100;

  const report: AnnualReportData = {
    schoolYear:
      year.label,

    totalAdherents:
      rows.length,

    adherentsByClass,

    initialBalance:
      Math.round(
        initialBalance * 100
      ) / 100,

    totalRecettes:
      roundedRecettes,

    totalDepenses:
      roundedDepenses,

    solde,

    financialByCategory:
      financialByCategoryList,

    closedAt:
      new Date().toISOString(),
  };

  return {
    year,
    report,
  };
}

async function archivePdfInDrive(
  schoolYear: string,
  pdf: Uint8Array
) {
  const scriptUrl =
    process.env.GOOGLE_DRIVE_APPS_SCRIPT_URL?.trim();

  const token =
    process.env.GOOGLE_DRIVE_APPS_SCRIPT_TOKEN?.trim();

  if (!scriptUrl || !token) {
    throw new Error(
      'La connexion Google Drive n’est pas configurée dans Vercel.'
    );
  }

  const safeYear =
    sanitizeFileNamePart(
      schoolYear
    );

  const fileName =
    `Bilan-annuel-GIPE-${safeYear}.pdf`;

  const pdfBase64 =
    Buffer.from(pdf).toString(
      'base64'
    );

  const response =
    await fetch(
      scriptUrl,
      {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          action:
            'upload_annual_report',
          token,
          schoolYear,
          fileName,
          pdfBase64,
        }),
        cache: 'no-store',
      }
    );

  const responseText =
    await response.text();

  let result: any;

  try {
    result =
      JSON.parse(
        responseText
      );
  } catch {
    throw new Error(
      `Réponse Apps Script inattendue (HTTP ${response.status}).`
    );
  }

  if (
    !response.ok ||
    !result?.ok
  ) {
    throw new Error(
      result?.error ||
        `Archivage Drive impossible (HTTP ${response.status}).`
    );
  }

  return result;
}

async function archiveCurrentYearInstances(
  admin: ReturnType<
    typeof createAdminClient
  >,
  schoolYearId: string
) {
  const {
    data: meetings,
    error,
  } = await admin
    .from('instance_meetings')
    .select(
      'id, meeting_date, meeting_time, type, subject'
    )
    .eq(
      'school_year_id',
      schoolYearId
    )
    .order(
      'meeting_date',
      {
        ascending: true,
      }
    )
    .order(
      'meeting_time',
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      `Impossible de récupérer les réunions à archiver : ${error.message}`
    );
  }

  const rows =
    meetings || [];

  const archived = [];

  for (const meeting of rows) {
    try {
      const result =
        await archiveInstanceMeeting(
          admin,
          meeting.id
        );

      archived.push(
        result
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erreur inconnue lors de l’archivage.';

      throw new Error(
        `Échec de l’archivage de la réunion "${meeting.type} - ${meeting.subject}" : ${message}`
      );
    }
  }

  return archived;
}

export async function POST(
  request: Request
) {
  const auth =
    await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } =
    auth;

  const body =
    (await request
      .json()
      .catch(
        () => null
      )) as {
        newYearLabel?: string;
      } | null;

  const newYearLabel =
    String(
      body?.newYearLabel ||
        ''
    ).trim();

  if (!newYearLabel) {
    return NextResponse.json(
      {
        error:
          'Le libellé de la nouvelle année scolaire est obligatoire.',
      },
      { status: 400 }
    );
  }

  if (
    newYearLabel.length >
    30
  ) {
    return NextResponse.json(
      {
        error:
          'Le libellé de l’année scolaire est trop long.',
      },
      { status: 400 }
    );
  }

  if (
    !/^\d{4}-\d{4}$/.test(
      newYearLabel
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Format invalide. Exemple : 2027-2028.',
      },
      { status: 400 }
    );
  }

  try {
    /*
     * 1. Lecture et préparation du bilan.
     *
     * Aucune modification de Supabase
     * n'est encore effectuée.
     */
    const {
      year,
      report,
    } =
      await buildCurrentAnnualReport(
        admin
      );

    /*
     * 2. Archivage de toutes les réunions
     * de l'année active.
     */
    const archivedInstances =
      await archiveCurrentYearInstances(
        admin,
        year.id
      );

    /*
     * 3. Génération du bilan annuel.
     */
    const pdf =
      await buildAnnualReportPdf(
        report
      );

    /*
     * 4. Archivage du bilan annuel dans Drive.
     */
    const drive =
      await archivePdfInDrive(
        year.label,
        pdf
      );

    /*
     * 5. Seulement si toutes les archives
     * sont réussies, on effectue la clôture SQL.
     */
    const {
      data,
      error,
    } =
      await admin.rpc(
        'gipe_cloturer_annee',
        {
          p_new_year_label:
            newYearLabel,
        }
      );

    if (error) {
      return NextResponse.json(
        {
          error:
            `Les archives ont bien été envoyées dans Google Drive, mais la clôture Supabase a échoué : ${error.message}`,
          drive,
          archivedInstances,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: data,
      drive,
      archivedInstances,
    });
  } catch (error) {
    console.error(
      'Erreur clôture annuelle GIPE:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de clôturer l’année scolaire.',
      },
      { status: 500 }
    );
  }
}
