import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import { getGoogleAccessToken } from '@/lib/google-drive'

type GoogleDriveErrorResponse = {
  error?: {
    message?: string
  }
}

export async function DELETE(request: Request) {
  try {
    await requireOfficePermission('drive')

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
            'L’identifiant du fichier ou du dossier est obligatoire.',
        },
        { status: 400 }
      )
    }

    const accessToken =
      await getGoogleAccessToken()

    const driveResponse =
      await fetch(
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
      )

    if (!driveResponse.ok) {
      const driveData =
        (await driveResponse.json()) as GoogleDriveErrorResponse

      console.error(
        'Erreur suppression Google Drive:',
        driveData
      )

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
      )
    }

    return NextResponse.json({
      success: true,
      id: fileId,
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
      'Erreur API suppression Google Drive:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer cet élément.',
      },
      { status: 500 }
    )
  }
}
