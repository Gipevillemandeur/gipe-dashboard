import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'

async function requireWebsiteAccess() {
  try {
    await requireOfficePermission('website')

    return {
      admin: createAdminClient(),
    }
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        'AUTHENTICATION_REQUIRED'
      ) {
        return {
          error: NextResponse.json(
            {
              error: 'Non authentifié.',
            },
            { status: 401 }
          ),
        }
      }

      if (
        error.message ===
          'OFFICE_ACCESS_DENIED' ||
        error.message ===
          'OFFICE_PERMISSION_DENIED'
      ) {
        return {
          error: NextResponse.json(
            {
              error:
                'Compte non autorisé.',
            },
            { status: 403 }
          ),
        }
      }
    }

    console.error(
      'Erreur contrôle accès paramètres du site:',
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

export async function GET() {
  const auth =
    await requireWebsiteAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  const { data, error } =
    await admin
      .from('site_settings')
      .select('*')
      .maybeSingle()

  if (error) {
    console.error(
      'Erreur chargement paramètres site:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Impossible de charger les paramètres du site.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    settings: data || null,
  })
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
    const body =
      (await request.json()) as Record<
        string,
        unknown
      >

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          error:
            'Données invalides.',
        },
        { status: 400 }
      )
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from('site_settings')
      .select('id')
      .maybeSingle()

    if (existingError) {
      console.error(
        'Erreur lecture paramètres site:',
        existingError
      )

      return NextResponse.json(
        {
          error:
            'Impossible de lire les paramètres du site.',
        },
        { status: 500 }
      )
    }

    let result

    if (existing?.id) {
      result =
        await admin
          .from('site_settings')
          .update(body)
          .eq('id', existing.id)
          .select('*')
          .single()
    } else {
      result =
        await admin
          .from('site_settings')
          .insert(body)
          .select('*')
          .single()
    }

    if (result.error) {
      console.error(
        'Erreur sauvegarde paramètres site:',
        result.error
      )

      return NextResponse.json(
        {
          error:
            'Impossible de sauvegarder les paramètres du site.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      settings: result.data,
    })
  } catch (error) {
    console.error(
      'Erreur API paramètres site:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de sauvegarder les paramètres du site.',
      },
      { status: 500 }
    )
  }
}
