import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'

const MAX_FILE_SIZE = 8 * 1024 * 1024

async function requireWebsiteAccess() {
  try {
    await requireOfficePermission('website')
    return { admin: createAdminClient() }
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
      'Erreur contrôle accès agenda du site:',
      error
    )

    return {
      error: NextResponse.json(
        {
          error:
            'Erreur de contrôle des accès.',
        },
        { status: 500 }
      ),
    }
  }
}

function cleanString(value: unknown) {
  return String(value ?? '').trim()
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime())
}

function validTime(value: string) {
  if (!value) {
    return true
  }

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function getExtension(fileName: string) {
  return (
    fileName
      .split('.')
      .pop()
      ?.toLowerCase() || 'bin'
  )
}

async function uploadImage(
  admin: ReturnType<typeof createAdminClient>,
  file: File
) {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      'Le fichier doit être une image.'
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'L’image ne doit pas dépasser 8 Mo.'
    )
  }

  const extension =
    getExtension(file.name)

  const path =
    `site-agenda/${crypto.randomUUID()}.${extension}`

  const bytes =
    await file.arrayBuffer()

  const { error } =
    await admin.storage
      .from('images')
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
      })

  if (error) {
    throw new Error(
      `Impossible d’envoyer l’image : ${error.message}`
    )
  }

  const { data } =
    admin.storage
      .from('images')
      .getPublicUrl(path)

  return data.publicUrl
}

async function deleteSupabaseImage(
  admin: ReturnType<typeof createAdminClient>,
  imageUrl: string | null | undefined
) {
  if (
    !imageUrl ||
    !imageUrl.includes(
      '/storage/v1/object/public/images/'
    )
  ) {
    return
  }

  const marker =
    '/storage/v1/object/public/images/'

  const index =
    imageUrl.indexOf(marker)

  if (index === -1) {
    return
  }

  const path =
    decodeURIComponent(
      imageUrl.slice(
        index + marker.length
      )
    )

  if (!path) {
    return
  }

  await admin.storage
    .from('images')
    .remove([path])
}

