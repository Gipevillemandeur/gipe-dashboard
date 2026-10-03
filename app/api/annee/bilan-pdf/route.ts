import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAnnualReportPdf,
  type AnnualReportData,
} from '@/lib/annual-report-pdf';

async function requireAdmin() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Non authentifie.' },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        {
          error:
            'Impossible de verifier les droits administrateur.',
        },
        { status: 500 }
      ),
    };
  }

  if (!data) {
    return {
      error: NextResponse.json(
        { error: 'Compte non autorise.' },
        { status: 403 }
      ),
    };
  }

  return { admin };
}

async function getAnnualReportData() {
  const admin = createAdminClient();

  const { data: year, error: yearError } = await admin
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
    .maybeSingle();

  if (yearError) {
    throw new Error(yearError.message);
  }

  if (!year) {
    throw new Error('Aucune annee scolaire active.');
  }

  const { data: memberships, error: membershipsError } = await admin
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
    throw new Error(membershipsError.message);
  }

  const rows = memberships || [];
  const byClass = new Map<string, Set<string>>();

  for (const membership of rows) {
    const children = Array.isArray(
      membership.gipe_membership_children
    )
      ? membership.gipe_membership_children
      : [];

    const classesForMember = new Set<string>();

    for (const child of children) {
      const classData = Array.isArray(child.classes)
        ? child.classes[0]
        : child.classes;

      const className = classData?.name;

      if (className) {
        classesForMember.add(className);
      }
    }

    for (const className of classesForMember) {
      if (!byClass.has(className)) {
        byClass.set(className, new Set<string>());
      }

      byClass.get(className)!.add(membership.id);
    }
  }

  const adherentsByClass = Array.from(byClass.entries())
    .map(([className, memberIds]) => ({
      className,
      count: memberIds.size,
    }))
    .sort((a, b) =>
      a.className.localeCompare(b.className, 'fr', {
        numeric: true,
      })
    );

  return {
    schoolYear: year.label,
    totalAdherents: rows.length,
    adherentsByClass,
  };
}

export async function GET() {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  try {
    const data = await getAnnualReportData();

    const report: AnnualReportData = {
      ...data,
      totalRecettes: null,
      totalDepenses: null,
      solde: null,
      closedAt: new Date().toISOString(),
    };

    const pdf = await buildAnnualReportPdf(report);
    const body = new Blob([pdf], {
      type: 'application/pdf',
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          `attachment; filename="Bilan-annuel-GIPE-${data.schoolYear}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erreur generation bilan PDF:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de generer le bilan PDF.',
      },
      { status: 500 }
    );
  }
}
