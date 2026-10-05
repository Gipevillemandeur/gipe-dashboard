import type { SupabaseClient } from '@supabase/supabase-js'
import { buildInstanceMeetingPdf } from '@/lib/instance-meeting-pdf'

const DRIVE_BUCKET = 'instance-documents'

type InstanceMeetingArchiveResult = {
  meetingId: string
  schoolYear: string
  instanceFolderName: string
  ficheFileName: string
  archivedDocuments: Array<{
    fileName: string
    fileId?: string
    fileUrl?: string
  }>
  ficheFileId?: string
  ficheFileUrl?: string
}

type MeetingRow = {
  id: string
  school_year_id: string
  type: string
  subject: string
  meeting_date: string
  meeting_time: string | null
  location: string | null
  summary: string | null
}

type MeetingDocumentRow = {
  id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
}

function sanitizeFileNamePart(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatMeetingFolderName(
  meeting: MeetingRow
) {
  const dateParts = meeting.meeting_date.split('-')

  let formattedDate = meeting.meeting_date

  if (dateParts.length === 3) {
    formattedDate =
      `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
  }

  const type = sanitizeFileNamePart(meeting.type)
  const subject = sanitizeFileNamePart(meeting.subject)

  return [
    formattedDate,
    type,
    subject,
  ]
    .filter(Boolean)
    .join(' - ')
    .slice(0, 180)
}

function getDriveConfiguration() {
  const scriptUrl =
    process.env.GOOGLE_DRIVE_APPS_SCRIPT_URL?.trim()

  const token =
    process.env.GOOGLE_DRIVE_APPS_SCRIPT_TOKEN?.trim()

  if (!scriptUrl || !token) {
    throw new Error(
      'La connexion Google Drive n’est pas configurée dans Vercel.'
    )
  }

  return {
    scriptUrl,
    token,
  }
}

async function uploadFileToDrive({
  scriptUrl,
  token,
  schoolYear,
  instanceFolderName,
  fileName,
  mimeType,
  bytes,
}: {
  scriptUrl: string
  token: string
  schoolYear: string
  instanceFolderName: string
  fileName: string
  mimeType: string
  bytes: Uint8Array
}) {
  const base64 =
    Buffer.from(bytes).toString('base64')

  const response = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'upload_instance_file',
      token,
      schoolYear,
      instanceFolderName,
      fileName,
      mimeType,
      base64,
    }),
    cache: 'no-store',
  })

  const responseText =
    await response.text()

  let result: any

  try {
    result = JSON.parse(responseText)
  } catch {
    throw new Error(
      `Réponse Apps Script inattendue pour "${fileName}" (HTTP ${response.status}).`
    )
  }

  if (!response.ok || !result?.ok) {
    throw new Error(
      result?.error ||
        `Archivage Drive impossible pour "${fileName}" (HTTP ${response.status}).`
    )
  }

  return result
}

/**
 * Archive une réunion complète dans Google Drive.
 *
 * Cette fonction :
 * - récupère la réunion ;
 * - récupère son année scolaire ;
 * - récupère tous ses documents ;
 * - génère la fiche PDF ;
 * - archive la fiche PDF ;
 * - télécharge puis archive chaque document réel ;
 *
 * Elle ne supprime et ne modifie aucune donnée Supabase.
 */
export async function archiveInstanceMeeting(
  admin: SupabaseClient,
  meetingId: string
): Promise<InstanceMeetingArchiveResult> {
  if (!meetingId) {
    throw new Error(
      'Identifiant de réunion manquant.'
    )
  }

  const {
    scriptUrl,
    token,
  } = getDriveConfiguration()

  // ------------------------------------------------------------
  // 1. Récupération de la réunion
  // ------------------------------------------------------------

  const {
    data: meeting,
    error: meetingError,
  } = await admin
    .from('instance_meetings')
    .select(
      `
        id,
        school_year_id,
        type,
        subject,
        meeting_date,
        meeting_time,
        location,
        summary
      `
    )
    .eq('id', meetingId)
    .maybeSingle()

  if (meetingError) {
    throw new Error(
      `Impossible de récupérer la réunion : ${meetingError.message}`
    )
  }

  if (!meeting) {
    throw new Error(
      'Réunion introuvable.'
    )
  }

  const meetingData =
    meeting as MeetingRow

  // ------------------------------------------------------------
  // 2. Année scolaire
  // ------------------------------------------------------------

  const {
    data: schoolYear,
    error: schoolYearError,
  } = await admin
    .from('school_years')
    .select('id,label')
    .eq(
      'id',
      meetingData.school_year_id
    )
    .maybeSingle()

  if (schoolYearError) {
    throw new Error(
      `Impossible de récupérer l’année scolaire : ${schoolYearError.message}`
    )
  }

  if (!schoolYear) {
    throw new Error(
      'Année scolaire introuvable.'
    )
  }

  // ------------------------------------------------------------
  // 3. Documents associés
  // ------------------------------------------------------------

  const {
    data: documents,
    error: documentsError,
  } = await admin
    .from('instance_meeting_documents')
    .select(
      `
        id,
        file_name,
        file_url,
        file_type,
        file_size
      `
    )
    .eq(
      'meeting_id',
      meetingId
    )
    .order(
      'created_at',
      {
        ascending: true,
      }
    )

  if (documentsError) {
    throw new Error(
      `Impossible de récupérer les documents associés : ${documentsError.message}`
    )
  }

  const meetingDocuments =
    (documents || []) as MeetingDocumentRow[]

  // ------------------------------------------------------------
  // 4. Préparation du nom du dossier Drive
  // ------------------------------------------------------------

  const instanceFolderName =
    formatMeetingFolderName(
      meetingData
    )

  if (!instanceFolderName) {
    throw new Error(
      'Impossible de déterminer le nom du dossier de réunion.'
    )
  }

  // ------------------------------------------------------------
  // 5. Génération de la fiche de réunion
  // ------------------------------------------------------------

  const fichePdf =
    await buildInstanceMeetingPdf({
      schoolYear: schoolYear.label,
      type: meetingData.type,
      subject: meetingData.subject,
      meetingDate: meetingData.meeting_date,
      meetingTime: meetingData.meeting_time,
      location: meetingData.location,
      summary: meetingData.summary,
      documents:
        meetingDocuments.map(
          (document) => ({
            fileName:
              document.file_name,
          })
        ),
    })

  const ficheFileName =
    'Fiche-reunion.pdf'

  // ------------------------------------------------------------
  // 6. Archivage de la fiche PDF
  // ------------------------------------------------------------

  const ficheResult =
    await uploadFileToDrive({
      scriptUrl,
      token,
      schoolYear:
        schoolYear.label,
      instanceFolderName,
      fileName:
        ficheFileName,
      mimeType:
        'application/pdf',
      bytes: fichePdf,
    })

  // ------------------------------------------------------------
  // 7. Archivage des documents réels
  // ------------------------------------------------------------

  const archivedDocuments: Array<{
    fileName: string
    fileId?: string
    fileUrl?: string
  }> = []

  for (const document of meetingDocuments) {
    if (!document.file_url) {
      throw new Error(
        `Le chemin de stockage du document "${document.file_name}" est vide.`
      )
    }

    /*
     * Les documents sont dans le bucket privé
     * "instance-documents".
     *
     * file_url contient le chemin Storage,
     * pas une URL publique.
     */
    const {
      data: fileBlob,
      error: downloadError,
    } = await admin.storage
      .from(DRIVE_BUCKET)
      .download(
        document.file_url
      )

    if (downloadError) {
      throw new Error(
        `Impossible de récupérer "${document.file_name}" depuis le stockage : ${downloadError.message}`
      )
    }

    if (!fileBlob) {
      throw new Error(
        `Le fichier "${document.file_name}" est vide ou introuvable.`
      )
    }

    const arrayBuffer =
      await fileBlob.arrayBuffer()

    const bytes =
      new Uint8Array(arrayBuffer)

    const mimeType =
      document.file_type ||
      fileBlob.type ||
      'application/octet-stream'

    const result =
      await uploadFileToDrive({
        scriptUrl,
        token,
        schoolYear:
          schoolYear.label,
        instanceFolderName,
        fileName:
          document.file_name,
        mimeType,
        bytes,
      })

    archivedDocuments.push({
      fileName:
        document.file_name,
      fileId:
        result.fileId,
      fileUrl:
        result.fileUrl,
    })
  }

  // ------------------------------------------------------------
  // 8. Résultat
  // ------------------------------------------------------------

  return {
    meetingId,
    schoolYear:
      schoolYear.label,
    instanceFolderName,
    ficheFileName,
    ficheFileId:
      ficheResult.fileId,
    ficheFileUrl:
      ficheResult.fileUrl,
    archivedDocuments,
  }
}
