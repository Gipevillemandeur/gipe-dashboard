import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSchoolYear } from '@/lib/annual-report';
import { checkYearAccess, errorMessage } from '@/lib/year-access';

const MAX_TEXT = 20000;

function cleanText(value: unknown) {
  return String(value ?? '').trim().slice(0, MAX_TEXT);
}

/*
 * CLÔTURE DE L'ANNÉE (Président uniquement)
 *
 * 1. Clôture en base (fonction SQL gipe_cloturer_annee) :
 *    bilan chiffré archivé, année fermée, nouvelle année
 *    créée avec le solde reporté.
 * 2. Enregistrement des textes (bilan moral, perspectives,
 *    remarques) dans l'archive de clôture.
 *
 * L'archivage Drive se fait ensuite étape par étape
 * (/api/annee/archiver), pour pouvoir être repris en cas
 * de souci.
 */
export async function POST(request: Request) {
  const auth = await checkYearAccess('president');

  if ('error' in auth) {
    return auth.error;
  }

  try {
    const body = await request.json();

    const newYearLabel = String(body?.newYearLabel || '').trim();

    if (!/^\d{4}-\d{4}$/.test(newYearLabel)) {
      return NextResponse.json(
        {
          error:
            'Le libellé de la nouvelle année doit être au format 2027-2028.',
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Année qui va être clôturée (pour retrouver son archive).
    const closingYear = await resolveSchoolYear(admin);

    const { data: result, error: closureError } = await admin.rpc(
      'gipe_cloturer_annee',
      { p_new_year_label: newYearLabel }
    );

    if (closureError) {
      return NextResponse.json(
        { error: closureError.message },
        { status: 400 }
      );
    }

    /*
     * Textes du bilan. En cas d'échec, la clôture reste
     * faite : les textes seront renvoyés lors de
     * l'archivage (étape « bilan »).
     */
    const { error: textsError } = await admin
      .from('gipe_year_closures')
      .update({
        moral_report: cleanText(body?.moralReport) || null,
        perspectives: cleanText(body?.perspectives) || null,
        notes: cleanText(body?.notes) || null,
      })
      .eq('school_year_id', closingYear.id);

    if (textsError) {
      console.error('Erreur enregistrement textes de clôture :', textsError);
    }

    return NextResponse.json({
      result,
      closedYearId: closingYear.id,
      textsSaved: !textsError,
    });
  } catch (error) {
    console.error('Erreur clôture année scolaire :', error);

    return NextResponse.json(
      {
        error: errorMessage(error, 'Impossible de clôturer l’année scolaire.'),
      },
      { status: 500 }
    );
  }
}
