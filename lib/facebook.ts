import { createHmac } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/*
 * PAGE FACEBOOK DE L'ASSOCIATION
 *
 * - Une seule Page reliée pour tout le dashboard (table
 *   gipe_facebook_connection, lisible uniquement par le serveur).
 * - Le Président la relie avec « Connecter Facebook » : on garde un
 *   jeton de Page « durable » (il n'expire pas tant que le Président
 *   reste administrateur de la Page et ne change pas son mot de passe).
 *
 * Variables Vercel :
 *   FACEBOOK_APP_ID, FACEBOOK_APP_SECRET   (obligatoires)
 *   FACEBOOK_CONFIG_ID                     (si l'app utilise « Facebook Login for Business »)
 *   FACEBOOK_GRAPH_VERSION                 (facultatif, ex. v25.0)
 */

export const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v25.0'
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

export const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'business_management',
]

// Programmation : au moins 10 min à l'avance, au plus 6 mois (règles Facebook).
export const MIN_SCHEDULE_MINUTES = 10
export const MAX_SCHEDULE_DAYS = 180

export const MAX_PHOTO_SIZE = 4 * 1024 * 1024
export const MAX_MESSAGE_LENGTH = 5000

export type PendingPage = { id: string; name: string; token: string }

export type FacebookConnection = {
  page_id: string | null
  page_name: string | null
  page_token: string | null
  facebook_user: string | null
  pending_pages: PendingPage[] | null
  updated_at: string | null
}

export function facebookConfigured() {
  return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)
}

/*
 * Preuve de sécurité demandée par Facebook quand l'option
 * « Exiger la clé secrète » est activée dans l'application.
 */
export function appSecretProof(token: string) {
  const secret = process.env.FACEBOOK_APP_SECRET || ''
  return createHmac('sha256', secret).update(token).digest('hex')
}

export class FacebookError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/*
 * Traduit les erreurs de Facebook en phrases compréhensibles.
 */
export function translateGraphError(error: any): string {
  const code = Number(error?.code)
  const sub = Number(error?.error_subcode)
  const message = String(error?.message || '')

  if (code === 190 || sub === 463 || sub === 460) {
    return 'La connexion à Facebook a expiré (mot de passe changé ou droits retirés). Le Président doit cliquer sur « Reconnecter Facebook ».'
  }
  if (code === 10 || code === 200 || (code >= 200 && code < 300)) {
    return 'Facebook refuse : l’autorisation de publier sur la Page manque. Le Président doit reconnecter Facebook en acceptant toutes les autorisations.'
  }
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return 'Facebook limite le nombre de demandes : réessaie dans quelques minutes.'
  }
  if (/scheduled_publish_time|scheduled publish time/i.test(message)) {
    return 'Facebook refuse cette date de programmation : choisis une date au moins 10 minutes après maintenant, et pas trop lointaine.'
  }
  if (code === 324 || /image|photo|url/i.test(message) && code === 100) {
    return 'Facebook n’a pas pu lire la photo. Essaie avec une autre image (JPG ou PNG).'
  }
  if (code === 368) {
    return 'Facebook a bloqué cette publication (contenu jugé suspect). Modifie le texte ou réessaie plus tard.'
  }
  if (code === 506) {
    return 'Facebook refuse : cette publication est identique à une publication récente.'
  }

  return message
    ? `Facebook a répondu : ${message}`
    : 'Facebook n’a pas répondu correctement. Réessaie dans un moment.'
}

/*
 * Appel à Facebook (Graph API) avec un jeton donné.
 */
