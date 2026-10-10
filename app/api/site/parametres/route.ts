import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'

/*
 * Paramètres affichés sur le site public (pied de page,
 * page Contact, mentions légales).
 *
 * Le site public les lit dans la table « settings »,
 * sous forme de paires clé / valeur. On n'autorise que
 * ces clés-là (le bandeau d'alerte a sa propre page).
 */
const SETTING_KEYS = [
  'adresse',
  'email',
  'rna',
  'president',
  'facebook',
  'instagram',
] as const

type SettingKey = (typeof SETTING_KEYS)[number]

const MAX_LENGTH = 500

async function requireWebsiteAccess() {
  try {
    await requireOfficePermission('website')

    return { admin: createAdminClient() }
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

    console.error('Erreur contrôle accès paramètres du site:', error)

    return {
      error: NextResponse.json(
        { error: 'Erreur de contrôle des accès.' },
        { status: 500 }
      ),
    }
  }
}

export async function GET() {
  const auth = await requireWebsiteAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { data, error } = await auth.admin
    .from('settings')
    .select('key,value')
    .in('key', [...SETTING_KEYS])

  if (error) {
    console.error('Erreur chargement paramètres site:', error)

    return NextResponse.json(
      {
        error: `Impossible de charger les paramètres du site : ${error.message}`,
      },
      { status: 500 }
    )
  }

  const settings = Object.fromEntries(
    SETTING_KEYS.map((key) => [key, ''])
  ) as Record<SettingKey, string>

  for (const row of data || []) {
    settings[row.key as SettingKey] = String(row.value ?? '')
  }

  return NextResponse.json(settings)
}

export async function PUT(request: Request) {
  const auth = await requireWebsiteAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body = (await request.json()) as Record<string, unknown>

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Données invalides.' },
        { status: 400 }
      )
    }

    const email = String(body.email ?? '').trim()

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'L’adresse e-mail est invalide.' },
        { status: 400 }
      )
    }

    for (const key of SETTING_KEYS) {
      if (body[key] === undefined) continue

      const value = String(body[key] ?? '').trim().slice(0, MAX_LENGTH)

      const { data: existing, error: readError } = await admin
        .from('settings')
        .select('key')
        .eq('key', key)

      if (readError) {
        throw new Error(
          `Impossible de lire le paramètre ${key} : ${readError.message}`
        )
      }

      const { error: writeError } =
        existing && existing.length > 0
          ? await admin.from('settings').update({ value }).eq('key', key)
          : await admin.from('settings').insert({ key, value })

      if (writeError) {
        throw new Error(
          `Impossible d’enregistrer le paramètre ${key} : ${writeError.message}`
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erreur API paramètres site:', error)

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
