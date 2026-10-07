import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleDriveErrorResponse = {
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

async function getGoogleAccessToken(userId: string) {
  const adminClient = createAdminClient();

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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'La configuration Google OAuth est incomplète.'
    );
  }

  const tokenResponse = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token:
          connection.refresh_token,
        grant_type: 'refresh_token',
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

export async function DELETE(request: Request) {
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

    const url = new URL(request.url);

    const fileId =
      url.searchParams.get('id')?.trim();

    if (!fileId) {
      return NextResponse.json(
        {
          error:
            'L’identifiant du fichier ou du dossier est obligatoire.',
        },
        { status: 400 }
      );
    }

    const accessToken =
      await getGoogleAccessToken(userId);

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}?supportsAllDrives=true`,
      {
        method: 'DELETE',
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );

    if (!driveResponse.ok) {
      const driveData =
        (await driveResponse.json()) as GoogleDriveErrorResponse;

      console.error(
        'Erreur suppression Google Drive:',
        driveData
      );

      return NextResponse.json(
        {
          error:
            driveData?.error?.message ||
            'Impossible de supprimer cet élément de Google Drive.',
        },
        {
          status:
            driveResponse.status || 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      id: fileId,
    });
  } catch (error) {
    console.error(
      'Erreur API suppression Google Drive:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer cet élément.',
      },
      { status: 500 }
    );
  }
}
