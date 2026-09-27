import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseCollegeWorkbook, summarizeImport } from '@/lib/college-import';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (adminError || !adminRow) {
    return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Le fichier est trop volumineux (10 Mo maximum).' }, { status: 413 });
  }

  const allowed = /\.(xls|xlsx)$/i;
  if (!allowed.test(file.name)) {
    return NextResponse.json({ error: 'Format non accepté. Utilise un fichier .xls ou .xlsx.' }, { status: 415 });
  }

  try {
    const parsed = parseCollegeWorkbook(await file.arrayBuffer());
    return NextResponse.json({ fileName: file.name, summary: summarizeImport(parsed), parsed });
  } catch {
    return NextResponse.json({ error: 'Impossible de lire le fichier fourni.' }, { status: 400 });
  }
}
