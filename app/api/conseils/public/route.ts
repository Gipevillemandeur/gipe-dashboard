import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function cors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classe = (searchParams.get('classe') || '').trim();
    const code = (searchParams.get('code') || '').trim();
    const admin = createAdminClient();

    const { data: year, error: yearError } = await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle();

    if (yearError) return cors(NextResponse.json({ error: 'Lecture année scolaire impossible.' }, { status: 500 }));
    if (!year) return cors(NextResponse.json({ schoolYear: null, classes: [] }));

    if (!classe) {
      const { data: classes, error } = await admin
        .from('classes')
        .select('name,level,kind,active')
        .eq('school_year_id', year.id)
        .eq('active', true)
        .order('kind')
        .order('name');

      if (error) return cors(NextResponse.json({ error: 'Lecture des classes impossible.' }, { status: 500 }));
      return cors(NextResponse.json({ schoolYear: year.label, classes: classes ?? [] }));
    }

    const { data: classRow, error: classError } = await admin
      .from('classes')
      .select('id,name,level,kind,access_code,active')
      .eq('school_year_id', year.id)
      .eq('name', classe)
      .eq('active', true)
      .maybeSingle();

    if (classError) return cors(NextResponse.json({ error: 'Lecture de la classe impossible.' }, { status: 500 }));
    if (!classRow) return cors(NextResponse.json({ error: 'Classe inconnue.' }, { status: 404 }));

    const expected = String(classRow.access_code ?? '').trim();
    if (expected && expected !== code) {
      return cors(NextResponse.json({ error: 'Code incorrect.' }, { status: 403 }));
    }

    const [{ data: students, error: studentsError }, { data: teacherRows, error: teacherError }, { data: direction, error: directionError }] = await Promise.all([
      admin.from('students').select('last_name,first_name').eq('class_id', classRow.id).eq('active', true).order('last_name').order('first_name'),
      admin.from('class_teachers').select('subject,is_pp,teachers(display_name)').eq('class_id', classRow.id),
      admin.from('school_management').select('display_name,role').eq('active', true).order('display_name'),
    ]);

    if (studentsError || teacherError || directionError) {
      return cors(NextResponse.json({ error: 'Lecture des données du conseil impossible.' }, { status: 500 }));
    }

    const teachers = (teacherRows ?? []).map((row: any) => ({
      subject: row.subject ?? '',
      prof: row.teachers?.display_name ?? '',
      isPP: Boolean(row.is_pp),
    })).filter((row) => row.prof || row.subject);

    return cors(NextResponse.json({
      schoolYear: year.label,
      class: { name: classRow.name, level: classRow.level, kind: classRow.kind },
      students: students ?? [],
      teachers,
      direction: direction ?? [],
    }));
  } catch (error) {
    console.error('Conseils public API:', error);
    return cors(NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 }));
  }
}
