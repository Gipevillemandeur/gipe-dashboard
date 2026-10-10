import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAnnualReport,
  loadAdherentRows,
  loadTransactionRows,
} from '@/lib/annual-report';
import { buildAnnualReportPdf } from '@/lib/annual-report-pdf';
import {
  buildAdherentsPdf,
  buildAdherentsXlsx,
  buildTreasuryPdf,
  buildTreasuryXlsx,
} from '@/lib/archive-lists';
import { PDF, XLSX_MIME, uploadYearFile } from '@/lib/drive-archive';
import { archiveInstanceMeeting } from '@/lib/instance-meeting-drive';
import { checkYearAccess, errorMessage } from '@/lib/year-access';

// Une étape peut envoyer plusieurs fichiers vers le Drive.
export const maxDuration = 60;

const MAX_TEXT = 20000;

/*
 * Dernière année clôturée (ou celle demandée).
 */
async function findClosure(
  admin: ReturnType<typeof createAdminClient>,
  yearId: string | null
) {
  const query = admin
    .from('gipe_year_closures')
    .select('*')
    .order('closed_at', { ascending: false })
    .limit(1);

  const { data, error } = yearId
    ? await query.eq('school_year_id', yearId)
    : await query;

  if (error) throw new Error(error.message);

  return (data?.[0] as any) || null;
}

/*
 * GET : état de l'archivage de la dernière année clôturée,
 * avec la liste des étapes à effectuer.
 */
export async function GET(request: Request) {
  const auth = await checkYearAccess('president');
  if ('error' in auth) return auth.error;

  try {
    const admin = createAdminClient();
    const yearId = new URL(request.url).searchParams.get('yearId');
    const closure = await findClosure(admin, yearId);

    if (!closure) {
      return NextResponse.json({ closure: null });
    }

    const report = await buildAnnualReport(admin, closure.school_year_id);

    const steps = [
      { key: 'bilan', label: 'Bilan annuel (PDF)' },
      { key: 'adherents', label: 'Adhérents (PDF + Excel)' },
      { key: 'tresorerie', label: 'Trésorerie (PDF + Excel)' },
      ...report.meetings.map((m) => ({
        key: `meeting:${m.id}`,
        label: `Instance : ${m.date.split('-').reverse().join('/')} – ${m.type} – ${m.subject}`,
      })),
    ];

    return NextResponse.json({
      closure: {
        yearId: closure.school_year_id,
        schoolYear: report.schoolYear,
        closedAt: closure.closed_at,
        archivedAt: closure.archived_at || null,
        driveFolderUrl: closure.drive_folder_url || null,
      },
      steps,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Impossible de lire l’état de l’archivage.') },
      { status: 500 }
    );
  }
}

/*
 * POST : effectue UNE étape d'archivage.
 * { yearId, step: 'bilan' | 'adherents' | 'tresorerie' | 'meeting:<id>' | 'finish', texts? }
 */
export async function POST(request: Request) {
  const auth = await checkYearAccess('president');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const yearId = String(body?.yearId || '').trim();
    const step = String(body?.step || '').trim();

    if (!yearId || !step) {
      return NextResponse.json(
        { error: 'Année ou étape manquante.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const closure = await findClosure(admin, yearId);

    if (!closure) {
      return NextResponse.json(
        { error: 'Cette année n’a pas été clôturée.' },
        { status: 409 }
      );
    }

    /*
     * Fin : on note que l'archivage est complet.
     */
    if (step === 'finish') {
      const { error } = await admin
        .from('gipe_year_closures')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', closure.id);

      if (error) throw new Error(error.message);

      return NextResponse.json({ ok: true });
    }

    /*
     * Textes renvoyés par la page (si leur enregistrement
     * au moment de la clôture avait échoué).
     */
    if (step === 'bilan' && body?.texts) {
      const clean = (v: unknown) =>
        String(v ?? '').trim().slice(0, MAX_TEXT) || null;

      const { error } = await admin
        .from('gipe_year_closures')
        .update({
          moral_report: clean(body.texts.moralReport),
          perspectives: clean(body.texts.perspectives),
          notes: clean(body.texts.notes),
        })
        .eq('id', closure.id);

      if (error) throw new Error(error.message);
    }

    const report = await buildAnnualReport(admin, yearId);
    const year = report.schoolYear;
    let yearFolderUrl: string | undefined;

    if (step === 'bilan') {
      const result = await uploadYearFile({
        schoolYear: year,
        subFolder: '',
        fileName: `Bilan-annuel-GIPE-${year}.pdf`,
        mimeType: PDF,
        bytes: await buildAnnualReportPdf(report),
      });

      yearFolderUrl = result.yearFolderUrl;
    } else if (step === 'adherents') {
      const rows = await loadAdherentRows(admin, yearId);

      await uploadYearFile({
        schoolYear: year,
        subFolder: 'Adhérents',
        fileName: `Adherents-${year}.pdf`,
        mimeType: PDF,
        bytes: await buildAdherentsPdf(report, rows),
      });

      const result = await uploadYearFile({
        schoolYear: year,
        subFolder: 'Adhérents',
        fileName: `Adherents-${year}.xlsx`,
        mimeType: XLSX_MIME,
        bytes: buildAdherentsXlsx(report, rows),
      });

      yearFolderUrl = result.yearFolderUrl;
    } else if (step === 'tresorerie') {
      const rows = await loadTransactionRows(admin, yearId);

      await uploadYearFile({
        schoolYear: year,
        subFolder: 'Trésorerie',
        fileName: `Tresorerie-${year}.pdf`,
        mimeType: PDF,
        bytes: await buildTreasuryPdf(report, rows),
      });

      const result = await uploadYearFile({
        schoolYear: year,
        subFolder: 'Trésorerie',
        fileName: `Tresorerie-${year}.xlsx`,
        mimeType: XLSX_MIME,
        bytes: buildTreasuryXlsx(report, rows),
      });

      yearFolderUrl = result.yearFolderUrl;
    } else if (step.startsWith('meeting:')) {
      const meetingId = step.slice('meeting:'.length);

      if (!report.meetings.some((m) => m.id === meetingId)) {
        return NextResponse.json(
          { error: 'Cette réunion n’appartient pas à l’année clôturée.' },
          { status: 400 }
        );
      }

      // Fiche de réunion + compte rendu + documents joints.
      await archiveInstanceMeeting(admin, meetingId);
    } else {
      return NextResponse.json(
        { error: 'Étape inconnue.' },
        { status: 400 }
      );
    }

    if (yearFolderUrl && yearFolderUrl !== closure.drive_folder_url) {
      await admin
        .from('gipe_year_closures')
        .update({ drive_folder_url: yearFolderUrl })
        .eq('id', closure.id);
    }

    return NextResponse.json({ ok: true, yearFolderUrl: yearFolderUrl || null });
  } catch (error) {
    console.error('Erreur archivage fin d’année :', error);

    return NextResponse.json(
      { error: errorMessage(error, 'Archivage impossible.') },
      { status: 500 }
    );
  }
}
