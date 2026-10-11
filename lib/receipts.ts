import { DRIVE_FOLDER_MIME, getGoogleAccessToken, readGoogleError } from '@/lib/google-drive';

/*
 * Justificatifs de la trésorerie, rangés dans le Google Drive
 * de l'association :
 *
 *   Mon Drive / Justificatifs / 2026-2027 / <fichiers>
 *
 * À la clôture, le dossier de l'année est déplacé dans
 *   Archives / 2026-2027 / Trésorerie / Justificatifs
 */

export const RECEIPTS_ROOT_NAME = 'Justificatifs';
export const MAX_RECEIPT_SIZE = 30 * 1024 * 1024;

const DRIVE = 'https://www.googleapis.com/drive/v3/files';

function escapeQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function findFolder(token: string, name: string, parentId: string) {
  const url = new URL(DRIVE);
  url.searchParams.set(
    'q',
    `name = '${escapeQuery(name)}' and '${escapeQuery(parentId)}' in parents and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`
  );
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await readGoogleError(response, 'Recherche du dossier impossible dans le Drive.'));
  }

  const data = (await response.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id || null;
}

export async function createFolder(token: string, name: string, parentId: string) {
  const response = await fetch(`${DRIVE}?fields=id&supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: DRIVE_FOLDER_MIME, parents: [parentId] }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await readGoogleError(response, 'Création du dossier impossible dans le Drive.'));
  }

  return ((await response.json()) as { id: string }).id;
}

export async function findOrCreateFolder(token: string, name: string, parentId: string) {
  return (await findFolder(token, name, parentId)) || (await createFolder(token, name, parentId));
}

/* Dossier « Justificatifs / <année> » (créé si besoin). */
export async function receiptYearFolder(token: string, schoolYear: string) {
  const root = await findOrCreateFolder(token, RECEIPTS_ROOT_NAME, 'root');
  return findOrCreateFolder(token, schoolYear, root);
}

/* Dossier « Justificatifs / <année> » s'il existe (sans le créer). */
export async function existingReceiptYearFolder(token: string, schoolYear: string) {
  const root = await findFolder(token, RECEIPTS_ROOT_NAME, 'root');
  return root ? findFolder(token, schoolYear, root) : null;
}

function cleanPart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/*
 * « 2026-10-08 – Dépense – Goûter de Noël – 45,00 €.pdf »
 */
export function receiptFileName(
  tx: { transaction_date: string; transaction_type: string; label: string; amount: number },
  originalName: string
) {
  const extension = (originalName.match(/\.([A-Za-z0-9]{1,6})$/)?.[1] || 'pdf').toLowerCase();
  const kind =
    tx.transaction_type === 'income' ? 'Recette' : tx.transaction_type === 'expense' ? 'Dépense' : 'Mouvement';
  const amount = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(tx.amount || 0))
    .replace(/\s/g, ' ');

  return `${tx.transaction_date} – ${kind} – ${cleanPart(tx.label || 'Sans libellé')} – ${amount} €.${extension}`;
}

/*
 * Ouvre une session d'envoi : le navigateur enverra ensuite
 * le fichier directement à Google (pas de limite Vercel).
 */
export async function createReceiptUploadSession(input: {
  token: string;
  folderId: string;
  name: string;
  mimeType: string;
  size: number;
  origin: string;
}) {
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': input.mimeType,
        'X-Upload-Content-Length': String(input.size),
        Origin: input.origin,
      },
      body: JSON.stringify({ name: input.name, parents: [input.folderId] }),
      cache: 'no-store',
    }
  );

  const uploadUrl = response.headers.get('location');

  if (!response.ok || !uploadUrl) {
    throw new Error(await readGoogleError(response, 'Impossible de préparer l’envoi vers Google Drive.'));
  }

  return uploadUrl;
}

export async function getDriveFile(token: string, fileId: string) {
  const response = await fetch(
    `${DRIVE}/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,webViewLink,parents,trashed`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  );

  if (!response.ok) return null;

  return (await response.json()) as {
    id: string;
    name: string;
    webViewLink?: string;
    parents?: string[];
    trashed?: boolean;
  };
}

export async function findFileByName(token: string, name: string, folderId: string) {
  const url = new URL(DRIVE);
  url.searchParams.set(
    'q',
    `name = '${escapeQuery(name)}' and '${escapeQuery(folderId)}' in parents and trashed = false`
  );
  url.searchParams.set('fields', 'files(id)');
  url.searchParams.set('orderBy', 'createdTime desc');
  url.searchParams.set('pageSize', '1');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id || null;
}

/* Met un fichier à la corbeille du Drive (récupérable 30 jours). */
export async function trashDriveFile(token: string, fileId: string) {
  await fetch(`${DRIVE}/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
    cache: 'no-store',
  }).catch(() => undefined);
}

/*
 * Clôture : déplace « Justificatifs / <année> » dans
 * « Archives / <année> / Trésorerie / Justificatifs ».
 * yearFolderId = dossier de l'année dans Archives.
 */
export async function archiveReceiptFolder(schoolYear: string, yearFolderId: string) {
  const token = await getGoogleAccessToken();
  const source = await existingReceiptYearFolder(token, schoolYear);

  if (!source) return { moved: false, reason: 'Aucun justificatif cette année.' };

  const treasuryFolder = await findOrCreateFolder(token, 'Trésorerie', yearFolderId);
  const current = await getDriveFile(token, source);
  const removeParents = (current?.parents || []).join(',');

  const url = new URL(`${DRIVE}/${encodeURIComponent(source)}`);
  url.searchParams.set('addParents', treasuryFolder);
  if (removeParents) url.searchParams.set('removeParents', removeParents);
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('fields', 'id');

  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Justificatifs' }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await readGoogleError(response, 'Impossible de ranger les justificatifs dans les archives.'));
  }

  return { moved: true };
}

/* Identifiant d'un dossier Drive à partir de son adresse. */
export function folderIdFromUrl(url: string | null | undefined) {
  return url?.match(/folders\/([A-Za-z0-9_-]+)/)?.[1] || url?.match(/[?&]id=([A-Za-z0-9_-]+)/)?.[1] || null;
}
