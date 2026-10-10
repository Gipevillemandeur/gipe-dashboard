import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOfficeAccess } from '@/lib/office-auth';
import { GUIDE_SECTIONS, getGuideSection } from '@/lib/guide-content';

const MAX_BODY_LENGTH = 30000;

async function requireMember() {
  const access = await getOfficeAccess();

  if (!access.authenticated) {
    return { error: NextResponse.json({ error: 'Non authentifié.' }, { status: 401 }) };
  }

  if (!access.authorized) {
    return { error: NextResponse.json({ error: 'Compte non autorisé.' }, { status: 403 }) };
  }

  return {
    access,
    isPresident: access.isPresident || access.isSuperAdmin,
  };
}

/*
 * GET : le guide (texte modifié s'il existe, sinon texte d'origine).
 * Les sections techniques ne sont envoyées qu'au Président.
 */
export async function GET() {
  const auth = await requireMember();
  if ('error' in auth) return auth.error;

  const visible = GUIDE_SECTIONS.filter(
    (section) => auth.isPresident || !section.presidentOnly
  );

  const { data: saved, error } = await createAdminClient()
    .from('gipe_guide_sections')
    .select('slug,body,updated_at,updated_by')
    .in('slug', visible.map((section) => section.slug));

  /*
   * Table absente (SQL pas encore lancé) : on affiche
   * quand même le guide d'origine, sans modification possible.
   */
  const tableMissing = Boolean(error);

  if (error) {
    console.error('Lecture du guide :', error.message);
  }

  const bySlug = new Map((saved ?? []).map((row) => [row.slug as string, row]));

  return NextResponse.json({
    canEdit: auth.isPresident && !tableMissing,
    storageReady: !tableMissing,
    sections: visible.map((section) => {
      const custom = bySlug.get(section.slug);

      return {
        slug: section.slug,
        title: section.title,
        summary: section.summary,
        presidentOnly: section.presidentOnly,
        body: custom?.body ?? section.body,
        customized: Boolean(custom),
        updatedAt: custom?.updated_at ?? null,
        updatedBy: custom?.updated_by ?? null,
      };
    }),
  });
}

/*
 * PUT : enregistre le texte d'une section (Président uniquement).
 */
export async function PUT(request: Request) {
  const auth = await requireMember();
  if ('error' in auth) return auth.error;

  if (!auth.isPresident) {
    return NextResponse.json(
      { error: 'Seul le Président peut modifier le guide.' },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    body?: string;
  } | null;

  const section = getGuideSection(String(body?.slug || ''));
  const text = String(body?.body ?? '').replace(/\r\n/g, '\n').trim();

  if (!section) {
    return NextResponse.json({ error: 'Section inconnue.' }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json(
      { error: 'Le texte ne peut pas être vide. Utilise « Revenir au texte d’origine » si besoin.' },
      { status: 400 }
    );
  }

  if (text.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: 'Le texte est trop long.' }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from('gipe_guide_sections')
    .upsert(
      {
        slug: section.slug,
        body: text,
        updated_at: new Date().toISOString(),
        updated_by: auth.access.email,
      },
      { onConflict: 'slug' }
    );

  if (error) {
    return NextResponse.json(
      { error: `Enregistrement impossible : ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

/*
 * DELETE ?slug=… : revient au texte d'origine (Président uniquement).
 */
export async function DELETE(request: Request) {
  const auth = await requireMember();
  if ('error' in auth) return auth.error;

  if (!auth.isPresident) {
    return NextResponse.json(
      { error: 'Seul le Président peut modifier le guide.' },
      { status: 403 }
    );
  }

  const section = getGuideSection(new URL(request.url).searchParams.get('slug') || '');

  if (!section) {
    return NextResponse.json({ error: 'Section inconnue.' }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from('gipe_guide_sections')
    .delete()
    .eq('slug', section.slug);

  if (error) {
    return NextResponse.json(
      { error: `Impossible de revenir au texte d’origine : ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
