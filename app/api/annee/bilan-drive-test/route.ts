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
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Impossible de vérifier les droits administrateur.' },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Compte non autorisé.' }, { status: 403 });
  }

  return null;
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const admin = createAdminClient();

    const { data: year, error: yearError } = await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle();

    if (yearError) throw new Error(yearError.message);
    if (!year) throw new Error('Aucune année scolaire active.');

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

    if (membershipsError) throw new Error(membershipsError.message);

    const rows = memberships || [];
    const byClass = new Map<string, Set<string>>();

    for (const membership of rows) {
      const children = Array.isArray(membership.gipe_membership_children)
        ? membership.gipe_membership_children
        : [];

      const classesForMember = new Set<string>();

      for (const child of children) {
        const classData = Array.isArray(child.classes)
          ? child.classes[0]
          : child.classes;
        const className = classData?.name;
        if (className) classesForMember.add(className);
      }

      for (const className of classesForMember) {
        if (!byClass.has(className)) byClass.set(className, new Set<string>());
        byClass.get(className)!.add(membership.id);
      }
    }

    const report: AnnualReportData = {
      schoolYear: 'TEST',
      totalAdherents: rows.length,
      adherentsByClass: Array.from(byClass.entries())
        .map(([className, memberIds]) => ({ className, count: memberIds.size }))
        .sort((a, b) => a.className.localeCompare(b.className, 'fr', { numeric: true })),
      totalRecettes: null,
      totalDepenses: null,
      solde: null,
      closedAt: new Date().toISOString(),
    };

    const pdf = await buildAnnualReportPdf(report);
    const scriptUrl = process.env.GOOGLE_DRIVE_APPS_SCRIPT_URL?.trim();
    const token = process.env.GOOGLE_DRIVE_APPS_SCRIPT_TOKEN?.trim();

    if (!scriptUrl || !token) {
      throw new Error('La connexion Google Drive n’est pas configurée dans Vercel.');
    }

    const fileName = `TEST-Bilan-annuel-GIPE-${year.label}.pdf`;
    const response = await fetch(scriptUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload_annual_report',
        token,
        schoolYear: 'TEST',
        fileName,
        pdfBase64: Buffer.from(pdf).toString('base64'),
      }),
      cache: 'no-store',
    });

    const text = await response.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`Réponse Apps Script inattendue (HTTP ${response.status}).`);
    }

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || `Apps Script a répondu HTTP ${response.status}.`);
    }

    return NextResponse.json({
      ok: true,
      test: true,
      sourceSchoolYear: year.label,
      drive: result,
    });
  } catch (error) {
    console.error('Erreur test archivage Drive GIPE:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Test Drive impossible.',
      },
      { status: 500 }
    );
  }
}
