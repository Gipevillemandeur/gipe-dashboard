import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

type GoogleDriveFolder = {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  parents?: string[]
  webViewLink?: string
}

type GoogleDriveResponse = {
  files?: GoogleDriveFolder[]
  nextPageToken?: string
  error?: {
    message?: string
  }
}

async function getGoogleAccessToken(userId: string) {
  const adminClient = createAdminClient()

  const { data: connection, error } =
    await adminClient
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

    const accessToken =
      await getGoogleAccessToken(
        access.userId
      )

    const requestUrl =
      new URL(request.url)

    const parentId =
      requestUrl.searchParams.get(
        'parentId'
      ) || 'root'

    const url =
      new URL(
        'https://www.googleapis.com/drive/v3/files'
      )

    url.searchParams.set(
      'q',
      `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    )

    url.searchParams.set(
      'pageSize',
      '100'
    )

    url.searchParams.set(
      'orderBy',
      'name'
    )

    url.searchParams.set(
      'fields',
      'files(id,name,mimeType,modifiedTime,parents,webViewLink),nextPageToken'
    )

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
      )

    const driveData =
      (await driveResponse.json()) as GoogleDriveResponse

    if (!driveResponse.ok) {
      console.error(
        'Erreur Google Drive:',
        driveData
      )

      return NextResponse.json(
        {
          error:
            driveData?.error?.message ||
            'Impossible de récupérer les dossiers du Google Drive.',
        },
        {
          status:
            driveResponse.status || 500,
        }
      )
    }

    return NextResponse.json({
      folders:
        driveData.files || [],
    })
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
      'Erreur API dossiers Google Drive:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de récupérer les dossiers Google Drive.',
      },
      { status: 500 }
    )
  }
}