export async function graph<T = any>(
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE'
    params?: Record<string, string>
    body?: FormData | URLSearchParams
  } = {}
): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${GRAPH}${path}`)

  for (const [key, value] of Object.entries(options.params || {})) {
    url.searchParams.set(key, value)
  }

  url.searchParams.set('access_token', token)
  if (process.env.FACEBOOK_APP_SECRET) {
    url.searchParams.set('appsecret_proof', appSecretProof(token))
  }

  let response: Response

  try {
    response = await fetch(url.toString(), {
      method: options.method || 'GET',
      body: options.body,
      cache: 'no-store',
    })
  } catch {
    throw new FacebookError('Impossible de joindre Facebook. Vérifie la connexion internet et réessaie.', 502)
  }

  const data = (await response.json().catch(() => ({}))) as any

  if (!response.ok || data?.error) {
    console.error('Erreur Facebook:', JSON.stringify(data?.error || data))
    const code = Number(data?.error?.code)
    throw new FacebookError(translateGraphError(data?.error), code === 190 ? 401 : 400)
  }

  return data as T
}

/* ------------------------------------------------------------------ */
/* Connexion enregistrée                                               */
/* ------------------------------------------------------------------ */

export async function readConnection(): Promise<FacebookConnection | null> {
  const { data, error } = await createAdminClient()
    .from('gipe_facebook_connection')
    .select('page_id, page_name, page_token, facebook_user, pending_pages, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    if (/gipe_facebook_connection/.test(error.message)) {
      throw new FacebookError('Lance d’abord migration_facebook_v1.sql dans Supabase.', 500)
    }
    throw new FacebookError(error.message, 500)
  }

  return (data as FacebookConnection | null) || null
}

export async function saveConnection(values: Partial<FacebookConnection> & { connected_by?: string | null }) {
  const { error } = await createAdminClient()
    .from('gipe_facebook_connection')
    .upsert({ id: 1, ...values, updated_at: new Date().toISOString() }, { onConflict: 'id' })

  if (error) {
    throw new FacebookError(
      /gipe_facebook_connection/.test(error.message)
        ? 'Lance d’abord migration_facebook_v1.sql dans Supabase.'
        : error.message,
      500
    )
  }
}

export async function deleteConnection() {
  const { error } = await createAdminClient().from('gipe_facebook_connection').delete().eq('id', 1)
  if (error) throw new FacebookError(error.message, 500)
}

/*
 * Page reliée + son jeton (pour publier / lire).
 */
export async function requirePage(): Promise<{ pageId: string; pageName: string; token: string }> {
  if (!facebookConfigured()) {
    throw new FacebookError('Facebook n’est pas encore configuré (codes de l’application à ajouter dans Vercel).', 503)
  }

  const connection = await readConnection()

  if (!connection?.page_id || !connection.page_token) {
    throw new FacebookError('Aucune Page Facebook n’est reliée. Le Président doit cliquer sur « Connecter Facebook ».', 409)
  }

  return {
    pageId: connection.page_id,
    pageName: connection.page_name || 'Page Facebook',
    token: connection.page_token,
  }
}

/* ------------------------------------------------------------------ */
/* Réponses d'erreur                                                   */
/* ------------------------------------------------------------------ */

export function facebookErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === 'AUTHENTICATION_REQUIRED') {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    if (error.message === 'OFFICE_ACCESS_DENIED' || error.message === 'OFFICE_PERMISSION_DENIED') {
      return NextResponse.json({ error: 'Compte non autorisé.' }, { status: 403 })
    }
  }

  if (error instanceof FacebookError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

/* ------------------------------------------------------------------ */
/* Contrôles                                                           */
/* ------------------------------------------------------------------ */

/*
 * Photo désignée par une adresse : seulement les images publiques
 * du stockage Supabase du GIPE (actualités, agenda).
 */
export function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value)
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : ''
    return (
      url.protocol === 'https:' &&
      Boolean(supabase) &&
      url.host === supabase &&
      url.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
}

/*
 * Date de programmation → horodatage Unix, ou message d'erreur.
 */
export function checkScheduleDate(value: string, now = Date.now()): { unix: number } | { error: string } {
  const time = new Date(value).getTime()

  if (!Number.isFinite(time)) return { error: 'La date de programmation est invalide.' }
  if (time < now + MIN_SCHEDULE_MINUTES * 60 * 1000) {
    return { error: `La publication doit être programmée au moins ${MIN_SCHEDULE_MINUTES} minutes à l’avance.` }
  }
  if (time > now + MAX_SCHEDULE_DAYS * 24 * 3600 * 1000) {
    return { error: 'Facebook ne permet pas de programmer à plus de 6 mois.' }
  }

  return { unix: Math.floor(time / 1000) }
}
