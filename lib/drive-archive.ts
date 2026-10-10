/*
 * Envoi d'un fichier d'archive de fin d'année vers le Drive,
 * via le script Google (action « upload_year_file »).
 *
 * Archives/
 *   2026-2027/
 *     Bilan-annuel-GIPE-2026-2027.pdf      (subFolder vide)
 *     Adhérents/...                        (subFolder 'Adhérents')
 *     Trésorerie/...                       (subFolder 'Trésorerie')
 */

type UploadResult = {
  fileId?: string;
  fileUrl?: string;
  yearFolderUrl?: string;
};

export async function uploadYearFile({
  schoolYear,
  subFolder,
  fileName,
  mimeType,
  bytes,
}: {
  schoolYear: string;
  subFolder: '' | 'Adhérents' | 'Trésorerie';
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<UploadResult> {
  const scriptUrl = process.env.GOOGLE_DRIVE_APPS_SCRIPT_URL?.trim();
  const token = process.env.GOOGLE_DRIVE_APPS_SCRIPT_TOKEN?.trim();

  if (!scriptUrl || !token) {
    throw new Error(
      'La connexion Google Drive n’est pas configurée dans Vercel (GOOGLE_DRIVE_APPS_SCRIPT_URL / GOOGLE_DRIVE_APPS_SCRIPT_TOKEN).'
    );
  }

  const response = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upload_year_file',
      token,
      schoolYear,
      subFolder,
      fileName,
      mimeType,
      base64: Buffer.from(bytes).toString('base64'),
    }),
    cache: 'no-store',
  });

  const text = await response.text();
  let result: any;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(
      `Réponse inattendue du script Google pour « ${fileName} » (HTTP ${response.status}).`
    );
  }

  if (!response.ok || !result?.ok) {
    const message = String(result?.error || '');

    throw new Error(
      message === 'Action inconnue.'
        ? 'Le script Google n’a pas encore été mis à jour (action « upload_year_file » inconnue). Colle la nouvelle version du script et republie-le.'
        : message || `Archivage Drive impossible pour « ${fileName} ».`
    );
  }

  return {
    fileId: result.fileId,
    fileUrl: result.fileUrl,
    yearFolderUrl: result.yearFolderUrl,
  };
}

export const PDF = 'application/pdf';
export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
