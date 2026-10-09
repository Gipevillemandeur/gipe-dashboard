import { NextResponse } from 'next/server';
import { requireOfficePermission } from '@/lib/office-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAnnualReportPdf,
  type AnnualReportData,
} from '@/lib/annual-report-pdf';

async function requireConfigurationAccess() {
  try {
    await requireOfficePermission('configuration');

    return {};
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

async function getAnnualReportData(): Promise<AnnualReportData> {
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
   * Un adhérent n'est compté qu'une seule fois
   * dans une même classe.
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

  /*
   * Le PDF attend un objet :
   *
   * {
   *   "6A": 12,
   *   "6B": 9,
   *   "5A": 14
   * }
   */
  const adherentsByClass:
    Record<string, number> = {};

  Array.from(byClass.entries())
    .sort(([a], [b]) =>
      a.localeCompare(
        b,
        'fr',
        {
          numeric: true,
          sensitivity: 'base',
        }
      )
    )
    .forEach(
      ([className, memberIds]) => {
        adherentsByClass[className] =
          memberIds.size;
      }
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

    /*
     * On accepte les différentes écritures
     * possibles pour sécuriser le traitement.
     */
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
   * Arrondi financier à 2 décimales.
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
      Number(year.initial_balance || 0) *
        100
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
   * Conversion du détail financier
   * vers le format attendu par le PDF.
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
   * Données complètes du rapport.
   */
  return {
    schoolYear: year.label,

    totalAdherents:
      rows.length,

    adherentsByClass,

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

export async function GET() {
  const auth =
    await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  try {
    const report =
      await getAnnualReportData();

    const pdf =
      await buildAnnualReportPdf(
        report
      );

    /*
     * pdf-lib retourne un Uint8Array.
     * On le convertit en ArrayBuffer
     * compatible avec NextResponse.
     */
    const body =
      new ArrayBuffer(
        pdf.byteLength
      );

    new Uint8Array(body).set(
      pdf
    );

    return new NextResponse(
      body,
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/pdf',

          'Content-Disposition':
            `attachment; filename="Bilan-annuel-GIPE-${report.schoolYear}.pdf"`,

          'Cache-Control':
            'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'Erreur génération bilan PDF:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de générer le bilan PDF.',
      },
      { status: 500 }
    );
  }
}
