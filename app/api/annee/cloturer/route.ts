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
        { error: 'Non authentifié.' },
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
            'Impossible de vérifier les droits administrateur.',
        },
        { status: 500 }
      ),
    };
  }

  if (!data) {
    return {
      error: NextResponse.json(
        { error: 'Compte non autorisé.' },
        { status: 403 }
      ),
    };
  }

  return { admin, userId };
}

function sanitizeFileNamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();
}

async function buildCurrentAnnualReport(admin: ReturnType<typeof createAdminClient>) {
  const { data: year, error: yearError } = await admin
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
    .maybeSingle();

  if (yearError) {
    throw new Error(yearError.message);
  }

  if (!year) {
    throw new Error('Aucune année scolaire active.');
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

  const report: AnnualReportData = {
    schoolYear: year.label,
    totalAdherents: rows.length,
    adherentsByClass,
    totalRecettes: null,
    totalDepenses: null,
    solde: null,
    closedAt: new Date().toISOString(),
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

  const safeYear = sanitizeFileNamePart(schoolYear);
  const fileName =
    `Bilan-annuel-GIPE-${safeYear}.pdf`;

  const pdfBase64 = Buffer.from(pdf).toString('base64');

  const response = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'upload_annual_report',
      token,
      schoolYear,
      fileName,
      pdfBase64,
    }),
    cache: 'no-store',
  });

  const responseText = await response.text();

  let result: any;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Réponse Apps Script inattendue (HTTP ${response.status}).`
    );
  }

  if (!response.ok || !result?.ok) {
    throw new Error(
      result?.error ||
        `Archivage Drive impossible (HTTP ${response.status}).`
    );
  }

  return result;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const body = await request.json().catch(() => null) as {
    newYearLabel?: string;
  } | null;

  const newYearLabel = String(
    body?.newYearLabel || ''
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

  if (newYearLabel.length > 30) {
    return NextResponse.json(
      {
        error:
          'Le libellé de l’année scolaire est trop long.',
      },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{4}$/.test(newYearLabel)) {
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
     * 1. On lit et prépare le bilan de l'année actuellement active.
     *    Aucune modification de Supabase n'a encore été faite.
     */
    const { year, report } =
      await buildCurrentAnnualReport(admin);

    /*
     * 2. Génération du PDF avec le modèle validé.
     */
    const pdf = await buildAnnualReportPdf(report);

    /*
     * 3. Archivage Drive AVANT la clôture SQL.
     *
     * Si Drive échoue, on s'arrête ici et l'année reste active.
     */
    const drive = await archivePdfInDrive(
      year.label,
      pdf
    );

    /*
     * 4. Seulement si Drive confirme l'archivage,
     *    on effectue la vraie clôture.
     */
    const { data, error } = await admin.rpc(
      'gipe_cloturer_annee',
      {
        p_new_year_label: newYearLabel,
      }
    );

    if (error) {
      return NextResponse.json(
        {
          error:
            `Le bilan a bien été archivé dans Google Drive, mais la clôture Supabase a échoué : ${error.message}`,
          drive,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: data,
      drive,
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
