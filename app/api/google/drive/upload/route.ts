import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import { getGoogleAccessToken } from '@/lib/google-drive'

type GoogleDriveUploadResponse = {
  id?: string
  name?: string
  mimeType?: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
  parents?: string[]
  error?: {
    message?: string
  }
}

export async function POST(
  request: Request
) {
  try {
    await requireOfficePermission('drive')

    const formData =
      await request.formData()

    const file =
      formData.get('file')

    const parentIdValue =
      formData.get('parentId')

    const parentId =
      typeof parentIdValue === 'string' &&
      parentIdValue.trim()
        ? parentIdValue.trim()
        : 'root'

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            'Aucun fichier n’a été fourni.',
        },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          error:
            'Le fichier est vide.',
        },
        { status: 400 }
      )
    }

    const accessToken =
      await getGoogleAccessToken()

    const fileBuffer =
      await file.arrayBuffer()

    const mimeType =
      file.type ||
      'application/octet-stream'

    const metadata = {
      name: file.name,
      parents: [parentId],
    }

    const multipartBody =
      new Blob(
        [
          `--gipe-drive-boundary\r\n`,
          `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
          JSON.stringify(metadata),
          `\r\n`,
          `--gipe-drive-boundary\r\n`,
          `Content-Type: ${mimeType}\r\n\r\n`,
          new Uint8Array(fileBuffer),
          `\r\n`,
          `--gipe-drive-boundary--`,
        ],
        {
          type:
            'multipart/related; boundary=gipe-drive-boundary',
        }
      )

    const uploadResponse =
      await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,parents',
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            'Content-Type':
              'multipart/related; boundary=gipe-drive-boundary',
          },
          body: multipartBody,
          cache: 'no-store',
        }
      )

    const uploadData =
      (await uploadResponse.json()) as GoogleDriveUploadResponse

    if (!uploadResponse.ok) {
      console.error(
        'Erreur upload Google Drive:',
        uploadData
      )

      return NextResponse.json(
        {
          error:
            uploadData?.error?.message ||
            'Impossible d’envoyer le fichier dans Google Drive.',
        },
        {
          status:
            uploadResponse.status || 500,
        }
      )
    }

    return NextResponse.json({
      success: true,
      file: {
        id: uploadData.id,
        name: uploadData.name,
        mimeType:
          uploadData.mimeType,
        size: uploadData.size,
        modifiedTime:
          uploadData.modifiedTime,
        webViewLink:
          uploadData.webViewLink,
        parents:
          uploadData.parents,
      },
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
      'Erreur API upload Google Drive:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’envoyer le fichier.',
      },
      { status: 500 }
    )
  }
}
