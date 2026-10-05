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
        {
          error:
            'Impossible de vérifier les droits administrateur.',
        },
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

export async function GET() {
  const auth = await requireAdmin()

  if ('error' in auth) {
    return auth.error
  }

  try {
    /*
     * Récupération de l'année actuellement active.
     *
     * Aucun élément Supabase n'est modifié.
     */
    const { data: schoolYear, error: schoolYearError } =
      await auth.admin
        .from('school_years')
        .select('label')
        .eq('is_active', true)
        .maybeSingle()

    if (schoolYearError) {
      throw new Error(
        `Impossible de récupérer l'année active : ${schoolYearError.message}`
      )
    }

    if (!schoolYear) {
      throw new Error(
        'Aucune année scolaire active.'
      )
    }

    /*
     * Récupération de la configuration Google Drive.
     *
     * Le token reste côté serveur et n'est jamais exposé
     * au navigateur.
     */
    const scriptUrl =
      process.env.GOOGLE_DRIVE_APPS_SCRIPT_URL?.trim()

    const token =
      process.env.GOOGLE_DRIVE_APPS_SCRIPT_TOKEN?.trim()

    if (!scriptUrl || !token) {
      throw new Error(
        'La connexion Google Drive n’est pas configurée dans Vercel.'
      )
    }

    /*
     * Petit fichier texte de test.
     *
     * Ce fichier ne provient d'aucune donnée réelle.
     */
    const fileName = 'test-archivage.txt'

    const content = [
      'TEST ARCHIVAGE GIPE',
      '',
      `Année scolaire : ${schoolYear.label}`,
      '',
      'Ce fichier est uniquement un test.',
      'Il ne provient pas de la clôture annuelle.',
      'Aucune donnée Supabase n’a été modifiée.',
    ].join('\n')

    const base64 =
      Buffer.from(content, 'utf-8').toString('base64')

    /*
     * Appel de la nouvelle action Apps Script.
     */
    const response = await fetch(scriptUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'upload_instance_file',
        token,
        schoolYear: schoolYear.label,
        instanceFolderName: 'TEST - Archivage GIPE',
        fileName,
        mimeType: 'text/plain',
        base64,
      }),
      cache: 'no-store',
    })

    const responseText = await response.text()

    let result: any

    try {
      result = JSON.parse(responseText)
    } catch {
      throw new Error(
        `Réponse Apps Script inattendue (HTTP ${response.status}).`
      )
    }

    if (!response.ok || !result?.ok) {
      throw new Error(
        result?.error ||
          `Archivage Drive impossible (HTTP ${response.status}).`
      )
    }

    return NextResponse.json({
      ok: true,
      message:
        'Le test d’archivage Google Drive a réussi.',
      schoolYear: schoolYear.label,
      result,
    })
  } catch (error) {
    console.error(
      'Erreur test archivage Drive instance :',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’effectuer le test Drive.',
      },
      { status: 500 }
    )
  }
}
