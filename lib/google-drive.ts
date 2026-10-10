import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

/*
 * Droits demandés à Google lors de la connexion :
 * accès complet au Drive de l'association + adresse e-mail
 * du compte (pour afficher quel compte est relié).
 */
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
]

export const DRIVE_FOLDER_MIME =
  'application/vnd.google-apps.folder'

/*
 * Identifiant Drive valide : lettres, chiffres, - et _.
 * « root » désigne la racine du Drive.
 * Empêche d'injecter du texte dans les requêtes Google.
 */
export function isValidDriveId(value: string | null | undefined): value is string {
  return (
    typeof value === 'string' &&
    (value === 'root' || /^[A-Za-z0-9_-]{5,200}$/.test(value))
  )
}

/*
 * Fichiers Google (Docs, Sheets…) : ils n'existent pas
 * « en vrai » et doivent être convertis pour être téléchargés.
 */
export const GOOGLE_EXPORTS: Record<
  string,
  { mimeType: string; extension: string }
> = {
  'application/vnd.google-apps.document': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: 'pptx',
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'application/pdf',
    extension: 'pdf',
  },
}

/*
 * Un fichier peut-il être téléchargé ?
 * (les fichiers classiques, et les Google Docs/Sheets/Slides/Dessins)
 */
export function isDownloadable(mimeType: string) {
  if (!mimeType.startsWith('application/vnd.google-apps.')) {
    return true
  }

  return Boolean(GOOGLE_EXPORTS[mimeType])
}

/**
 * Récupère la connexion Google Drive utilisée par le GIPE.
 *
 * IMPORTANT :
 * cette connexion est commune à tous les utilisateurs autorisés.
 * Elle ne dépend donc pas du user_id de la personne actuellement connectée.
 */
async function getGoogleDriveConnection() {
  const adminClient = createAdminClient()

  const {
    data: connection,
    error,
  } = await adminClient
    .from('google_drive_connections')
    .select('google_email, refresh_token, updated_at')
    .order('updated_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      'Erreur récupération connexion Google Drive:',
      error
    )

    throw new Error(
      'Impossible de récupérer la connexion Google Drive.'
    )
  }

  if (!connection?.refresh_token) {
    throw new Error('DRIVE_NOT_CONNECTED')
  }

  return connection
}

/*
 * Infos affichables sur la connexion (jamais le jeton).
 */
export async function getDriveConnectionInfo(): Promise<{
  connected: boolean
  email: string | null
  updatedAt: string | null
}> {
  try {
    const connection = await getGoogleDriveConnection()

    return {
      connected: true,
      email: connection.google_email || null,
      updatedAt: connection.updated_at || null,
    }
  } catch {
    return {
      connected: false,
      email: null,
      updatedAt: null,
    }
  }
}

/**
 * Obtient un access token Google à partir
 * de la connexion Drive de l'association.
 */
export async function getGoogleAccessToken() {
  const connection =
    await getGoogleDriveConnection()

  const clientId =
    process.env.GOOGLE_CLIENT_ID

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      'La configuration Google OAuth est incomplète.'
    )
  }

  const tokenResponse =
    await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body:
          new URLSearchParams({
            client_id: clientId,
            client_secret:
              clientSecret,
            refresh_token:
              connection.refresh_token,
            grant_type:
              'refresh_token',
          }).toString(),
        cache: 'no-store',
      }
    )

  const tokenData =
    (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse

  if (
    !tokenResponse.ok ||
    !tokenData.access_token
  ) {
    console.error(
      'Erreur renouvellement token Google:',
      tokenData
    )

    /*
     * invalid_grant = Google a retiré l'accès
     * (mot de passe changé, accès révoqué…).
     * Il faut reconnecter le Drive.
     */
    if (tokenData.error === 'invalid_grant') {
      throw new Error('DRIVE_NOT_CONNECTED')
    }

    throw new Error(
      'Impossible d’obtenir un accès au Google Drive.'
    )
  }

  return tokenData.access_token
}

/*
 * Gestion commune des erreurs des routes Drive.
 * `code: 'DRIVE_NOT_CONNECTED'` permet à la page d'afficher
 * le bouton de reconnexion.
 */
export function driveErrorResponse(
  error: unknown,
  fallbackMessage: string
) {
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

    if (error.message === 'DRIVE_NOT_CONNECTED') {
      return NextResponse.json(
        {
          error:
            'Google Drive n’est pas connecté (ou l’accès a expiré). Le Président doit le reconnecter.',
          code: 'DRIVE_NOT_CONNECTED',
        },
        { status: 503 }
      )
    }
  }

  console.error('Erreur API Google Drive:', error)

  return NextResponse.json(
    {
      error:
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage,
    },
    { status: 500 }
  )
}

/*
 * Lit le message d'erreur renvoyé par Google.
 */
export async function readGoogleError(
  response: Response,
  fallback: string
) {
  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string }
  } | null

  return data?.error?.message || fallback
}
