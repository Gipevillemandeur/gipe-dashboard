import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
};

type GoogleDriveResponse = {
  files?: GoogleDriveFile[];
  nextPageToken?: string;
  error?: {
    message?: string;
  };
};

async function getAuthenticatedUserId() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: admin } = await supabase
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin) {
    return null;
  }

  return user.id;
}

async function getGoogleAccessToken(
  userId: string
) {
  const adminClient =
    createAdminClient();

  const { data: connection, error } =
    await adminClient
      .from('google_drive_connections')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle();

  if (error) {
    throw new Error(
      'Impossible de récupérer la connexion Google Drive.'
    );
  }

  if (!connection?.refresh_token) {
    throw new Error(
      'Google Drive n’est pas connecté.'
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
    throw new Error(
      'La configuration Google OAuth est incomplète.'
    );
  }

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
            client_id: clientId,
            client_secret:
              clientSecret,
            refresh_token:
              connection.refresh_token,
            grant_type:
              'refresh_token',
          }).toString(),
        cache: 'no-store',
      }
    );

  const tokenData =
    (await tokenResponse.json()) as GoogleTokenResponse;

  if (
    !tokenResponse.ok ||
    !tokenData.access_token
  ) {
    console.error(
      'Erreur renouvellement token Google:',
      tokenData
    );

    throw new Error(
      'Impossible d’obtenir un accès au Google Drive.'
    );
  }

  return tokenData.access_token;
}

export async function GET(
  request: Request
) {
  try {
    const userId =
      await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error:
            'Accès réservé aux administrateurs.',
        },
        { status: 403 }
      );
    }

    const accessToken =
      await getGoogleAccessToken(
        userId
      );

    const requestUrl =
      new URL(request.url);

    const folderId =
      requestUrl.searchParams.get(
        'folderId'
      ) || 'root';

    const url =
      new URL(
        'https://www.googleapis.com/drive/v3/files'
      );

    url.searchParams.set(
      'q',
      `'${folderId}' in parents and trashed = false`
    );

    url.searchParams.set(
      'pageSize',
      '100'
    );

    url.searchParams.set(
      'orderBy',
      'folder,name'
    );

    url.searchParams.set(
      'fields',
      'files(id,name,mimeType,size,modifiedTime,webViewLink,parents),nextPageToken'
    );

    const driveResponse =
      await fetch(
        url.toString(),
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }
      );

    const driveData =
      (await driveResponse.json()) as GoogleDriveResponse;

    if (!driveResponse.ok) {
      console.error(
        'Erreur Google Drive:',
        driveData
      );

      return NextResponse.json(
        {
          error:
            driveData?.error?.message ||
            'Impossible de récupérer les fichiers du Google Drive.',
        },
        {
          status:
            driveResponse.status || 500,
        }
      );
    }

    return NextResponse.json({
      files:
        driveData.files || [],
    });
  } catch (error) {
    console.error(
      'Erreur API Google Drive:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de récupérer le Google Drive.',
      },
      { status: 500 }
    );
  }
}
