import { NextResponse } from 'next/server'
import { getOfficeAccess } from '@/lib/office-auth'
import { logActivity } from '@/lib/activity'
import { FacebookError, GRAPH, graph, saveConnection, type PendingPage } from '@/lib/facebook'

const STATE_COOKIE = 'gipe_facebook_oauth_state'

type Account = {
  id: string
  name: string
  access_token?: string
  tasks?: string[]
}

/*
 * Retour de Facebook après « Connecter Facebook ».
 *
 * 1. code → jeton utilisateur (1 h) → jeton utilisateur durable (60 j)
 * 2. liste des Pages gérées → jeton de chaque Page (durable)
 * 3. une seule Page → reliée directement ;
 *    plusieurs → le Président choisit sur la page Facebook du dashboard.
 */
export async function GET(request: Request) {
  const back = (status: string) => {
    const response = NextResponse.redirect(new URL(`/facebook?facebook=${status}`, request.url))
    response.cookies.set(STATE_COOKIE, '', { path: '/api/facebook', maxAge: 0 })
    return response
  }

  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (url.searchParams.get('error')) {
      console.error('Connexion Facebook refusée:', url.searchParams.get('error_description'))
      return back('cancelled')
    }

    const expectedState = (request.headers.get('cookie') || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${STATE_COOKIE}=`))
      ?.slice(STATE_COOKIE.length + 1)

    if (!code || !state || !expectedState || state !== expectedState) {
      return back('invalid_state')
    }

    const access = await getOfficeAccess()

    if (!access.authenticated) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (!access.authorized || !(access.isPresident || access.isSuperAdmin)) {
      return back('forbidden')
    }

    const appId = process.env.FACEBOOK_APP_ID
    const appSecret = process.env.FACEBOOK_APP_SECRET

    if (!appId || !appSecret) return back('config_error')

    // 1. Code → jeton utilisateur
    const shortUrl = new URL(`${GRAPH}/oauth/access_token`)
    shortUrl.searchParams.set('client_id', appId)
    shortUrl.searchParams.set('client_secret', appSecret)
    shortUrl.searchParams.set('redirect_uri', `${url.origin}/api/facebook/callback`)
    shortUrl.searchParams.set('code', code)

    const shortResponse = await fetch(shortUrl.toString(), { cache: 'no-store' })
    const shortData = (await shortResponse.json().catch(() => ({}))) as any

    if (!shortResponse.ok || !shortData?.access_token) {
      console.error('Échange code Facebook:', JSON.stringify(shortData?.error || shortData))
      return back('token_error')
    }

    // Jeton utilisateur durable (les jetons de Page obtenus avec lui n'expirent pas).
    const longUrl = new URL(`${GRAPH}/oauth/access_token`)
    longUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longUrl.searchParams.set('client_id', appId)
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('fb_exchange_token', shortData.access_token)

    const longResponse = await fetch(longUrl.toString(), { cache: 'no-store' })
    const longData = (await longResponse.json().catch(() => ({}))) as any
    const userToken: string = longData?.access_token || shortData.access_token

    // 2. Qui s'est connecté + ses Pages
    const me = await graph<{ name?: string }>('/me', userToken, { params: { fields: 'name' } }).catch(() => ({ name: undefined }))

    const accounts = await graph<{ data?: Account[] }>('/me/accounts', userToken, {
      params: { fields: 'id,name,access_token,tasks', limit: '100' },
    })

    const pages: PendingPage[] = (accounts.data || [])
      .filter((page) => page.id && page.access_token)
      // Il faut pouvoir publier (« Créer du contenu »).
      .filter((page) => !page.tasks || page.tasks.includes('CREATE_CONTENT') || page.tasks.includes('MANAGE'))
      .map((page) => ({ id: page.id, name: page.name, token: page.access_token as string }))

    if (pages.length === 0) return back('no_page')

    // 3. Une seule Page → reliée ; plusieurs → choix.
    if (pages.length === 1) {
      await saveConnection({
        page_id: pages[0].id,
        page_name: pages[0].name,
        page_token: pages[0].token,
        facebook_user: me.name || null,
        pending_pages: null,
        connected_by: access.userId,
      })

      await logActivity('Facebook', `a relié la Page Facebook « ${pages[0].name} »`, access)
      return back('connected')
    }

    await saveConnection({
      pending_pages: pages,
      facebook_user: me.name || null,
      connected_by: access.userId,
    })

    return back('choose')
  } catch (error) {
    console.error('Erreur retour Facebook:', error)
    return back(error instanceof FacebookError && error.status === 500 ? 'save_error' : 'error')
  }
}
