import { NextResponse } from 'next/server';
import { requireOfficePermission } from '@/lib/office-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAnnualReportPdf,
  type AnnualReportData,
} from '@/lib/annual-report-pdf';

async function requireConfigurationAccess() {
  try {
    const access =
      await requireOfficePermission('configuration');

    /*
     * La clôture de l'année est réservée au
     * Président (et au SUPER ADMIN).
     */
    if (!access.isPresident && !access.isSuperAdmin) {
      return {
        error: NextResponse.json(
          {
            error:
              'Seul le Président peut clôturer l’année scolaire.',
          },
          { status: 403 }
        ),
      };
    }

    return {};
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
          error: 'Erreur de contrôle des accès.',
        },
        { status: 500 }
      ),
    };
  }
}

async function buildCurrentAnnualReport(): Promise<AnnualReportData> {
  const admin = createAdminClient();

  /*
   * Année scolaire active
   */
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

  /*
   * ADHÉSIONS
   */
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

  /*
   * Répartition des adhérents par classe.
   *
   * Cette variable reste volontairement
   * sous forme de tableau.
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

  const adherentsByClassArray =
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
            sensitivity: 'base',
          }
        )
      );

  /*
   * Conversion explicite vers le format
   * attendu par AnnualReportData.
   *
   * Tableau :
   * [
   *   { className: '6A', count: 12 }
   * ]
   *
   * devient :
   * {
   *   '6A': 12
   * }
   */
  const adherentsByClassRecord:
    Record<string, number> =
    Object.fromEntries(
      adherentsByClassArray.map(
        ({ className, count }) => [
          className,
          count,
        ]
      )
    );

  /*
   * TRÉSORERIE
   */
  const {
    data: transactions,
    error: transactionsError,
  } = await admin
    .from('gipe_transactions')
    .select(
      'transaction_type,category,amount'
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

    if (!Number.isFinite(amount)) {
      continue;
    }

    const category =
      transaction.category?.trim() ||
      'Sans catégorie';

    if (!financialByCategory.has(category)) {
      financialByCategory.set(
        category,
        {
          recettes: 0,
          depenses: 0,
        }
      );
    }

    const financial =
      financialByCategory.get(category)!;

    const transactionType =
      String(
        transaction.transaction_type || ''
      )
        .trim()
        .toLowerCase();

    const isRecette =
      [
        'recette',
        'recettes',
        'income',
        'entree',
        'entrée',
      ].includes(transactionType);

    const isDepense =
      [
        'depense',
        'depenses',
        'dépense',
        'dépenses',
        'expense',
        'sortie',
      ].includes(transactionType);

    if (isRecette) {
      financial.recettes += amount;
      totalRecettes += amount;
    } else if (isDepense) {
      financial.depenses += amount;
      totalDepenses += amount;
    }
  }

  /*
   * Arrondis financiers
   */
  totalRecettes =
    Math.round(
      totalRecettes * 100
    ) / 100;

  totalDepenses =
    Math.round(
      totalDepenses * 100
    ) / 100;

  const initialBalance =
    Math.round(
      Number(
        year.initial_balance || 0
      ) * 100
    ) / 100;

  const solde =
    Math.round(
      (
        initialBalance +
        totalRecettes -
        totalDepenses
      ) * 100
    ) / 100;

  /*
   * Détail financier par catégorie
   */
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
            sensitivity: 'base',
          }
        )
      );

  /*
   * Rapport annuel
   */
  return {
    schoolYear: year.label,

    totalAdherents:
      rows.length,

    adherentsByClass:
      adherentsByClassRecord,

    initialBalance,

    totalRecettes,

    totalDepenses,

    solde,

    financialByCategory:
      financialByCategoryList,

    closedAt:
      new Date().toISOString(),
  };
}

export async function POST(
  request: Request
) {
  const auth =
    await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  try {
    const body =
      await request.json();

    const newYearLabel =
      String(
        body?.newYearLabel || ''
      ).trim();

    if (!newYearLabel) {
      return NextResponse.json(
        {
          error:
            "Le libellé de la nouvelle année scolaire est obligatoire.",
        },
        { status: 400 }
      );
    }

    const admin =
      createAdminClient();

    /*
     * On construit le bilan avant
     * la clôture réelle.
     */
    const report =
      await buildCurrentAnnualReport();

    /*
     * Génération du PDF.
     */
    const pdf =
      await buildAnnualReportPdf(
        report
      );

    /*
     * Conversion Uint8Array -> ArrayBuffer
     */
    const pdfBuffer =
      new ArrayBuffer(
        pdf.byteLength
      );

    new Uint8Array(
      pdfBuffer
    ).set(pdf);

    /*
     * Clôture réelle de l'année.
     */
    const {
      error: closureError,
    } = await admin.rpc(
      'gipe_cloturer_annee',
      {
        p_new_year_label:
          newYearLabel,
      }
    );

    if (closureError) {
      throw new Error(
        closureError.message
      );
    }

    return new NextResponse(
      pdfBuffer,
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/pdf',

          'Content-Disposition':
            `attachment; filename="Bilan-annuel-GIPE-${report.schoolYear}.pdf"`,

          'X-Closure-Completed':
            'true',

          'Cache-Control':
            'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'Erreur clôture année scolaire :',
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
