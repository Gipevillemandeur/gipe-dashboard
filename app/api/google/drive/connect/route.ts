import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL('/login', request.url)
      );
    }

    const { data: admin } = await supabase
      .from('gipe_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!admin) {
      return NextResponse.json(
        {
          error: 'Accès réservé aux administrateurs.',
        },
        { status: 403 }
      );
    }

    const clientId =
      process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        {
          error:
            'GOOGLE_CLIENT_ID est absent de la configuration.',
        },
        { status: 500 }
      );
    }

    const redirectUri =
      `${new URL(request.url).origin}` +
      '/api/google/drive/callback';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope:
        'https://www.googleapis.com/auth/drive',
    });

    const googleUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.redirect(
      googleUrl
    );
  } catch (error) {
    console.error(
      'Erreur connexion Google Drive:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Impossible de démarrer la connexion Google Drive.',
      },
      { status: 500 }
    );
  }
}
