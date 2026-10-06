import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
        { error: 'Impossible de vérifier les droits administrateur.' },
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
  return /^\d{2}:\d{2}$/.test(value)
}

function validateEventInput(body: {
  title?: unknown
  category?: unknown
  eventDate?: unknown
  startTime?: unknown
  endTime?: unknown
  location?: unknown
  description?: unknown
}) {
  const title = cleanString(body.title)
  const category = cleanString(body.category)
  const eventDate = cleanString(body.eventDate)
  const startTime = cleanString(body.startTime)
  const endTime = cleanString(body.endTime)
  const location = cleanString(body.location)
  const description = cleanString(body.description)

  if (!title) {
    return {
      error: "Le titre de l'événement est obligatoire.",
    }
  }

  if (title.length > 200) {
    return {
      error: "Le titre de l'événement est trop long.",
    }
  }

  if (!validDate(eventDate)) {
    return {
      error: 'La date est invalide.',
    }
  }

  if (startTime && !validTime(startTime)) {
    return {
      error: "L'heure de début est invalide.",
    }
  }

  if (endTime && !validTime(endTime)) {
    return {
      error: "L'heure de fin est invalide.",
    }
  }

  if (startTime && endTime && endTime < startTime) {
    return {
      error: "L'heure de fin doit être supérieure ou égale à l'heure de début.",
    }
  }

  if (category.length > 100) {
    return {
      error: 'La catégorie est trop longue.',
    }
  }

  if (location.length > 200) {
    return {
      error: 'Le lieu est trop long.',
    }
  }

  if (description.length > 5000) {
    return {
      error: 'La description est trop longue.',
    }
  }

  return {
    values: {
      title,
      category,
      eventDate,
      startTime,
      endTime,
      location,
      description,
    },
  }
}

export async function GET() {
  const auth = await requireAdmin()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  const { data: schoolYear, error: schoolYearError } = await admin
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
    .maybeSingle()

  if (schoolYearError) {
    return NextResponse.json(
      {
        error: `Impossible de charger l'année active : ${schoolYearError.message}`,
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
      'id,school_year_id,title,category,event_date,start_time,end_time,location,description,published_on_site,site_event_id,created_at,updated_at'
    )
    .eq('school_year_id', schoolYear.id)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })

  if (error) {
    return NextResponse.json(
      {
        error: `Impossible de charger les événements : ${error.message}`,
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
    const body = (await request.json()) as {
      title?: unknown
      category?: unknown
      eventDate?: unknown
      startTime?: unknown
      endTime?: unknown
      location?: unknown
      description?: unknown
    }

    const validated = validateEventInput(body)

    if ('error' in validated) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400 }
      )
    }

    const { data: schoolYear, error: schoolYearError } = await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle()

    if (schoolYearError) {
      return NextResponse.json(
        {
          error: `Impossible de charger l'année active : ${schoolYearError.message}`,
        },
        { status: 500 }
      )
    }

    if (!schoolYear) {
      return NextResponse.json(
        {
          error: "Aucune année scolaire active n'est définie.",
        },
        { status: 400 }
      )
    }

    const { values } = validated

    const { data, error } = await admin
      .from('internal_agenda_events')
      .insert({
        school_year_id: schoolYear.id,
        title: values.title,
        category: values.category || null,
        event_date: values.eventDate,
        start_time: values.startTime || null,
        end_time: values.endTime || null,
        location: values.location || null,
        description: values.description || null,
      })
      .select(
        'id,school_year_id,title,category,event_date,start_time,end_time,location,description,published_on_site,site_event_id,created_at,updated_at'
      )
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: `Impossible d'ajouter l'événement : ${error.message}`,
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
    const body = (await request.json()) as {
      id?: unknown
      title?: unknown
      category?: unknown
      eventDate?: unknown
      startTime?: unknown
      endTime?: unknown
      location?: unknown
      description?: unknown
    }

    const id = cleanString(body.id)

    if (!id) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 400 }
      )
    }

    const validated = validateEventInput(body)

    if ('error' in validated) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400 }
      )
    }

    const { data: existing, error: existingError } = await admin
      .from('internal_agenda_events')
      .select('id,published_on_site,site_event_id')
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

    const { values } = validated

    const { data, error } = await admin
      .from('internal_agenda_events')
      .update({
        title: values.title,
        category: values.category || null,
        event_date: values.eventDate,
        start_time: values.startTime || null,
        end_time: values.endTime || null,
        location: values.location || null,
        description: values.description || null,
      })
      .eq('id', id)
      .select(
        'id,school_year_id,title,category,event_date,start_time,end_time,location,description,published_on_site,site_event_id,created_at,updated_at'
      )
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: `Impossible de modifier l'événement : ${error.message}`,
        },
        { status: 500 }
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
    const body = (await request.json()) as {
      id?: unknown
    }

    const id = cleanString(body.id)

    if (!id) {
      return NextResponse.json(
        { error: 'Événement introuvable.' },
        { status: 400 }
      )
    }

    const { data: existing, error: existingError } = await admin
      .from('internal_agenda_events')
      .select('id')
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
          error: `Impossible de supprimer l'événement : ${error.message}`,
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
            : "Impossible de supprimer l'événement.",
      },
      { status: 500 }
    )
  }
}
