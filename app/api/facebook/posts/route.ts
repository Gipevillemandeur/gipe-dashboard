import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import { logActivity, quote } from '@/lib/activity'
import {
  FacebookError,
  MAX_MESSAGE_LENGTH,
  MAX_PHOTO_SIZE,
  checkScheduleDate,
  facebookErrorResponse,
  graph,
  isAllowedImageUrl,
  requirePage,
} from '@/lib/facebook'

/*
 * PUBLICATIONS DE LA PAGE FACEBOOK
 *
 * GET    → { scheduled: [...], published: [...] }          (Facebook : Voir)
 * POST   → FormData : message, imageFile? | imageUrl?,
 *          scheduledAt? (date ISO), source? (journal)          (Facebook : Modifier)
 * DELETE → ?id=…  supprime une publication (programmée ou en ligne)
 */

export const maxDuration = 30

type GraphPost = {
  id: string
  message?: string
  created_time?: string
  scheduled_publish_time?: number | string
  permalink_url?: string
  full_picture?: string
  reactions?: { summary?: { total_count?: number } }
  comments?: { summary?: { total_count?: number } }
  shares?: { count?: number }
}

function toPost(item: GraphPost) {
  const scheduled =
    item.scheduled_publish_time !== undefined && item.scheduled_publish_time !== null
      ? new Date(
          typeof item.scheduled_publish_time === 'number'
            ? item.scheduled_publish_time * 1000
            : String(item.scheduled_publish_time)
        ).toISOString()
      : null

  return {
    id: item.id,
    message: item.message || '',
    createdAt: item.created_time || null,
    scheduledAt: scheduled,
    url: item.permalink_url || null,
    picture: item.full_picture || null,
    reactions: item.reactions?.summary?.total_count ?? null,
    comments: item.comments?.summary?.total_count ?? null,
    shares: item.shares?.count ?? null,
  }
}

const BASE_FIELDS = 'id,message,created_time,permalink_url,full_picture'
const ENGAGEMENT_FIELDS =
  ',reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares'

export async function GET() {
  try {
    await requireOfficePermission('facebook_view')
    const page = await requirePage()

    const [scheduled, published] = await Promise.all([
      graph<{ data?: GraphPost[] }>(`/${page.pageId}/scheduled_posts`, page.token, {
        params: { fields: `${BASE_FIELDS},scheduled_publish_time`, limit: '25' },
      }).catch((error) => {
        console.error('Publications programmées :', error)
        return { data: [] as GraphPost[] }
      }),

      // Avec les « J'aime » / commentaires ; sans, si Facebook les refuse.
      graph<{ data?: GraphPost[] }>(`/${page.pageId}/published_posts`, page.token, {
        params: { fields: BASE_FIELDS + ENGAGEMENT_FIELDS, limit: '10' },
      }).catch(() =>
        graph<{ data?: GraphPost[] }>(`/${page.pageId}/published_posts`, page.token, {
          params: { fields: BASE_FIELDS, limit: '10' },
        })
      ),
    ])

    const scheduledPosts = (scheduled.data || [])
      .map(toPost)
      .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))

    return NextResponse.json({
      pageName: page.pageName,
      scheduled: scheduledPosts,
      published: (published.data || []).map(toPost),
    })
  } catch (error) {
    return facebookErrorResponse(error, 'Impossible de lire les publications Facebook.')
  }
}

export async function POST(request: Request) {
  try {
    await requireOfficePermission('facebook')
    const page = await requirePage()

    const form = await request.formData().catch(() => null)
    if (!form) throw new FacebookError('Demande invalide.')

    const message = String(form.get('message') || '').trim()
    const imageFile = form.get('imageFile')
    const imageUrl = String(form.get('imageUrl') || '').trim()
    const scheduledAt = String(form.get('scheduledAt') || '').trim()
    const source = String(form.get('source') || '').trim()

    const hasFile = imageFile instanceof File && imageFile.size > 0

    if (!message && !hasFile && !imageUrl) {
      throw new FacebookError('Écris un texte ou ajoute une photo.')
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new FacebookError(`Le texte est trop long (${MAX_MESSAGE_LENGTH} caractères au maximum).`)
    }

    let scheduleUnix: number | null = null
    if (scheduledAt) {
      const checked = checkScheduleDate(scheduledAt)
      if ('error' in checked) throw new FacebookError(checked.error)
      scheduleUnix = checked.unix
    }

    const body = new FormData()
    if (message) body.set('message', message)

    if (scheduleUnix) {
      body.set('published', 'false')
      body.set('scheduled_publish_time', String(scheduleUnix))
    }

    let endpoint = `/${page.pageId}/feed`

    if (hasFile) {
      const file = imageFile as File
      if (!file.type.startsWith('image/')) throw new FacebookError('Le fichier doit être une photo.')
      if (file.size > MAX_PHOTO_SIZE) throw new FacebookError('La photo est trop lourde (4 Mo au maximum).')
      body.set('source', new Blob([await file.arrayBuffer()], { type: file.type }), file.name || 'photo.jpg')
      endpoint = `/${page.pageId}/photos`
    } else if (imageUrl) {
      if (!isAllowedImageUrl(imageUrl)) throw new FacebookError('Adresse de la photo non autorisée.')
      body.set('url', imageUrl)
      endpoint = `/${page.pageId}/photos`
    }

    const result = await graph<{ id?: string; post_id?: string }>(endpoint, page.token, {
      method: 'POST',
      body,
    })

    const excerpt = quote(message || 'photo', 50)
    const from = source ? ` (${source})` : ''

    await logActivity(
      'Facebook',
      scheduleUnix
        ? `a programmé sur Facebook ${excerpt}${from} pour le ${new Date(scheduleUnix * 1000).toLocaleString('fr-FR', {
            timeZone: 'Europe/Paris',
            dateStyle: 'short',
            timeStyle: 'short',
          })}`
        : `a publié sur Facebook ${excerpt}${from}`
    )

    return NextResponse.json(
      { ok: true, id: result.post_id || result.id || null, scheduled: Boolean(scheduleUnix) },
      { status: 201 }
    )
  } catch (error) {
    return facebookErrorResponse(error, 'Impossible de publier sur Facebook.')
  }
}

export async function DELETE(request: Request) {
  try {
    await requireOfficePermission('facebook')
    const page = await requirePage()

    const id = new URL(request.url).searchParams.get('id')?.trim() || ''

    // Identifiant Facebook : chiffres, éventuellement « page_post ».
    if (!/^\d+(_\d+)?$/.test(id)) throw new FacebookError('Publication invalide.')

    // Sécurité : seulement les publications de NOTRE Page.
    if (id.includes('_') && !id.startsWith(`${page.pageId}_`)) {
      throw new FacebookError('Cette publication n’appartient pas à la Page du GIPE.', 403)
    }

    let message = ''
    try {
      const post = await graph<GraphPost>(`/${id}`, page.token, { params: { fields: 'message' } })
      message = post.message || ''
    } catch {
      // Pas grave : on supprime quand même.
    }

    await graph(`/${id}`, page.token, { method: 'DELETE' })

    await logActivity('Facebook', `a supprimé la publication Facebook ${quote(message || id, 50)}`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return facebookErrorResponse(error, 'Impossible de supprimer la publication Facebook.')
  }
}
