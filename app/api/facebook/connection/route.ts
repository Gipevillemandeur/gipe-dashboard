import { NextResponse } from 'next/server'
import { getOfficeAccess, requireOfficePermission } from '@/lib/office-auth'
import { logActivity } from '@/lib/activity'
import {
  FacebookError,
  deleteConnection,
  facebookConfigured,
  facebookErrorResponse,
  readConnection,
  saveConnection,
} from '@/lib/facebook'

/*
 * GET  : état de la connexion (jamais le jeton).
 * POST : { action: 'choose', pageId }  → choisir la Page (si plusieurs)
 *        { action: 'disconnect' }      → délier la Page
 *        (Président / SUPER ADMIN uniquement)
 */

export async function GET() {
  try {
    const access = await requireOfficePermission('facebook_view')
    const canManage = Boolean(access.isPresident || access.isSuperAdmin)
    const configured = facebookConfigured()
    const connection = await readConnection()

    return NextResponse.json({
      configured,
      connected: Boolean(connection?.page_id && connection.page_token),
      pageId: connection?.page_id || null,
      pageName: connection?.page_name || null,
      pageUrl: connection?.page_id ? `https://www.facebook.com/${connection.page_id}` : null,
      facebookUser: connection?.facebook_user || null,
      updatedAt: connection?.updated_at || null,
      canManage,
      // Choix de la Page : seulement pour le Président, sans les jetons.
      pendingPages:
        canManage && Array.isArray(connection?.pending_pages)
          ? connection!.pending_pages!.map((page) => ({ id: page.id, name: page.name }))
          : [],
    })
  } catch (error) {
    return facebookErrorResponse(error, 'Impossible de lire la connexion Facebook.')
  }
}

export async function POST(request: Request) {
  try {
    const access = await getOfficeAccess()

    if (!access.authenticated) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    if (!access.authorized || !(access.isPresident || access.isSuperAdmin)) {
      return NextResponse.json({ error: 'Seul le Président peut relier ou délier la Page Facebook.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as any

    if (body?.action === 'disconnect') {
      const connection = await readConnection()
      await deleteConnection()
      await logActivity(
        'Facebook',
        `a délié la Page Facebook${connection?.page_name ? ` « ${connection.page_name} »` : ''}`,
        access
      )
      return NextResponse.json({ ok: true })
    }

    if (body?.action === 'choose') {
      const pageId = String(body.pageId || '')
      const connection = await readConnection()
      const page = (connection?.pending_pages || []).find((item) => item.id === pageId)

      if (!page) {
        throw new FacebookError('Page introuvable : reconnecte Facebook puis choisis à nouveau.', 404)
      }

      await saveConnection({
        page_id: page.id,
        page_name: page.name,
        page_token: page.token,
        pending_pages: null,
        connected_by: access.userId,
      })

      await logActivity('Facebook', `a relié la Page Facebook « ${page.name} »`, access)
      return NextResponse.json({ ok: true, pageName: page.name })
    }

    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
  } catch (error) {
    return facebookErrorResponse(error, 'Impossible de modifier la connexion Facebook.')
  }
}
