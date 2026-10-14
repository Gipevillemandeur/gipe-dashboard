import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'
import { logActivity, quote } from '@/lib/activity'
import { driveErrorResponse, getGoogleAccessToken, isValidDriveId } from '@/lib/google-drive'
import {
  MAX_RECEIPT_SIZE,
  createReceiptUploadSession,
  findFileByName,
  getDriveFile,
  receiptFileName,
  receiptYearFolder,
  trashDriveFile,
} from '@/lib/receipts'

/*
 * JUSTIFICATIFS DE LA TRÉSORERIE (rangés dans le Google Drive)
 *
 * POST { action: 'prepare', transactionId, name, mimeType, size }
 *      → adresse d'envoi : le navigateur envoie le fichier
 *        directement à Google.
 * POST { action: 'confirm', transactionId, fileId?, fileName }
 *      → le justificatif est relié à l'opération.
 * POST { action: 'remove', transactionId }
 *      → le fichier part à la corbeille du Drive.
 */

export const maxDuration = 30

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function errorPage(message: string, status: number) {
  // Lien ouvert directement par le navigateur : petite page lisible.
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Justificatif indisponible</title>` +
      `<body style="font-family:system-ui,sans-serif;padding:32px;color:#241c1b">` +
      `<h1 style="font-size:20px">Justificatif indisponible</h1>` +
      `<p>${message.replace(/[<>&]/g, '')}</p>` +
      `<p><a href="/tresorerie" style="color:#8f211c">Retour à la trésorerie</a></p></body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

/*
 * GET ?id=<opération> : affiche le justificatif dans le navigateur.
 * Passe par le compte Google de l'association : il suffit d'avoir
 * le droit « Voir » la trésorerie (pas besoin d'accès au Drive).
 */
export async function GET(request: Request) {
  try {
    await requireOfficePermission('treasury_view')
  } catch {
    return errorPage('Compte non autorisé.', 403)
  }

  const transactionId = new URL(request.url).searchParams.get('id')?.trim()
  if (!transactionId) return errorPage('Opération manquante.', 400)

  try {
    const { data: tx, error } = await createAdminClient()
      .from('gipe_transactions')
      .select('receipt_file_id, receipt_file_name')
      .eq('id', transactionId)
      .maybeSingle()

    if (error) return errorPage(error.message, 500)
    if (!tx?.receipt_file_id || !isValidDriveId(tx.receipt_file_id)) {
      return errorPage('Aucun justificatif pour cette opération.', 404)
    }

    const token = await getGoogleAccessToken()
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(tx.receipt_file_id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )

    if (!driveResponse.ok || !driveResponse.body) {
      return errorPage('Le fichier est introuvable dans le Google Drive.', driveResponse.status || 500)
    }

    const fileName = String(tx.receipt_file_name || 'justificatif')
    const ascii = fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_')

    const headers = new Headers()
    headers.set('Content-Type', driveResponse.headers.get('content-type') || 'application/octet-stream')
    headers.set('Content-Disposition', `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    headers.set('Cache-Control', 'private, no-store')
    headers.set('X-Content-Type-Options', 'nosniff')
    const length = driveResponse.headers.get('content-length')
    if (length) headers.set('Content-Length', length)

    return new NextResponse(driveResponse.body, { status: 200, headers })
  } catch (error) {
    console.error('Erreur affichage justificatif:', error)
    return errorPage('Impossible d’afficher le justificatif.', 500)
  }
}

export async function POST(request: Request) {
  try {
    await requireOfficePermission('treasury')
  } catch (error) {
    return driveErrorResponse(error, 'Compte non autorisé.')
  }

  const admin = createAdminClient()
  const body = (await request.json().catch(() => null)) as any
  const transactionId = String(body?.transactionId || '').trim()

  if (!transactionId) return fail('Opération manquante.')

  try {
    const { data: tx, error } = await admin
      .from('gipe_transactions')
      .select('*, school_years(label,is_active)')
      .eq('id', transactionId)
      .maybeSingle()

    if (error) return fail(error.message, 500)
    if (!tx) return fail('Opération introuvable.', 404)

    const year = Array.isArray(tx.school_years) ? tx.school_years[0] : tx.school_years

    if (!year?.is_active) {
      return fail('Cette opération appartient à une année clôturée : ses justificatifs sont archivés.', 409)
    }

    const token = await getGoogleAccessToken()

    if (body.action === 'prepare') {
      const size = Number(body.size)
      const mimeType = String(body.mimeType || 'application/octet-stream')

      if (!Number.isFinite(size) || size <= 0) return fail('Le fichier est vide.')
      if (size > MAX_RECEIPT_SIZE) return fail('Le justificatif dépasse 30 Mo.')

      const folderId = await receiptYearFolder(token, year.label)
      const fileName = receiptFileName(tx, String(body.name || 'justificatif.pdf'))

      const uploadUrl = await createReceiptUploadSession({
        token,
        folderId,
        name: fileName,
        mimeType,
        size,
        origin: new URL(request.url).origin,
      })

      return NextResponse.json({ uploadUrl, fileName })
    }

    if (body.action === 'confirm') {
      const folderId = await receiptYearFolder(token, year.label)

      let fileId = String(body.fileId || '').trim()

      // Si le navigateur n'a pas pu lire la réponse de Google,
      // on retrouve le fichier par son nom.
      if (!isValidDriveId(fileId)) {
        fileId = (await findFileByName(token, String(body.fileName || ''), folderId)) || ''
      }

      const file = isValidDriveId(fileId) ? await getDriveFile(token, fileId) : null

      if (!file || file.trashed || !(file.parents || []).includes(folderId)) {
        return fail('Le justificatif n’a pas été retrouvé dans le Drive. Réessaie l’envoi.', 404)
      }

      // Ancien justificatif remplacé → corbeille.
      if (tx.receipt_file_id && tx.receipt_file_id !== file.id) {
        await trashDriveFile(token, tx.receipt_file_id)
      }

      const { error: updateError } = await admin
        .from('gipe_transactions')
        .update({
          receipt_file_id: file.id,
          receipt_file_name: file.name,
          receipt_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        })
        .eq('id', transactionId)

      if (updateError) {
        return fail(
          updateError.message.includes('receipt_')
            ? 'Lance d’abord migration_tresorerie_v3.sql dans Supabase.'
            : updateError.message,
          500
        )
      }

      await logActivity('Trésorerie', `a joint un justificatif à ${quote(tx.label)}`)

      return NextResponse.json({
        ok: true,
        receipt: {
          fileId: file.id,
          name: file.name,
          url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        },
      })
    }

    if (body.action === 'remove') {
      if (tx.receipt_file_id) {
        await trashDriveFile(token, tx.receipt_file_id)
      }

      const { error: updateError } = await admin
        .from('gipe_transactions')
        .update({ receipt_file_id: null, receipt_file_name: null, receipt_url: null })
        .eq('id', transactionId)

      if (updateError) return fail(updateError.message, 500)

      await logActivity('Trésorerie', `a retiré le justificatif de ${quote(tx.label)}`)

      return NextResponse.json({ ok: true })
    }

    return fail('Action inconnue.')
  } catch (error) {
    return driveErrorResponse(error, 'Opération impossible sur le justificatif.')
  }
}
