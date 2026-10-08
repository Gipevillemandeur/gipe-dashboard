import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'
import { buildInstanceMeetingPdf } from '@/lib/instance-meeting-pdf'

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

function clean(value: unknown) {
  return String(value ?? '').trim()
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

  try {
    const { id } =
      await params

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Identifiant de réunion manquant.',
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // Réunion
    // ------------------------------------------------------------

    const {
      data: meeting,
      error: meetingError,
    } =
      await auth.admin
        .from('instance_meetings')
        .select(
          `
          id,
          school_year_id,
          type,
          subject,
          meeting_date,
          meeting_time,
          location,
          summary
        `
        )
        .eq(
          'id',
          id
        )
        .maybeSingle()

    if (meetingError) {
      return NextResponse.json(
        {
          error:
            `Impossible de charger la réunion : ${meetingError.message}`,
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

    // ------------------------------------------------------------
    // Année scolaire
    // ------------------------------------------------------------

    const {
      data: schoolYear,
      error: schoolYearError,
    } =
      await auth.admin
        .from('school_years')
        .select('label')
        .eq(
          'id',
          meeting.school_year_id
        )
        .maybeSingle()

    if (schoolYearError) {
      return NextResponse.json(
        {
          error:
            `Impossible de charger l'année scolaire : ${schoolYearError.message}`,
        },
        { status: 500 }
      )
    }

    if (!schoolYear) {
      return NextResponse.json(
        {
          error:
            'Année scolaire introuvable.',
        },
        { status: 404 }
      )
    }

    // ------------------------------------------------------------
    // Documents associés
    // ------------------------------------------------------------

    const {
      data: documents,
      error: documentsError,
    } =
      await auth.admin
        .from(
          'instance_meeting_documents'
        )
        .select(
          'file_name'
        )
        .eq(
          'meeting_id',
          id
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        )

    if (documentsError) {
      return NextResponse.json(
        {
          error:
            `Impossible de récupérer les documents associés : ${documentsError.message}`,
        },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // Génération du PDF
    // ------------------------------------------------------------

    const pdf =
      await buildInstanceMeetingPdf({
        schoolYear:
          schoolYear.label,
        type:
          meeting.type,
        subject:
          meeting.subject,
        meetingDate:
          meeting.meeting_date,
        meetingTime:
          meeting.meeting_time,
        location:
          meeting.location,
        summary:
          meeting.summary,
        documents:
          (documents ?? []).map(
            (document) => ({
              fileName:
                document.file_name,
            })
          ),
      })

    // ------------------------------------------------------------
    // Nom du fichier
    // ------------------------------------------------------------

    const safeSubject =
      clean(
        meeting.subject
      )
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .replace(
          /[^a-zA-Z0-9]+/g,
          '-'
        )
        .replace(
          /^-+|-+$/g,
          ''
        )
        .slice(
          0,
          80
        ) ||
      'reunion'

    const fileName =
      `Fiche-reunion-${safeSubject}.pdf`

    // ------------------------------------------------------------
    // Retour du PDF
    // ------------------------------------------------------------

    return new NextResponse(
      pdf as BodyInit,
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/pdf',
          'Content-Disposition':
            `inline; filename="${fileName}"`,
          'Cache-Control':
            'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    console.error(
      'Erreur génération PDF réunion :',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la génération du PDF.',
      },
      { status: 500 }
    )
  }
}
