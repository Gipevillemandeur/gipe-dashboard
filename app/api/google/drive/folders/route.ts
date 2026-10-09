import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import { getGoogleAccessToken } from '@/lib/google-drive'

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

export async function GET(request: Request) {
  try {
    await requireOfficePermission('drive')

    const accessToken =
      await getGoogleAccessToken()

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
