import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import { getGoogleAccessToken } from '@/lib/google-drive'

type GoogleDriveFile = {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
  parents?: string[]
}

type GoogleDriveResponse = {
  files?: GoogleDriveFile[]
  nextPageToken?: string
  error?: {
    message?: string
  }
}

export async function GET(
  request: Request
) {
  try {
    await requireOfficePermission('drive')

    const accessToken =
      await getGoogleAccessToken()

    const requestUrl =
      new URL(request.url)

    const folderId =
      requestUrl.searchParams.get(
        'folderId'
      ) || 'root'

    const url =
      new URL(
        'https://www.googleapis.com/drive/v3/files'
      )

    url.searchParams.set(
      'q',
      `'${folderId}' in parents and trashed = false`
    )

    url.searchParams.set(
      'pageSize',
      '100'
    )

    url.searchParams.set(
      'orderBy',
      'folder,name'
    )

    url.searchParams.set(
      'fields',
      'files(id,name,mimeType,size,modifiedTime,webViewLink,parents),nextPageToken'
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
            'Impossible de récupérer les fichiers du Google Drive.',
        },
        {
          status:
            driveResponse.status || 500,
        }
      )
    }

    return NextResponse.json({
      files:
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
      'Erreur API Google Drive:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de récupérer le Google Drive.',
      },
      { status: 500 }
    )
  }
}
