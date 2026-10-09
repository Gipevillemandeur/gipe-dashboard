import { createAdminClient } from '@/lib/supabase/admin'

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
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
    throw new Error(
      'Google Drive n’est pas connecté.'
    )
  }

  return connection
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
    (await tokenResponse.json()) as GoogleTokenResponse

  if (
    !tokenResponse.ok ||
    !tokenData.access_token
  ) {
    console.error(
      'Erreur renouvellement token Google:',
      tokenData
    )

    throw new Error(
      'Impossible d’obtenir un accès au Google Drive.'
    )
  }

  return tokenData.access_token
}
