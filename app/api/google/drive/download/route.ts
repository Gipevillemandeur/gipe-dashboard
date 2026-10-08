import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

async function getGoogleAccessToken(userId: string) {
  const admin = createAdminClient()

  const { data: connection, error } = await admin
    .from('google_drive_connections')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(
      'Impossible de récupérer la connexion Google Drive.'
    )
  }

  if (!connection?.refresh_token) {
    throw new Error(
      'Google Drive n’est pas connecté.'
    )
  }

  const clientId =
    process.env.GOOGLE_CLIENT_ID

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'La configuration Google OAuth est incomplète.'
    )
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
  )

  const tokenData =
    (await tokenResponse.json()) as GoogleTokenResponse

  if (
    !tokenResponse.ok ||
    !tokenData.access_token
  ) {
    console.error(
      'Erreur renouvellement token Google:',
      tokenData
    )

    throw new Error(
      'Impossible d’obtenir un accès au Google Drive.'
    )
  }

  return tokenData.access_token
}

export async function GET(request: Request) {
  try {
    const access =
      await requireOfficePermission('drive')

    if (!access.userId) {
      return NextResponse.json(
        {
          error:
            'Utilisateur non identifié.',
        },
        { status: 401 }
      )
    }

    const url =
      new URL(request.url)

    const fileId =
      url.searchParams
        .get('id')
        ?.trim()

    if (!fileId) {
      return NextResponse.json(
        {
          error:
            'L’identifiant du fichier est obligatoire.',
        },
        { status: 400 }
      )
    }

    const accessToken =
      await getGoogleAccessToken(
        access.userId
      )

    const driveResponse =
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          fileId
        )}?alt=media&supportsAllDrives=true`,
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }
      )

    if (!driveResponse.ok) {
      const errorText =
        await driveResponse.text()

      console.error(
        'Erreur téléchargement Google Drive:',
        errorText
      )

      return NextResponse.json(
        {
          error:
            'Impossible de télécharger le fichier depuis Google Drive.',
        },
        {
          status:
            driveResponse.status || 500,
        }
      )
    }

    const contentType =
      driveResponse.headers.get(
        'content-type'
      ) ||
      'application/octet-stream'

    const contentDisposition =
      driveResponse.headers.get(
        'content-disposition'
      )

    const headers =
      new Headers()

    headers.set(
      'Content-Type',
      contentType
    )

    if (contentDisposition) {
      headers.set(
        'Content-Disposition',
        contentDisposition
      )
    }

    return new NextResponse(
      driveResponse.body,
      {
        status: 200,
        headers,
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        'AUTHENTICATION_REQUIRED'
      ) {
        return NextResponse.json(
          {
            error:
              'Non authentifié.',
          },
          { status: 401 }
        )
      }

      if (
        error.message ===
          'OFFICE_ACCESS_DENIED' ||
        error.message ===
          'OFFICE_PERMISSION_DENIED'
      ) {
        return NextResponse.json(
          {
            error:
              'Compte non autorisé.',
          },
          { status: 403 }
        )
      }
    }

    console.error(
      'Erreur API téléchargement Google Drive:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de télécharger le fichier.',
      },
      { status: 500 }
    )
  }
}
