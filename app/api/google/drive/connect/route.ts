import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { getOfficeAccess } from '@/lib/office-auth'
import { GOOGLE_DRIVE_SCOPES } from '@/lib/google-drive'

/*
 * Lance la connexion (ou reconnexion) du Google Drive
 * de l'association. Réservé au Président.
 *
 * L'utilisateur est envoyé chez Google, qui le renvoie
 * ensuite vers /api/google/drive/callback.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const access = await getOfficeAccess()

  if (!access.authenticated) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!access.authorized || !(access.isPresident || access.isSuperAdmin)) {
    return NextResponse.redirect(
      new URL('/documents?google=forbidden', request.url)
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/documents?google=config_error', request.url)
    )
  }

  /*
   * Jeton anti-usurpation : Google nous le renverra
   * et on vérifiera qu'il correspond.
   */
  const state = randomBytes(24).toString('hex')

  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleUrl.searchParams.set('client_id', clientId)
  googleUrl.searchParams.set('redirect_uri', `${url.origin}/api/google/drive/callback`)
  googleUrl.searchParams.set('response_type', 'code')
  googleUrl.searchParams.set('scope', GOOGLE_DRIVE_SCOPES.join(' '))
  googleUrl.searchParams.set('access_type', 'offline')
  // Force Google à redonner un jeton durable à chaque connexion.
  googleUrl.searchParams.set('prompt', 'consent select_account')
  googleUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(googleUrl.toString())

  response.cookies.set('gipe_drive_oauth_state', state, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/google/drive',
    maxAge: 10 * 60,
  })

  return response
}
