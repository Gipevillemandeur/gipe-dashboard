import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MEETING_TYPES = [
  'Réunion GIPE',
  'Conseil de classe',
  'Conseil de discipline',
  "Conseil d'administration",
  'Autre',
]

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

function validType(value: string) {
  return MEETING_TYPES.includes(value)
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
      { error: `Impossible de charger l'année active : ${schoolYearError.message}` },
      { status: 500 }
    )
  }

  if (!schoolYear) {
    return NextResponse.json({
      meetings: [],
      schoolYear: null,
    })
  }

  const { data, error } = await admin
    .from('instance_meetings')
    .select(
      'id,type,subject,meeting_date,meeting_time,location,school_year_id'
    )
    .eq('school_year_id', schoolYear.id)
    .order('meeting_date', { ascending: true })
    .order('meeting_time', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: `Impossible de charger les réunions : ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    meetings: data || [],
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
      type?: unknown
      subject?: unknown
      meetingDate?: unknown
      meetingTime?: unknown
      location?: unknown
    }

    const type = cleanString(body.type)
    const subject = cleanString(body.subject)
    const meetingDate = cleanString(body.meetingDate)
    const meetingTime = cleanString(body.meetingTime)
    const location = cleanString(body.location)

    if (!validType(type)) {
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

    if (!validDate(meetingDate)) {
      return NextResponse.json(
        { error: 'La date est invalide.' },
        { status: 400 }
      )
    }

    if (!validTime(meetingTime)) {
      return NextResponse.json(
        { error: "L'heure est invalide." },
        { status: 400 }
      )
    }

    if (location.length > 200) {
      return NextResponse.json(
        { error: 'Le lieu est trop long.' },
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
        { error: `Impossible de charger l'année active : ${schoolYearError.message}` },
        { status: 500 }
      )
    }

    if (!schoolYear) {
      return NextResponse.json(
        { error: "Aucune année scolaire active n'est définie." },
        { status: 400 }
      )
    }

    const { data, error } = await admin
      .from('instance_meetings')
      .insert({
        school_year_id: schoolYear.id,
        type,
        subject,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        location: location || null,
      })
      .select(
        'id,type,subject,meeting_date,meeting_time,location,school_year_id'
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Impossible d'ajouter la réunion : ${error.message}` },
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
