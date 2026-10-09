import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import { getGoogleAccessToken } from '@/lib/google-drive'

export async function GET(request: Request) {
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
            'L’identifiant du fichier est obligatoire.',
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
