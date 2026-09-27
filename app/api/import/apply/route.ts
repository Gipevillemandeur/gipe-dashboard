import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseCollegeWorkbook, summarizeImport } from '@/lib/college-import';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: adminRow, error: adminError } = await admin
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (adminError) {
    return NextResponse.json({ error: 'Impossible de vérifier les droits administrateur.' }, { status: 500 });
  }
  if (!adminRow) {
    return NextResponse.json({ error: 'Ce compte n\'est pas autorisé à importer les données du collège.' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const schoolYearLabel = String(formData.get('schoolYearLabel') || '').trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
  }
  if (!/^\d{4}-\d{4}$/.test(schoolYearLabel)) {
    return NextResponse.json({ error: 'Année scolaire invalide. Exemple : 2026-2027.' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Le fichier est trop volumineux (10 Mo maximum).' }, { status: 413 });
  }
  if (!/\.(xls|xlsx)$/i.test(file.name)) {
    return NextResponse.json({ error: 'Format non accepté. Utilise un fichier .xls ou .xlsx.' }, { status: 415 });
  }

  try {
    const parsed = parseCollegeWorkbook(await file.arrayBuffer());
    if (parsed.classes.length === 0) {
      return NextResponse.json({ error: 'Aucune classe réelle exploitable n\'a été détectée. Rien n\'a été modifié.' }, { status: 422 });
    }

    const { error } = await admin.rpc('replace_current_school_state', {
      p_school_year_label: schoolYearLabel,
      p_classes: parsed.classes,
      p_direction: parsed.direction,
    });

    if (error) {
      return NextResponse.json({ error: `L'import n'a pas été appliqué : ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, fileName: file.name, summary: summarizeImport(parsed) });
  } catch {
    return NextResponse.json({ error: 'Erreur pendant l\'import. Aucune confirmation de mise à jour n\'a été donnée.' }, { status: 500 });
  }
}
