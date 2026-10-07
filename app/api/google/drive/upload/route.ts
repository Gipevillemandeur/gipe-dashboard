import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleDriveUploadResponse = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
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

export async function POST(
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

    const formData =
      await request.formData();

    const file =
      formData.get('file');

    const parentIdValue =
      formData.get('parentId');

    const parentId =
      typeof parentIdValue === 'string' &&
      parentIdValue.trim()
        ? parentIdValue.trim()
        : 'root';

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            'Aucun fichier n’a été fourni.',
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          error:
            'Le fichier est vide.',
        },
        { status: 400 }
      );
    }

    const accessToken =
      await getGoogleAccessToken(
        userId
      );

    const fileBuffer =
      await file.arrayBuffer();

    const mimeType =
      file.type ||
      'application/octet-stream';

    const metadata = {
      name: file.name,
      parents: [parentId],
    };

    const multipartBody =
      new Blob(
        [
          `--gipe-drive-boundary\r\n`,
          `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
          JSON.stringify(metadata),
          `\r\n`,
          `--gipe-drive-boundary\r\n`,
          `Content-Type: ${mimeType}\r\n\r\n`,
          new Uint8Array(
            fileBuffer
          ),
          `\r\n`,
          `--gipe-drive-boundary--`,
        ],
        {
          type:
            'multipart/related; boundary=gipe-drive-boundary',
        }
      );

    const uploadResponse =
      await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,parents',
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            'Content-Type':
              'multipart/related; boundary=gipe-drive-boundary',
          },
          body: multipartBody,
          cache: 'no-store',
        }
      );

    const uploadData =
      (await uploadResponse.json()) as GoogleDriveUploadResponse;

    if (!uploadResponse.ok) {
      console.error(
        'Erreur upload Google Drive:',
        uploadData
      );

      return NextResponse.json(
        {
          error:
            uploadData?.error?.message ||
            'Impossible d’envoyer le fichier dans Google Drive.',
        },
        {
          status:
            uploadResponse.status || 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      file: {
        id: uploadData.id,
        name: uploadData.name,
        mimeType:
          uploadData.mimeType,
        size: uploadData.size,
        modifiedTime:
          uploadData.modifiedTime,
        webViewLink:
          uploadData.webViewLink,
        parents:
          uploadData.parents,
      },
    });
  } catch (error) {
    console.error(
      'Erreur API upload Google Drive:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’envoyer le fichier.',
      },
      { status: 500 }
    );
  }
}
