import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'

const MEETING_TYPES = [
  'Réunion GIPE',
  'Conseil de classe',
  'Conseil de discipline',
  "Conseil d'administration",
  'Autre',
]

function cleanString(value: unknown) {
  return String(value ?? '').trim()
}

function handlePermissionError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'AUTHENTICATION_REQUIRED') {
      return NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      )
    }

    if (
      error.message === 'OFFICE_ACCESS_DENIED' ||
      error.message === 'OFFICE_PERMISSION_DENIED'
    ) {
      return NextResponse.json(
        { error: 'Compte non autorisé.' },
        { status: 403 }
      )
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    await requireOfficePermission('agenda')
    await requireOfficePermission('schooling')

    const body = (await request.json()) as {
      eventId?: unknown
      type?: unknown
      subject?: unknown
    }

    const eventId = cleanString(body.eventId)
    const type = cleanString(body.type)
    const subject = cleanString(body.subject)

    if (!eventId) {
      return NextResponse.json(
        { error: "L'événement Agenda est introuvable." },
        { status: 400 }
      )
    }

    if (!MEETING_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Le type de réunion est invalide.' },
        { status: 400 }
      )
    }

    if (!subject) {
      return NextResponse.json(
        { error: "L'objet de la réunion est obligatoire." },
        { status: 400 }
      )
    }

    if (subject.length > 200) {
      return NextResponse.json(
        { error: "L'objet de la réunion est trop long." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: event, error: eventError } = await admin
      .from('internal_agenda_events')
      .select(
        'id,event_date,start_time,location'
      )
      .eq('id', eventId)
      .maybeSingle()

    if (eventError) {
      return NextResponse.json(
        {
          error:
            `Impossible de récupérer l'événement Agenda : ${eventError.message}`,
        },
        { status: 500 }
      )
    }

    if (!event) {
      return NextResponse.json(
        { error: 'Événement Agenda introuvable.' },
        { status: 404 }
      )
    }

    if (!event.event_date) {
      return NextResponse.json(
        {
          error:
            'La date de l’événement Agenda est obligatoire.',
        },
        { status: 400 }
      )
    }

    if (!event.start_time) {
      return NextResponse.json(
        {
          error:
            "L'heure de l'événement Agenda est obligatoire pour créer une instance.",
        },
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
            `Impossible de charger l'année scolaire active : ${schoolYearError.message}`,
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

    const { data: meeting, error: meetingError } =
      await admin
        .from('instance_meetings')
        .insert({
          school_year_id: schoolYear.id,
          type,
          subject,
          meeting_date: event.event_date,
          meeting_time: event.start_time,
          location: event.location || null,
        })
        .select(
          'id,type,subject,meeting_date,meeting_time,location,school_year_id'
        )
        .single()

    if (meetingError) {
      return NextResponse.json(
        {
          error:
            `Impossible de créer la réunion dans les Instances : ${meetingError.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        meeting,
      },
      { status: 201 }
    )
  } catch (error) {
    const permissionResponse =
      handlePermissionError(error)

    if (permissionResponse) {
      return permissionResponse
    }

    console.error(
      'Erreur envoi Agenda vers Instances:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'envoyer la réunion dans les Instances.",
      },
      { status: 500 }
    )
  }
}
