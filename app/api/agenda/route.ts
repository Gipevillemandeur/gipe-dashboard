import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_FILE_SIZE = 8 * 1024 * 1024

async function requireAdmin() {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      ),
    }
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return {
      error: NextResponse.json(
        {
          error:
            'Impossible de vérifier les droits administrateur.',
        },
        { status: 500 }
      ),
    }
  }

  if (!data) {
    return {
      error: NextResponse.json(
        { error: 'Compte non autorisé.' },
        { status: 403 }
      ),
    }
  }

  return { admin }
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
  if (!value) return true

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function getExtension(fileName: string) {
  const extension = fileName
    .split('.')
    .pop()
    ?.toLowerCase()

  return extension || 'bin'
}

async function uploadImage(
  admin: ReturnType<typeof createAdminClient>,
  file: File
) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier doit être une image.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("L’image ne doit pas dépasser 8 Mo.")
  }

  const extension = getExtension(file.name)

  const filePath = `internal-agenda/${crypto.randomUUID()}.${extension}`

  const bytes = await file.arrayBuffer()

  const { error } = await admin.storage
    .from('images')
    .upload(filePath, bytes, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(
      `Impossible d’envoyer l’image : ${error.message}`
    )
  }

  const { data } = admin.storage
    .from('images')
    .getPublicUrl(filePath)

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

  const index = imageUrl.indexOf(marker)

  if (index === -1) {
    return
  }

  const path = decodeURIComponent(
    imageUrl.slice(index + marker.length)
  )

  if (!path) {
    return
  }

  await admin.storage
    .from('images')
    .remove([path])
}

function validateEventInput(values: {
  title: string
  description: string
  date: string
  time: string
  location: string
  category: string
}) {
  if (!values.title) {
    return "Le titre est obligatoire."
  }

  if (values.title.length > 200) {
    return "Le titre est trop long."
  }

  if (!validDate(values.date)) {
    return "La date est invalide."
  }

  if (!validTime(values.time)) {
    return "L’heure est invalide."
  }

  if (values.description.length > 5000) {
    return "La description est trop longue."
  }

  if (values.location.length > 200) {
    return "Le lieu est trop long."
  }

  if (values.category.length > 100) {
    return "La catégorie est trop longue."
  }

  return null
}

export async function GET() {
  const auth = await requireAdmin()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  const { data: schoolYear, error: schoolYearError } =
    await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle()

  if (schoolYearError) {
    return NextResponse.json(
      {
        error:
          `Impossible de charger l'année active : ${schoolYearError.message}`,
      },
      { status: 500 }
    )
  }

  if (!schoolYear) {
    return NextResponse.json({
      events: [],
      schoolYear: null,
    })
  }

  const { data, error } = await admin
    .from('internal_agenda_events')
    .select(
      'id,school_year_id,title,description,event_date,start_time,end_time,location,image_url,category,published_on_site,site_event_id,created_at,updated_at'
    )
    .eq('school_year_id', schoolYear.id)
    .order('event_date', {
      ascending: true,
    })
    .order('start_time', {
      ascending: true,
      nullsFirst: false,
    })
    .order('id', {
      ascending: true,
    })

  if (error) {
    return NextResponse.json(
      {
        error:
          `Impossible de charger les événements : ${error.message}`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    events: data || [],
    schoolYear,
  })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const formData = await request.formData()

    const title = cleanString(
      formData.get('title')
    )

    const description = cleanString(
      formData.get('description')
    )

    const date = cleanString(
      formData.get('date')
    )

    const time = cleanString(
      formData.get('time')
    )

    const location = cleanString(
      formData.get('location')
    )

    const category = cleanString(
      formData.get('category')
    )

    const imageFile = formData.get('imageFile')

    const validationError = validateEventInput({
      title,
      description,
      date,
      time,
      location,
      category,
    })

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      )
    }

    const { data: schoolYear, error: schoolYearError } =
      await admin
        .from('school_years')
        .select('id,label')
        .eq('is_active', true)
        .maybeSingle()

    if (schoolYearError) {
      return NextResponse.json(
        {
          error:
            `Impossible de charger l'année active : ${schoolYearError.message}`,
        },
        { status: 500 }
      )
    }

    if (!schoolYear) {
      return NextResponse.json(
        {
          error:
            "Aucune année scolaire active n'est définie.",
        },
        { status: 400 }
      )
    }

    let imageUrl = ''

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      imageUrl = await uploadImage(
        admin,
        imageFile
      )
    }

    const { data, error } = await admin
      .from('internal_agenda_events')
      .insert({
        school_year_id: schoolYear.id,
        title,
        description: description || null,
        event_date: date,
        start_time: time || null,
        end_time: null,
        location: location || null,
        image_url: imageUrl || null,
        category: category || null,
      })
      .select(
        'id,school_year_id,title,description,event_date,start_time,end_time,location,image_url,category,published_on_site,site_event_id,created_at,updated_at'
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
            : "Impossible d'ajouter l'événement.",
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const formData = await request.formData()

    const id = cleanString(
      formData.get('id')
    )

    const title = cleanString(
      formData.get('title')
    )

    const description = cleanString(
      formData.get('description')
    )

    const date = cleanString(
      formData.get('date')
    )

    const time = cleanString(
      formData.get('time')
    )

    const location = cleanString(
      formData.get('location')
    )

    const category = cleanString(
      formData.get('category')
    )

    const keepImage =
      formData.get('keepImage') === 'true'

    const imageFile = formData.get('imageFile')

    if (!id) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 400 }
      )
    }

    const validationError = validateEventInput({
      title,
      description,
      date,
      time,
      location,
      category,
    })

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      )
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from('internal_agenda_events')
      .select('id,image_url')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      )
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 404 }
      )
    }

    let imageUrl =
      keepImage
        ? existing.image_url || null
        : null

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      imageUrl = await uploadImage(
        admin,
        imageFile
      )
    }

    const { data, error } = await admin
      .from('internal_agenda_events')
      .update({
        title,
        description: description || null,
        event_date: date,
        start_time: time || null,
        location: location || null,
        image_url: imageUrl,
        category: category || null,
      })
      .eq('id', id)
      .select(
        'id,school_year_id,title,description,event_date,start_time,end_time,location,image_url,category,published_on_site,site_event_id,created_at,updated_at'
      )
      .single()

    if (error) {
      if (
        imageFile instanceof File &&
        imageFile.size > 0 &&
        imageUrl
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
      existing.image_url !== imageUrl
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
            : "Impossible de modifier l'événement.",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body = await request.json()

    const id = cleanString(body?.id)

    if (!id) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 400 }
      )
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from('internal_agenda_events')
      .select('id,image_url')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      )
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 404 }
      )
    }

    const { error } = await admin
      .from('internal_agenda_events')
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

    if (existing.image_url) {
      await deleteSupabaseImage(
        admin,
        existing.image_url
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
            : "Impossible de supprimer l'événement.",
      },
      { status: 500 }
    )
  }
}
