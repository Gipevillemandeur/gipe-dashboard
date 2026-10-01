import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  return { admin };
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

  const { data, error } = await admin.rpc(
    'gipe_cloturer_annee',
    {
      p_new_year_label: newYearLabel,
    }
  );

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    result: data,
  });
}
