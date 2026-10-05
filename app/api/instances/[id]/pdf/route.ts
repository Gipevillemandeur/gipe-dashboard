import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { buildInstanceMeetingPdf } from '@/lib/instance-meeting-pdf'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Identifiant de réunion manquant.' },
        { status: 400 }
      )
    }

    // Vérification de la session
    const supabase = await createClient()

    const {
      data: { claims },
      error: claimsError,
    } = await supabase.auth.getClaims()

    if (claimsError || !claims?.sub) {
      return NextResponse.json(
        { error: 'Non autorisé.' },
        { status: 401 }
      )
    }

    // Vérification des droits administrateur
    const admin = createAdminClient()

    const { data: adminUser, error: adminError } = await admin
      .from('gipe_admins')
      .select('user_id')
      .eq('user_id', claims.sub)
      .maybeSingle()

    if (adminError || !adminUser) {
      return NextResponse.json(
        { error: 'Accès administrateur requis.' },
        { status: 403 }
      )
    }

    // Récupération de la réunion
    const { data: meeting, error: meetingError } = await admin
      .from('instance_meetings')
      .select(`
        id,
        school_year_id,
        type,
        subject,
        meeting_date,
        meeting_time,
        location,
        summary
      `)
      .eq('id', id)
      .single()

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Réunion introuvable.' },
        { status: 404 }
      )
    }

    // Récupération de l'année scolaire
    const { data: schoolYear, error: schoolYearError } = await admin
      .from('school_years')
      .select('label')
      .eq('id', meeting.school_year_id)
      .single()

    if (schoolYearError || !schoolYear) {
      return NextResponse.json(
        { error: 'Année scolaire introuvable.' },
        { status: 404 }
      )
    }

    // Récupération des documents associés
    const { data: documents, error: documentsError } = await admin
      .from('instance_meeting_documents')
      .select('file_name')
      .eq('meeting_id', id)
      .order('created_at', { ascending: true })

    if (documentsError) {
      return NextResponse.json(
        { error: 'Impossible de récupérer les documents associés.' },
        { status: 500 }
      )
    }

    // Génération du PDF
    const pdf = await buildInstanceMeetingPdf({
      schoolYear: schoolYear.label,
      type: meeting.type,
      subject: meeting.subject,
      meetingDate: meeting.meeting_date,
      meetingTime: meeting.meeting_time,
      location: meeting.location,
      summary: meeting.summary,
      documents: (documents ?? []).map((document) => ({
        fileName: document.file_name,
      })),
    })

    // Nom de fichier propre
    const safeSubject =
      String(meeting.subject || 'reunion')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'reunion'

    const fileName = `Fiche-reunion-${safeSubject}.pdf`

    return new NextResponse(pdf as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Erreur génération PDF réunion :', error)

    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF.' },
      { status: 500 }
    )
  }
}