export async function GET() {
  const auth =
    await requireWebsiteAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  const { data, error } =
    await admin
      .from('public_agenda_events')
      .select(
        'id,title,description,event_date,start_time,end_time,location,category,image_url'
      )
      .order('event_date', {
        ascending: true,
      })
      .order('start_time', {
        ascending: true,
      })
      .order('id', {
        ascending: true,
      })

  if (error) {
    return NextResponse.json(
      {
        error:
          `Impossible de charger l’agenda : ${error.message}`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    events: data || [],
  })
}

export async function POST(
  request: Request
) {
  const auth =
    await requireWebsiteAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const formData =
      await request.formData()

    const title =
      cleanString(
        formData.get('title')
      )

    const description =
      cleanString(
        formData.get('description')
      )

    const date =
      cleanString(
        formData.get('date')
      )

    const time =
      cleanString(
        formData.get('time')
      )

    const endTime =
      cleanString(
        formData.get('endTime')
      )

    const location =
      cleanString(
        formData.get('location')
      )

    const category =
      cleanString(
        formData.get('category')
      )

    const imageFile =
      formData.get('imageFile')

    if (!title) {
      return NextResponse.json(
        {
          error:
            'Le titre est obligatoire.',
        },
        { status: 400 }
      )
    }

    if (!date || !validDate(date)) {
      return NextResponse.json(
        {
          error:
            'La date est invalide.',
        },
        { status: 400 }
      )
    }

    if (!validTime(time)) {
      return NextResponse.json(
        {
          error:
            'L’heure de début est invalide.',
        },
        { status: 400 }
      )
    }

    if (!validTime(endTime)) {
      return NextResponse.json(
        {
          error:
            'L’heure de fin est invalide.',
        },
        { status: 400 }
      )
    }

    let imageUrl: string | null =
      null

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      imageUrl =
        await uploadImage(
          admin,
          imageFile
        )
    }

    const { data, error } =
      await admin
        .from('public_agenda_events')
        .insert({
          title,
          description:
            description || null,
          event_date: date,
          start_time:
            time || null,
          end_time:
            endTime || null,
          location:
            location || null,
          category:
            category || null,
          image_url:
            imageUrl,
        })
        .select(
          'id,title,description,event_date,start_time,end_time,location,category,image_url'
        )
        .single()

    if (error) {
      if (imageUrl) {
        await deleteSupabaseImage(
          admin,
          imageUrl
        )
      }

      return NextResponse.json(
        {
          error:
            `Impossible d’ajouter l’événement : ${error.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        event: data,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’ajouter l’événement.',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request
) {
  const auth =
    await requireWebsiteAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const formData =
      await request.formData()

    const id =
      cleanString(
        formData.get('id')
      )

    const title =
      cleanString(
        formData.get('title')
      )

    const description =
      cleanString(
        formData.get('description')
      )

    const date =
      cleanString(
        formData.get('date')
      )

    const time =
      cleanString(
        formData.get('time')
      )

    const endTime =
      cleanString(
        formData.get('endTime')
      )

    const location =
      cleanString(
        formData.get('location')
      )

    const category =
      cleanString(
        formData.get('category')
      )

    const keepImage =
      formData.get('keepImage') ===
      'true'

    const imageFile =
      formData.get('imageFile')

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Événement introuvable.',
        },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        {
          error:
            'Le titre est obligatoire.',
        },
        { status: 400 }
      )
    }

    if (!date || !validDate(date)) {
      return NextResponse.json(
        {
          error:
            'La date est invalide.',
        },
        { status: 400 }
      )
    }

    if (!validTime(time)) {
      return NextResponse.json(
        {
          error:
            'L’heure de début est invalide.',
        },
        { status: 400 }
      )
    }

    if (!validTime(endTime)) {
      return NextResponse.json(
        {
          error:
            'L’heure de fin est invalide.',
        },
        { status: 400 }
      )
    }

    const {
      data: existing,
      error: existingError,
    } =
      await admin
        .from('public_agenda_events')
        .select(
          'id,image_url'
        )
        .eq('id', id)
        .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        { status: 500 }
      )
    }

    if (!existing) {
      return NextResponse.json(
        {
          error:
            'Événement introuvable.',
        },
        { status: 404 }
      )
    }

    let imageUrl =
      keepImage
        ? existing.image_url ||
          null
        : null

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      imageUrl =
        await uploadImage(
          admin,
          imageFile
        )
    }

    const {
      data,
      error,
    } =
      await admin
        .from('public_agenda_events')
        .update({
          title,
          description:
            description || null,
          event_date: date,
          start_time:
            time || null,
          end_time:
            endTime || null,
          location:
            location || null,
          category:
            category || null,
          image_url:
            imageUrl,
        })
        .eq('id', id)
        .select(
          'id,title,description,event_date,start_time,end_time,location,category,image_url'
        )
        .single()

    if (error) {
      if (
        imageUrl &&
        imageUrl !==
          existing.image_url
      ) {
        await deleteSupabaseImage(
          admin,
          imageUrl
        )
      }

      return NextResponse.json(
        {
          error:
            `Impossible de modifier l’événement : ${error.message}`,
        },
        { status: 500 }
      )
    }

    if (
      existing.image_url &&
      existing.image_url !==
        imageUrl
    ) {
      await deleteSupabaseImage(
        admin,
        existing.image_url
      )
    }

    return NextResponse.json({
      ok: true,
      event: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de modifier l’événement.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request
) {
  const auth =
    await requireWebsiteAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body =
      (await request.json().catch(
        () => null
      )) as {
        id?: string
      } | null

    const id =
      cleanString(body?.id)

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Événement introuvable.',
        },
        { status: 400 }
      )
    }

    const {
      data: existing,
      error: existingError,
    } =
      await admin
        .from('public_agenda_events')
        .select(
          'id,image_url'
        )
        .eq('id', id)
        .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        { status: 500 }
      )
    }

    if (!existing) {
      return NextResponse.json(
        {
          error:
            'Événement introuvable.',
        },
        { status: 404 }
      )
    }

    const { error } =
      await admin
        .from('public_agenda_events')
        .delete()
        .eq('id', id)

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de supprimer l’événement : ${error.message}`,
        },
        { status: 500 }
      )
    }

    await deleteSupabaseImage(
      admin,
      existing.image_url
    )

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer l’événement.',
      },
      { status: 500 }
    )
  }
}
