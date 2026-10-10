import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import {
  driveErrorResponse,
  getGoogleAccessToken,
  isValidDriveId,
  readGoogleError,
} from '@/lib/google-drive'

// Taille maximale acceptée pour un fichier (1 Go).
const MAX_FILE_SIZE = 1024 * 1024 * 1024

// Envoi « de secours » via le serveur : limité par Vercel (~4,5 Mo).
const MAX_SERVER_UPLOAD_SIZE = 4 * 1024 * 1024

const FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,webViewLink,parents'

/*
 * Import d'un fichier dans le Drive.
 *
 * 1) Méthode normale (JSON { action: 'prepare' }) :
 *    le serveur ouvre une « session d'envoi » chez Google et renvoie
 *    son adresse ; le navigateur envoie ensuite le fichier
 *    DIRECTEMENT à Google. Aucune limite de taille Vercel.
 *
 * 2) Méthode de secours (formulaire avec le fichier) :
 *    le fichier passe par le serveur. Petits fichiers seulement.
 */
export async function POST(request: Request) {
  try {
    await requireOfficePermission('drive')

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return prepareDirectUpload(request)
    }

    return serverUpload(request)
  } catch (error) {
    return driveErrorResponse(error, 'Impossible d’envoyer le fichier.')
  }
}

async function prepareDirectUpload(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    name?: string
    mimeType?: string
    size?: number
    parentId?: string
  }

  const name = body.name?.trim()
  const mimeType = body.mimeType?.trim() || 'application/octet-stream'
  const size = Number(body.size)
  const parentId = body.parentId?.trim() || 'root'

  if (body.action !== 'prepare' || !name) {
    return NextResponse.json({ error: 'Demande invalide.' }, { status: 400 })
  }

  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Le fichier est vide.' }, { status: 400 })
  }

  if (size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Le fichier dépasse 1 Go.' },
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
  const origin = new URL(request.url).origin

  const sessionResponse = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=${FILE_FIELDS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(size),
        // Autorise le navigateur (ce site) à envoyer le fichier à Google.
        Origin: origin,
      },
      body: JSON.stringify({
        name,
        parents: [parentId],
      }),
      cache: 'no-store',
    }
  )

  const uploadUrl = sessionResponse.headers.get('location')

  if (!sessionResponse.ok || !uploadUrl) {
    const message = await readGoogleError(
      sessionResponse,
      'Impossible de préparer l’envoi vers Google Drive.'
    )

    console.error('Erreur session upload Google Drive:', message)

    return NextResponse.json(
      { error: message },
      { status: sessionResponse.status || 500 }
    )
  }

  return NextResponse.json({ uploadUrl })
}

async function serverUpload(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  const parentIdValue = formData.get('parentId')

  const parentId =
    typeof parentIdValue === 'string' && parentIdValue.trim()
      ? parentIdValue.trim()
      : 'root'

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Aucun fichier n’a été fourni.' },
      { status: 400 }
    )
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'Le fichier est vide.' }, { status: 400 })
  }

  if (file.size > MAX_SERVER_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: 'Fichier trop volumineux pour cet envoi.' },
      { status: 413 }
    )
  }

  if (!isValidDriveId(parentId)) {
    return NextResponse.json(
      { error: 'Identifiant de dossier invalide.' },
      { status: 400 }
    )
  }

  const accessToken = await getGoogleAccessToken()
  const mimeType = file.type || 'application/octet-stream'

  const multipartBody = new Blob(
    [
      `--gipe-drive-boundary\r\n`,
      `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify({ name: file.name, parents: [parentId] }),
      `\r\n`,
      `--gipe-drive-boundary\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
      new Uint8Array(await file.arrayBuffer()),
      `\r\n`,
      `--gipe-drive-boundary--`,
    ],
    { type: 'multipart/related; boundary=gipe-drive-boundary' }
  )

  const uploadResponse = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${FILE_FIELDS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/related; boundary=gipe-drive-boundary',
      },
      body: multipartBody,
      cache: 'no-store',
    }
  )

  if (!uploadResponse.ok) {
    const message = await readGoogleError(
      uploadResponse,
      'Impossible d’envoyer le fichier dans Google Drive.'
    )

    console.error('Erreur upload Google Drive:', message)

    return NextResponse.json(
      { error: message },
      { status: uploadResponse.status || 500 }
    )
  }

  return NextResponse.json({
    success: true,
    file: await uploadResponse.json(),
  })
}
