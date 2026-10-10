import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'
import { requireEditableMeeting } from '@/lib/instance-guard'

const BUCKET = 'instance-documents'
const MAX_FILE_SIZE = 50 * 1024 * 1024

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

async function requireSchoolingAccess() {
  try {
    const access = await requireOfficePermission('schooling')

    return {
      admin: createAdminClient(),
      access,
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'AUTHENTICATION_REQUIRED') {
        return {
          error: NextResponse.json(
            { error: 'Non authentifié.' },
            { status: 401 }
          ),
        }
      }

      if (
        error.message === 'OFFICE_ACCESS_DENIED' ||
        error.message === 'OFFICE_PERMISSION_DENIED'
      ) {
        return {
          error: NextResponse.json(
            { error: 'Compte non autorisé.' },
            { status: 403 }
          ),
        }
      }
    }

    console.error(
      'Erreur contrôle accès Scolarité :',
      error
    )

    return {
      error: NextResponse.json(
        { error: 'Erreur de contrôle des accès.' },
        { status: 500 }
      ),
    }
  }
}

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)
}

function formatDocumentName(name: string) {
  const cleaned =
    sanitizeFileName(name)

  return (
    cleaned ||
    `document-${crypto.randomUUID()}`
  )
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const auth =
    await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { id } = await params

  const {
    data: meeting,
    error: meetingError,
  } =
    await auth.admin
      .from('instance_meetings')
      .select('id')
      .eq('id', id)
      .maybeSingle()

  if (meetingError) {
    return NextResponse.json(
      {
        error:
          `Impossible de vérifier la réunion : ${meetingError.message}`,
      },
      { status: 500 }
    )
  }

  if (!meeting) {
    return NextResponse.json(
      {
        error:
          'Réunion introuvable.',
      },
      { status: 404 }
    )
  }

  const {
    data: documents,
    error,
  } =
    await auth.admin
      .from(
        'instance_meeting_documents'
      )
      .select(
        'id,meeting_id,file_name,file_url,file_type,file_size,created_at,updated_at'
      )
      .eq(
        'meeting_id',
        id
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )

  if (error) {
    return NextResponse.json(
      {
        error:
          `Impossible de charger les documents : ${error.message}`,
      },
      { status: 500 }
    )
  }

  const documentsWithUrls =
    await Promise.all(
      (documents || []).map(
        async (document) => {
          const {
            data: signedData,
            error: signedError,
          } =
            await auth.admin.storage
              .from(BUCKET)
              .createSignedUrl(
                document.file_url,
                3600
              )

          return {
            ...document,
            download_url:
              signedError
                ? null
                : signedData?.signedUrl ||
                  null,
          }
        }
      )
    )

  return NextResponse.json({
    documents:
      documentsWithUrls,
  })
}

/*
 * AJOUT D'UN DOCUMENT — en deux temps, pour que le fichier
 * aille DIRECTEMENT du navigateur au stockage (sans passer
 * par Vercel, limité à ~4,5 Mo par envoi) :
 *
 * 1. { action: 'prepare', fileName, fileSize, fileType }
 *    → autorisation d'envoi temporaire (path + token)
 * 2. le navigateur envoie le fichier au stockage
 * 3. { action: 'confirm', path, fileName, fileSize, fileType }
 *    → le document est enregistré
 */
export async function POST(
  request: Request,
  { params }: RouteContext
) {
  const auth = await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  try {
    const { id } = await params

    const guard = await requireEditableMeeting(auth.admin, id)

    if ('error' in guard) {
      return guard.error
    }

    const body = (await request.json().catch(() => null)) as {
      action?: unknown
      path?: unknown
      fileName?: unknown
      fileSize?: unknown
      fileType?: unknown
    } | null

    const action = String(body?.action || '')
    const fileName = String(body?.fileName || '').trim() || 'document'
    const fileSize = Number(body?.fileSize || 0)
    const fileType = String(body?.fileType || '') || 'application/octet-stream'

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: 'Le fichier est vide.' }, { status: 400 })
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Le fichier dépasse la limite de 50 Mo.' },
        { status: 400 }
      )
    }

    if (action === 'prepare') {
      const storagePath = `${id}/${crypto.randomUUID()}-${formatDocumentName(fileName)}`

      const { data, error } = await auth.admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath)

      if (error || !data) {
        return NextResponse.json(
          {
            error: `Impossible de préparer l’envoi : ${error?.message || 'erreur inconnue'}`,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        path: data.path,
        token: data.token,
      })
    }

    if (action !== 'confirm') {
      return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
    }

    const storagePath = String(body?.path || '')

    // Le chemin doit appartenir à cette réunion.
    if (!storagePath.startsWith(`${id}/`) || storagePath.includes('..')) {
      return NextResponse.json({ error: 'Chemin de fichier invalide.' }, { status: 400 })
    }

    // Le fichier doit bien être arrivé dans le stockage.
    const { data: signedData, error: signedError } = await auth.admin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600)

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: 'Le fichier n’est pas arrivé dans le stockage. Réessaie l’envoi.' },
        { status: 400 }
      )
    }

    const { data: document, error: insertError } = await auth.admin
      .from('instance_meeting_documents')
      .insert({
        meeting_id: id,
        file_name: fileName,
        file_url: storagePath,
        file_type: fileType,
        file_size: fileSize,
      })
      .select(
        'id,meeting_id,file_name,file_url,file_type,file_size,created_at,updated_at'
      )
      .single()

    if (insertError) {
      await auth.admin.storage.from(BUCKET).remove([storagePath])

      return NextResponse.json(
        { error: `Impossible d’enregistrer le document : ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      document: {
        ...document,
        download_url: signedData.signedUrl,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’ajouter le document.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  const auth =
    await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  try {
    const { id } =
      await params

    const guard = await requireEditableMeeting(auth.admin, id)

    if ('error' in guard) {
      return guard.error
    }

    const body =
      (await request.json()) as {
        documentId?: unknown
      }

    const documentId =
      String(
        body.documentId ||
          ''
      ).trim()

    if (!documentId) {
      return NextResponse.json(
        {
          error:
            'Document non précisé.',
        },
        { status: 400 }
      )
    }

    const {
      data: document,
      error: documentError,
    } =
      await auth.admin
        .from(
          'instance_meeting_documents'
        )
        .select(
          'id,meeting_id,file_url'
        )
        .eq(
          'id',
          documentId
        )
        .eq(
          'meeting_id',
          id
        )
        .maybeSingle()

    if (documentError) {
      return NextResponse.json(
        {
          error:
            `Impossible de charger le document : ${documentError.message}`,
        },
        { status: 500 }
      )
    }

    if (!document) {
      return NextResponse.json(
        {
          error:
            'Document introuvable.',
        },
        { status: 404 }
      )
    }

    const {
      error: storageError,
    } =
      await auth.admin.storage
        .from(BUCKET)
        .remove([
          document.file_url,
        ])

    if (storageError) {
      return NextResponse.json(
        {
          error:
            `Impossible de supprimer le fichier : ${storageError.message}`,
        },
        { status: 500 }
      )
    }

    const {
      error: deleteError,
    } =
      await auth.admin
        .from(
          'instance_meeting_documents'
        )
        .delete()
        .eq(
          'id',
          documentId
        )
        .eq(
          'meeting_id',
          id
        )

    if (deleteError) {
      return NextResponse.json(
        {
          error:
            `Impossible de supprimer le document : ${deleteError.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer le document.',
      },
      { status: 500 }
    )
  }
}
