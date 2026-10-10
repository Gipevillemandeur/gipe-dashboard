import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import {
  driveErrorResponse,
  getGoogleAccessToken,
  isValidDriveId,
  readGoogleError,
} from '@/lib/google-drive'

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
}

// Garde-fou : au-delà, le dossier est vraiment énorme.
const MAX_PAGES = 20

/*
 * Contenu d'un dossier (dossiers + fichiers), en entier :
 * on enchaîne les pages de 1000 éléments renvoyées par Google.
 */
export async function GET(request: Request) {
  try {
    await requireOfficePermission('drive')

    const folderId =
      new URL(request.url).searchParams.get('folderId') || 'root'

    if (!isValidDriveId(folderId)) {
      return NextResponse.json(
        { error: 'Identifiant de dossier invalide.' },
        { status: 400 }
      )
    }

    const accessToken = await getGoogleAccessToken()

    const files: GoogleDriveFile[] = []
    let pageToken: string | undefined

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = new URL('https://www.googleapis.com/drive/v3/files')

      url.searchParams.set('q', `'${folderId}' in parents and trashed = false`)
      url.searchParams.set('pageSize', '1000')
      url.searchParams.set('orderBy', 'folder,name')
      url.searchParams.set(
        'fields',
        'files(id,name,mimeType,size,modifiedTime,webViewLink,parents),nextPageToken'
      )
      url.searchParams.set('supportsAllDrives', 'true')
      url.searchParams.set('includeItemsFromAllDrives', 'true')

      if (pageToken) {
        url.searchParams.set('pageToken', pageToken)
      }

      const driveResponse = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })

      if (!driveResponse.ok) {
        const message = await readGoogleError(
          driveResponse,
          'Impossible de récupérer les fichiers du Google Drive.'
        )

        console.error('Erreur Google Drive:', message)

        return NextResponse.json(
          { error: message },
          { status: driveResponse.status || 500 }
        )
      }

      const driveData = (await driveResponse.json()) as GoogleDriveResponse

      files.push(...(driveData.files || []))
      pageToken = driveData.nextPageToken

      if (!pageToken) break
    }

    return NextResponse.json({ files })
  } catch (error) {
    return driveErrorResponse(error, 'Impossible de récupérer le Google Drive.')
  }
}
