import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { archiveInstanceMeeting } from '@/lib/instance-meeting-drive'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { claims },
  } = await supabase.auth.getClaims()

  const userId = claims?.sub

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
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
    console.error('Erreur vérification administrateur :', error)

    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Impossible de vérifier les droits administrateur.' },
        { status: 500 }
      ),
    }
  }

  if (!data) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Accès administrateur requis.' },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true as const,
    admin,
  }
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

    const auth = await requireAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const result = await archiveInstanceMeeting(auth.admin, id)

    return NextResponse.json({
      ok: true,
      message: 'Test d’archivage de la réunion réussi.',
      result,
    })
  } catch (error) {
    console.error('Erreur test archivage réunion :', error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur inconnue lors de l’archivage.',
      },
      { status: 500 }
    )
  }
}
