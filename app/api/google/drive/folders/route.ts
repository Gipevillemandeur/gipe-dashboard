import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import {
  DRIVE_FOLDER_MIME,
  driveErrorResponse,
  getGoogleAccessToken,
  isValidDriveId,
  readGoogleError,
} from '@/lib/google-drive'

type GoogleDriveFolder = {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  parents?: string[]
  webViewLink?: string
}

/**
 * Récupération des sous-dossiers d'un dossier.
 */
export async function GET(request: Request) {
  try {
    await requireOfficePermission('drive')

    const parentId =
      new URL(request.url).searchParams.get('parentId') || 'root'

    if (!isValidDriveId(parentId)) {
      return NextResponse.json(
        { error: 'Identifiant de dossier invalide.' },
        { status: 400 }
      )
    }

    const accessToken = await getGoogleAccessToken()

    const url = new URL('https://www.googleapis.com/drive/v3/files')

    url.searchParams.set(
      'q',
      `'${parentId}' in parents and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`
    )
    url.searchParams.set('pageSize', '1000')
    url.searchParams.set('orderBy', 'name')
    url.searchParams.set(
      'fields',
      'files(id,name,mimeType,modifiedTime,parents,webViewLink)'
    )
    url.searchParams.set('supportsAllDrives', 'true')
    url.searchParams.set('includeItemsFromAllDrives', 'true')

    const driveResponse = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!driveResponse.ok) {
      const message = await readGoogleError(
        driveResponse,
        'Impossible de récupérer les dossiers du Google Drive.'
      )

      return NextResponse.json(
        { error: message },
        { status: driveResponse.status || 500 }
      )
    }

    const driveData = (await driveResponse.json()) as {
      files?: GoogleDriveFolder[]
    }

    return NextResponse.json({
      folders: driveData.files || [],
    })
  } catch (error) {
    return driveErrorResponse(
      error,
      'Impossible de récupérer les dossiers Google Drive.'
    )
  }
}

/**
 * Création d'un dossier.
 */
export async function POST(request: Request) {
  try {
    await requireOfficePermission('drive')

    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      parentId?: string
    }

    const name = body.name?.trim()
    const parentId = body.parentId?.trim() || 'root'

    if (!name) {
      return NextResponse.json(
        { error: 'Le nom du dossier est obligatoire.' },
        { status: 400 }
      )
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: 'Le nom du dossier est trop long.' },
        { status: 400 }
      )
    }

    if (!isValidDriveId(parentId)) {
      return NextResponse.json(
        { error: 'Identifiant de dossier invalide.' },
        { status: 400 }
      )
    }

    const accessToken = await getGoogleAccessToken()

    const driveResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,parents,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          mimeType: DRIVE_FOLDER_MIME,
          parents: [parentId],
        }),
        cache: 'no-store',
      }
    )

    if (!driveResponse.ok) {
      const message = await readGoogleError(
        driveResponse,
        'Impossible de créer le dossier dans Google Drive.'
      )

      return NextResponse.json(
        { error: message },
        { status: driveResponse.status || 500 }
      )
    }

    const folder = (await driveResponse.json()) as GoogleDriveFolder

    return NextResponse.json({
      success: true,
      folder,
    })
  } catch (error) {
    return driveErrorResponse(error, 'Impossible de créer le dossier Google Drive.')
  }
}
