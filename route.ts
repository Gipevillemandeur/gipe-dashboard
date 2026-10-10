import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'
import { requireEditableMeeting } from '@/lib/instance-guard'

const MEETING_TYPES = [
  'Réunion GIPE',
  'Conseil de classe',
  'Conseil de discipline',
  "Conseil d'administration",
  'Autre',
]

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

function validType(value: string) {
  return MEETING_TYPES.includes(value)
}

function validateMeetingInput(body: {
  type?: unknown
  subject?: unknown
  meetingDate?: unknown
  meetingTime?: unknown
  location?: unknown
}) {
  const type = cleanString(body.type)
  const subject = cleanString(body.subject)
  const meetingDate = cleanString(body.meetingDate)
  const meetingTime = cleanString(body.meetingTime)
  const location = cleanString(body.location)

  if (!validType(type)) {
    return {
      error: 'Le type de réunion est invalide.',
    }
  }

  if (!subject) {
    return {
      error: "L'objet de la réunion est obligatoire.",
    }
  }

  if (subject.length > 200) {
    return {
      error: "L'objet de la réunion est trop long.",
    }
  }

  if (!validDate(meetingDate)) {
    return {
      error: 'La date est invalide.',
    }
  }

  if (!validTime(meetingTime)) {
    return {
      error: "L'heure est invalide.",
    }
  }

  if (location.length > 200) {
    return {
      error: 'Le lieu est trop long.',
    }
  }

  return {
    values: {
      type,
      subject,
      meetingDate,
      meetingTime,
      location,
    },
  }
}

export async function GET() {
  const auth = await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  const {
    data: schoolYear,
    error: schoolYearError,
  } = await admin
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
      meetings: [],
      schoolYear: null,
    })
  }

  const {
    data,
    error,
  } = await admin
    .from('instance_meetings')
    .select(
      'id,type,subject,meeting_date,meeting_time,location,school_year_id'
    )
    .eq(
      'school_year_id',
      schoolYear.id
    )
    .order(
      'meeting_date',
      { ascending: true }
    )
    .order(
      'meeting_time',
      {
        ascending: true,
        nullsFirst: false,
      }
    )
    .order(
      'id',
      { ascending: true }
    )

  if (error) {
    return NextResponse.json(
      {
        error:
          `Impossible de charger les réunions : ${error.message}`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    meetings: data || [],
    schoolYear,
  })
}

export async function POST(
  request: Request
) {
  const auth =
    await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body =
      (await request.json()) as {
        type?: unknown
        subject?: unknown
        meetingDate?: unknown
        meetingTime?: unknown
        location?: unknown
      }

    const validated =
      validateMeetingInput(body)

    if ('error' in validated) {
      return NextResponse.json(
        {
          error:
            validated.error,
        },
        { status: 400 }
      )
    }

    const {
      data: schoolYear,
      error: schoolYearError,
    } = await admin
      .from('school_years')
      .select('id,label')
      .eq(
        'is_active',
        true
      )
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

    const { values } =
      validated

    const {
      data,
      error,
    } = await admin
      .from('instance_meetings')
      .insert({
        school_year_id:
          schoolYear.id,
        type:
          values.type,
        subject:
          values.subject,
        meeting_date:
          values.meetingDate,
        meeting_time:
          values.meetingTime,
        location:
          values.location ||
          null,
      })
      .select(
        'id,type,subject,meeting_date,meeting_time,location,school_year_id'
      )
      .single()

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible d'ajouter la réunion : ${error.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        meeting: data,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'ajouter la réunion.",
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request
) {
  const auth =
    await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body =
      (await request.json()) as {
        id?: unknown
        type?: unknown
        subject?: unknown
        meetingDate?: unknown
        meetingTime?: unknown
        location?: unknown
      }

    const id =
      cleanString(body.id)

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Réunion introuvable.',
        },
        { status: 400 }
      )
    }

    const validated =
      validateMeetingInput(body)

    if ('error' in validated) {
      return NextResponse.json(
        {
          error:
            validated.error,
        },
        { status: 400 }
      )
    }

    // Réunions des années clôturées : figées.
    const guard = await requireEditableMeeting(admin, id)

    if ('error' in guard) {
      return guard.error
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from('instance_meetings')
      .select('id')
      .eq(
        'id',
        id
      )
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
            'Réunion introuvable.',
        },
        { status: 404 }
      )
    }

    const { values } =
      validated

    const {
      data,
      error,
    } = await admin
      .from('instance_meetings')
      .update({
        type:
          values.type,
        subject:
          values.subject,
        meeting_date:
          values.meetingDate,
        meeting_time:
          values.meetingTime,
        location:
          values.location ||
          null,
      })
      .eq(
        'id',
        id
      )
      .select(
        'id,type,subject,meeting_date,meeting_time,location,school_year_id'
      )
      .single()

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de modifier la réunion : ${error.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      meeting: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de modifier la réunion.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request
) {
  const auth =
    await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body =
      (await request.json()) as {
        id?: unknown
      }

    const id =
      cleanString(body.id)

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Réunion introuvable.',
        },
        { status: 400 }
      )
    }

    // Réunions des années clôturées : figées.
    const guard = await requireEditableMeeting(admin, id)

    if ('error' in guard) {
      return guard.error
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from('instance_meetings')
      .select('id')
      .eq(
        'id',
        id
      )
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
            'Réunion introuvable.',
        },
        { status: 404 }
      )
    }

    const {
      error,
    } = await admin
      .from('instance_meetings')
      .delete()
      .eq(
        'id',
        id
      )

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de supprimer la réunion : ${error.message}`,
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
            : 'Impossible de supprimer la réunion.',
      },
      { status: 500 }
    )
  }
}
