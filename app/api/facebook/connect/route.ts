import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { getOfficeAccess } from '@/lib/office-auth'
import { FACEBOOK_SCOPES, GRAPH_VERSION, facebookConfigured } from '@/lib/facebook'

/*
 * Lance la connexion (ou reconnexion) de la Page Facebook.
 * Réservé au Président (et au SUPER ADMIN).
 * Facebook renvoie ensuite vers /api/facebook/callback.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const access = await getOfficeAccess()

  if (!access.authenticated) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!access.authorized || !(access.isPresident || access.isSuperAdmin)) {
    return NextResponse.redirect(new URL('/facebook?facebook=forbidden', request.url))
  }

  if (!facebookConfigured()) {
    return NextResponse.redirect(new URL('/facebook?facebook=config_error', request.url))
  }

  // Jeton anti-usurpation, vérifié au retour.
  const state = randomBytes(24).toString('hex')

  const dialog = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`)
  dialog.searchParams.set('client_id', process.env.FACEBOOK_APP_ID as string)
  dialog.searchParams.set('redirect_uri', `${url.origin}/api/facebook/callback`)
  dialog.searchParams.set('state', state)
  dialog.searchParams.set('response_type', 'code')

  if (process.env.FACEBOOK_CONFIG_ID) {
    // Application « Facebook Login for Business » : les autorisations
    // sont définies dans la « configuration » côté Meta.
    dialog.searchParams.set('config_id', process.env.FACEBOOK_CONFIG_ID)
  } else {
    dialog.searchParams.set('scope', FACEBOOK_SCOPES.join(','))
  }

  const response = NextResponse.redirect(dialog.toString())

  response.cookies.set('gipe_facebook_oauth_state', state, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/facebook',
    maxAge: 10 * 60,
  })

  return response
}
