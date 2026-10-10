import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAnnualReport } from '@/lib/annual-report';
import { buildAnnualReportPdf } from '@/lib/annual-report-pdf';
import { checkYearAccess, errorMessage } from '@/lib/year-access';

/*
 * Télécharge le PDF du bilan.
 * ?yearId=... : une année précise (clôturée ou non),
 * sinon l'année en cours (document provisoire).
 */
export async function GET(request: Request) {
  const auth = await checkYearAccess('configuration');

  if ('error' in auth) {
    return auth.error;
  }

  try {
    const yearId = new URL(request.url).searchParams.get('yearId');
    const report = await buildAnnualReport(createAdminClient(), yearId);
    const pdf = await buildAnnualReportPdf(report);

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Bilan-annuel-GIPE-${report.schoolYear}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erreur génération bilan PDF :', error);

    return NextResponse.json(
      { error: errorMessage(error, 'Impossible de générer le bilan.') },
      { status: 500 }
    );
  }
}
