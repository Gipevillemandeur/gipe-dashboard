import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import {
  GOOGLE_EXPORTS,
  driveErrorResponse,
  getGoogleAccessToken,
  isValidDriveId,
} from '@/lib/google-drive'

type DriveMetadata = {
  id?: string
  name?: string
  mimeType?: string
}

/*
 * Nom de fichier pour le navigateur : version simple
 * (sans accents) + version complète (avec accents).
 */
function contentDisposition(fileName: string) {
  const ascii = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(
    fileName
  )}`
}

function errorPage(message: string, status: number) {
  // Lien ouvert directement par le navigateur : petite page lisible.
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Téléchargement impossible</title>` +
      `<body style="font-family:system-ui,sans-serif;padding:32px;color:#241c1b">` +
      `<h1 style="font-size:20px">Téléchargement impossible</h1>` +
      `<p>${message.replace(/[<>&]/g, '')}</p>` +
      `<p><a href="/documents" style="color:#8f211c">Retour aux documents</a></p></body>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  )
}

/*
 * Téléchargement d'un fichier du Drive.
 * - fichier classique (PDF, image…) : tel quel ;
 * - Google Docs / Sheets / Slides : converti en Word / Excel / PowerPoint ;
 * - Google Dessin : converti en PDF.
 */
export async function GET(request: Request) {
  try {
    await requireOfficePermission('drive')

    const fileId = new URL(request.url).searchParams.get('id')?.trim()

    if (!isValidDriveId(fileId) || fileId === 'root') {
      return errorPage('Identifiant du fichier invalide.', 400)
    }

    const accessToken = await getGoogleAccessToken()
    const headers = { Authorization: `Bearer ${accessToken}` }
    const encodedId = encodeURIComponent(fileId)

    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodedId}?supportsAllDrives=true&fields=id,name,mimeType`,
      { headers, cache: 'no-store' }
    )

    if (!metaResponse.ok) {
      return errorPage(
        'Fichier introuvable dans Google Drive.',
        metaResponse.status || 500
      )
    }

    const meta = (await metaResponse.json()) as DriveMetadata
    const mimeType = meta.mimeType || 'application/octet-stream'
    let fileName = meta.name || 'fichier'
    let downloadUrl: string
    let contentType = mimeType

    if (mimeType.startsWith('application/vnd.google-apps.')) {
      const exportFormat = GOOGLE_EXPORTS[mimeType]

      if (!exportFormat) {
        return errorPage(
          'Ce type de fichier Google (formulaire, site, raccourci…) ne peut pas être téléchargé. Ouvre-le directement dans Google Drive.',
          400
        )
      }

      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodedId}/export?mimeType=${encodeURIComponent(
        exportFormat.mimeType
      )}`
      contentType = exportFormat.mimeType

      if (!fileName.toLowerCase().endsWith(`.${exportFormat.extension}`)) {
        fileName = `${fileName}.${exportFormat.extension}`
      }
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodedId}?alt=media&supportsAllDrives=true`
    }

    const driveResponse = await fetch(downloadUrl, {
      headers,
      cache: 'no-store',
    })

    if (!driveResponse.ok || !driveResponse.body) {
      const errorText = await driveResponse.text().catch(() => '')
      console.error('Erreur téléchargement Google Drive:', errorText)

      return errorPage(
        driveResponse.status === 403
          ? 'Google refuse ce téléchargement (fichier trop volumineux pour être converti, ou accès refusé). Ouvre-le directement dans Google Drive.'
          : 'Impossible de télécharger le fichier depuis Google Drive.',
        driveResponse.status || 500
      )
    }

    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Content-Disposition', contentDisposition(fileName))
    responseHeaders.set('Cache-Control', 'no-store')

    const length = driveResponse.headers.get('content-length')
    if (length) responseHeaders.set('Content-Length', length)

    return new NextResponse(driveResponse.body, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error) {
    const response = driveErrorResponse(
      error,
      'Impossible de télécharger le fichier.'
    )
    const data = (await response.json().catch(() => ({}))) as { error?: string }

    return errorPage(
      data.error || 'Impossible de télécharger le fichier.',
      response.status
    )
  }
}
