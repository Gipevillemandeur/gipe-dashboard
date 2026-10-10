import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/office-auth';
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

const STATE_COOKIE = 'gipe_drive_oauth_state';

/*
 * Retour de Google après la connexion du Drive.
 * Enregistre le jeton durable : il remplace l'ancienne
 * connexion pour toute l'association.
 */
export async function GET(request: Request) {
  const back = (status: string) => {
    const response = NextResponse.redirect(
      new URL(`/documents?google=${status}`, request.url)
    );

    response.cookies.set(STATE_COOKIE, '', {
      path: '/api/google/drive',
      maxAge: 0,
    });

    return response;
  };

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const googleError = url.searchParams.get('error');

    if (googleError) {
      console.error('Google OAuth refusé:', googleError);
      return back('cancelled');
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const expectedState = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${STATE_COOKIE}=`))
      ?.slice(STATE_COOKIE.length + 1);

    if (!code || !state || !expectedState || state !== expectedState) {
      return back('invalid_state');
    }

    const access = await getOfficeAccess();

    if (!access.authenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!access.authorized || !access.userId || !(access.isPresident || access.isSuperAdmin)) {
      return back('forbidden');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return back('config_error');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${url.origin}/api/google/drive/callback`,
        grant_type: 'authorization_code',
      }).toString(),
      cache: 'no-store',
    });

    const tokenData = (await tokenResponse
      .json()
      .catch(() => ({}))) as GoogleTokenResponse;

    if (!tokenResponse.ok) {
      console.error('Erreur échange code Google:', tokenData);
      return back('token_error');
    }

    if (!tokenData.refresh_token) {
      console.error('Google n’a pas fourni de refresh token.');
      return back('no_refresh_token');
    }

    let googleEmail: string | null = null;

    if (tokenData.access_token) {
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
          cache: 'no-store',
        }
      );

      if (userInfoResponse.ok) {
        const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;
        googleEmail = userInfo.email || null;
      }
    }

    const adminClient = createAdminClient();

    const { error: saveError } = await adminClient
      .from('google_drive_connections')
      .upsert(
        {
          user_id: access.userId,
          google_email: googleEmail,
          refresh_token: tokenData.refresh_token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (saveError) {
      console.error('Erreur sauvegarde connexion Google Drive:', saveError);
      return back('save_error');
    }

    /*
     * Une seule connexion pour l'association :
     * les anciennes sont effacées.
     */
    const { error: cleanError } = await adminClient
      .from('google_drive_connections')
      .delete()
      .neq('user_id', access.userId);

    if (cleanError) {
      console.error('Nettoyage anciennes connexions Drive:', cleanError);
    }

    return back('connected');
  } catch (error) {
    console.error('Erreur callback Google Drive:', error);
    return back('error');
  }
}
