import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'

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

function clean(value: unknown) {
  return String(value ?? '').trim()
}

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const auth = await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { id } = await params

  const {
    data,
    error,
  } = await auth.admin
    .from('instance_meetings')
    .select(
      'id,type,subject,meeting_date,meeting_time,location,school_year_id,summary'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      {
        error:
          `Impossible de charger la réunion : ${error.message}`,
      },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json(
      {
        error: 'Réunion introuvable.',
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    meeting: data,
  })
}

export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  const auth = await requireSchoolingAccess()

  if ('error' in auth) {
    return auth.error
  }

  try {
    const { id } = await params

    const body =
      (await request.json()) as {
        summary?: unknown
      }

    const summary =
      clean(body.summary)

    const {
      data,
      error,
    } = await auth.admin
      .from('instance_meetings')
      .update({
        summary,
      })
      .eq('id', id)
      .select(
        'id,type,subject,meeting_date,meeting_time,location,school_year_id,summary'
      )
      .single()

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible d’enregistrer le résumé : ${error.message}`,
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
            : 'Impossible d’enregistrer le résumé.',
      },
      { status: 500 }
    )
  }
}
