import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

const EXPORT_FORMATS: Record<
  string,
  {
    mimeType: string;
    extension: string;
  }
> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/pdf',
    extension: '.pdf',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: '.pptx',
  },
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

function cleanDownloadName(
  name: string
) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim() || 'document';
}

function addExtensionIfNeeded(
  name: string,
  extension: string
) {
  const lowerName =
    name.toLocaleLowerCase('fr-FR');

  if (
    lowerName.endsWith(
      extension.toLocaleLowerCase('fr-FR')
    )
  ) {
    return name;
  }

  return `${name}${extension}`;
}

export async function GET(request: Request) {
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

    const fileName =
      url.searchParams.get('name')?.trim() ||
      'document';

    const mimeType =
      url.searchParams.get('mimeType')?.trim() ||
      'application/octet-stream';

    if (!fileId) {
      return NextResponse.json(
        {
          error:
            'L’identifiant du fichier est obligatoire.',
        },
        { status: 400 }
      );
    }

    const accessToken =
      await getGoogleAccessToken(userId);

    const exportFormat =
      EXPORT_FORMATS[mimeType];

    let googleUrl: string;
    let downloadName =
      cleanDownloadName(fileName);

    if (exportFormat) {
      googleUrl =
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          fileId
        )}/export?mimeType=${encodeURIComponent(
          exportFormat.mimeType
        )}`;

      downloadName =
        addExtensionIfNeeded(
          downloadName,
          exportFormat.extension
        );
    } else {
      googleUrl =
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          fileId
        )}?alt=media&supportsAllDrives=true`;
    }

    const googleResponse = await fetch(
      googleUrl,
      {
        method: 'GET',
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );

    if (!googleResponse.ok) {
      const errorText =
        await googleResponse.text();

      console.error(
        'Erreur téléchargement Google Drive:',
        errorText
      );

      return NextResponse.json(
        {
          error:
            'Impossible de télécharger ce fichier depuis Google Drive.',
        },
        {
          status:
            googleResponse.status || 500,
        }
      );
    }

    const fileBlob =
      await googleResponse.blob();

    const responseHeaders =
      new Headers();

    responseHeaders.set(
      'Content-Type',
      exportFormat
        ? exportFormat.mimeType
        : googleResponse.headers.get(
            'content-type'
          ) ||
            'application/octet-stream'
    );

    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(
        downloadName
      )}"`
    );

    responseHeaders.set(
      'Cache-Control',
      'no-store'
    );

    return new NextResponse(
      fileBlob,
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error(
      'Erreur API téléchargement Google Drive:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de télécharger le fichier.',
      },
      { status: 500 }
    );
  }
}
