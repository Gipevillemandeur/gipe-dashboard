import { NextResponse } from 'next/server'
import { logActivity, quote } from '@/lib/activity'
import { requireOfficePermission } from '@/lib/office-auth'
import {
  driveErrorResponse,
  getGoogleAccessToken,
  isValidDriveId,
  readGoogleError,
} from '@/lib/google-drive'

/*
 * « Suppression » d'un fichier ou d'un dossier :
 * il est placé dans la CORBEILLE Google Drive
 * (récupérable pendant 30 jours), jamais effacé
 * définitivement.
 */
export async function DELETE(request: Request) {
  try {
    await requireOfficePermission('drive')

    const fileId = new URL(request.url).searchParams.get('id')?.trim()

    if (!isValidDriveId(fileId) || fileId === 'root') {
      return NextResponse.json(
        { error: 'Identifiant du fichier ou du dossier invalide.' },
        { status: 400 }
      )
    }

    const accessToken = await getGoogleAccessToken()

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}?supportsAllDrives=true&fields=id,name,mimeType,trashed`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
        cache: 'no-store',
      }
    )

    if (!driveResponse.ok) {
      const message = await readGoogleError(
        driveResponse,
        'Impossible de placer cet élément dans la corbeille.'
      )

      console.error('Erreur mise à la corbeille Google Drive:', message)

      return NextResponse.json(
        { error: message },
        { status: driveResponse.status || 500 }
      )
    }

    const trashed = (await driveResponse.json().catch(() => ({}))) as {
      name?: string
      mimeType?: string
    }

    await logActivity(
      'Docs Drive',
      `a mis à la corbeille ${trashed.mimeType === 'application/vnd.google-apps.folder' ? 'le dossier' : 'le fichier'} ${quote(trashed.name)}`
    )

    return NextResponse.json({
      success: true,
      id: fileId,
    })
  } catch (error) {
    return driveErrorResponse(error, 'Impossible de supprimer cet élément.')
  }
}
