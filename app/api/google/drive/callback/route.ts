import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
};

export async function GET(
  request: Request
) {
  try {
    const url = new URL(request.url);

    const code =
      url.searchParams.get('code');

    const error =
      url.searchParams.get('error');

    if (error) {
      console.error(
        'Google OAuth refusé:',
        error
      );

      return NextResponse.redirect(
        new URL(
          '/documents?google=cancelled',
          request.url
        )
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(
          '/documents?google=missing_code',
          request.url
        )
      );
    }

    const supabase =
      await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL('/login', request.url)
      );
    }

    const { data: admin } =
      await supabase
        .from('gipe_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (!admin) {
      return NextResponse.json(
        {
          error:
            'Accès réservé aux administrateurs.',
        },
        { status: 403 }
      );
    }

    const clientId =
      process.env.GOOGLE_CLIENT_ID;

    const clientSecret =
      process.env.GOOGLE_CLIENT_SECRET;

    if (
      !clientId ||
      !clientSecret
    ) {
      return NextResponse.json(
        {
          error:
            'La configuration Google OAuth est incomplète.',
        },
        { status: 500 }
      );
    }

    const redirectUri =
      `${url.origin}` +
      '/api/google/drive/callback';

    const tokenResponse =
      await fetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },
          body:
            new URLSearchParams({
              code,
              client_id: clientId,
              client_secret:
                clientSecret,
              redirect_uri:
                redirectUri,
              grant_type:
                'authorization_code',
            }).toString(),
          cache: 'no-store',
        }
      );

    const tokenData =
      (await tokenResponse.json()) as GoogleTokenResponse;

    if (
      !tokenResponse.ok
    ) {
      console.error(
        'Erreur échange code Google:',
        tokenData
      );

      return NextResponse.redirect(
        new URL(
          '/documents?google=token_error',
          request.url
        )
      );
    }

    if (
      !tokenData.refresh_token
    ) {
      console.error(
        'Google n’a pas fourni de refresh token.'
      );

      return NextResponse.redirect(
        new URL(
          '/documents?google=no_refresh_token',
          request.url
        )
      );
    }

    let googleEmail: string | null =
      null;

    if (tokenData.access_token) {
      const userInfoResponse =
        await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: {
              Authorization:
                `Bearer ${tokenData.access_token}`,
            },
            cache: 'no-store',
          }
        );

      if (
        userInfoResponse.ok
      ) {
        const userInfo =
          (await userInfoResponse.json()) as GoogleUserInfo;

        googleEmail =
          userInfo.email || null;
      }
    }

    const adminClient =
      createAdminClient();

    const { error: saveError } =
      await adminClient
        .from(
          'google_drive_connections'
        )
        .upsert(
          {
            user_id: user.id,
            google_email:
              googleEmail,
            refresh_token:
              tokenData.refresh_token,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              'user_id',
          }
        );

    if (saveError) {
      console.error(
        'Erreur sauvegarde connexion Google Drive:',
        saveError
      );

      return NextResponse.redirect(
        new URL(
          '/documents?google=save_error',
          request.url
        )
      );
    }

    return NextResponse.redirect(
      new URL(
        '/documents?google=connected',
        request.url
      )
    );
  } catch (error) {
    console.error(
      'Erreur callback Google Drive:',
      error
    );

    return NextResponse.redirect(
      new URL(
        '/documents?google=error',
        request.url
      )
    );
  }
}
