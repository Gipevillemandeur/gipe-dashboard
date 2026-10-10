import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAnnualReport } from '@/lib/annual-report';
import { checkYearAccess, errorMessage } from '@/lib/year-access';

/*
 * Aperçu du bilan de l'année en cours, affiché dans la
 * fenêtre de clôture (réservée au Président).
 */
export async function GET() {
  const auth = await checkYearAccess('president');

  if ('error' in auth) {
    return auth.error;
  }

  try {
    const report = await buildAnnualReport(createAdminClient());

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Erreur aperçu de clôture :', error);

    return NextResponse.json(
      {
        error: errorMessage(
          error,
          'Impossible de préparer l’aperçu de clôture.'
        ),
      },
      { status: 500 }
    );
  }
}
