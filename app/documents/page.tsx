'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Cloud,
  Download,
  File,
  FileText,
  Folder,
  FolderOpen,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
};

function formatFileSize(size?: string) {
  if (!size) return '';

  const bytes = Number(size);

  if (!Number.isFinite(bytes)) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} o`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} Ko`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

function formatDate(date?: string) {
  if (!date) return '';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

/*
 * Fichiers Google qu'on sait convertir pour le téléchargement
 * (Docs → Word, Sheets → Excel, Slides → PowerPoint, Dessin → PDF).
 */
const EXPORTABLE_GOOGLE_TYPES = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
]);

function isDownloadable(mimeType: string) {
  return (
    !mimeType.startsWith('application/vnd.google-apps.') ||
    EXPORTABLE_GOOGLE_TYPES.has(mimeType)
  );
}

// Lit la réponse JSON sans planter si le serveur renvoie autre chose.
async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// Messages affichés au retour de la connexion Google.
const GOOGLE_NOTICES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Google Drive est bien connecté.' },
  cancelled: { ok: false, text: 'Connexion à Google annulée.' },
  forbidden: { ok: false, text: 'Seul le Président peut connecter le Google Drive.' },
  invalid_state: { ok: false, text: 'La connexion a expiré ou a été interrompue. Réessaie.' },
  no_refresh_token: {
    ok: false,
    text: 'Google n’a pas donné d’accès durable. Réessaie la connexion.',
  },
  config_error: {
    ok: false,
    text: 'Configuration Google manquante sur Vercel (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
  },
  token_error: { ok: false, text: 'Google a refusé la connexion. Réessaie.' },
  save_error: { ok: false, text: 'La connexion n’a pas pu être enregistrée. Réessaie.' },
  error: { ok: false, text: 'Erreur pendant la connexion à Google. Réessaie.' },
};

type DriveConnection = {
  connected: boolean;
  email: string | null;
  canManage: boolean;
};

/*
 * Envoi direct du fichier du navigateur vers Google,
 * avec suivi de la progression.
 */
function sendFileToGoogle(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; networkError: boolean }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader(
      'Content-Type',
      file.type || 'application/octet-stream'
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        networkError: false,
      });

    xhr.onerror = () => resolve({ ok: false, networkError: true });

    xhr.send(file);
  });
}

// Envoi « de secours » par le serveur : petits fichiers seulement.
const SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024;

export default function DocumentsPage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [currentFolderId, setCurrentFolderId] =
    useState('root');

  const [currentFolderName, setCurrentFolderName] =
    useState('Mon Drive');

  const [folderHistory, setFolderHistory] = useState<
    { id: string; name: string }[]
  >([]);

  const [showCreateFolder, setShowCreateFolder] =
    useState(false);

  const [newFolderName, setNewFolderName] =
    useState('');

  const [creatingFolder, setCreatingFolder] =
    useState(false);

  const [createFolderError, setCreateFolderError] =
    useState('');

  const [uploadingFile, setUploadingFile] =
    useState(false);

  const [uploadError, setUploadError] =
    useState('');

  const [uploadSuccess, setUploadSuccess] =
    useState('');

  const [deletingItem, setDeletingItem] =
    useState<DriveFile | null>(null);

  const [deleting, setDeleting] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState('');

  const [uploadProgress, setUploadProgress] =
    useState<number | null>(null);

  const [connection, setConnection] =
    useState<DriveConnection | null>(null);

  const [driveNotConnected, setDriveNotConnected] =
    useState(false);

  const [notice, setNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  async function loadConnection() {
    try {
      const response = await fetch(
        '/api/google/drive/status',
        { cache: 'no-store' }
      );

      if (response.ok) {
        setConnection(await readJson(response));
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadFiles(
    folderId = currentFolderId
  ) {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `/api/google/drive/files?folderId=${encodeURIComponent(
          folderId
        )}`,
        {
          cache: 'no-store',
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        setDriveNotConnected(
          data?.code === 'DRIVE_NOT_CONNECTED'
        );

        throw new Error(
          data?.error ||
            'Impossible de récupérer les fichiers.'
        );
      }

      setDriveNotConnected(false);
      setFiles(data.files || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de récupérer les fichiers.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles('root');
    loadConnection();

    /*
     * Retour de Google après une connexion :
     * on affiche le message puis on nettoie l'adresse.
     */
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');

    if (google) {
      setNotice(
        GOOGLE_NOTICES[google] || GOOGLE_NOTICES.error
      );
      window.history.replaceState(null, '', '/documents');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openFolder(folder: DriveFile) {
    setFolderHistory((previous) => [
      ...previous,
      {
        id: currentFolderId,
        name: currentFolderName,
      },
    ]);

    setCurrentFolderId(folder.id);
    setCurrentFolderName(folder.name);
    setSearch('');
    setUploadError('');
    setUploadSuccess('');

    loadFiles(folder.id);
  }

  function goBack() {
    const previous =
      folderHistory[
        folderHistory.length - 1
      ];

    if (!previous) return;

    setFolderHistory((history) =>
      history.slice(0, -1)
    );

    setCurrentFolderId(previous.id);
    setCurrentFolderName(previous.name);
    setSearch('');
    setUploadError('');
    setUploadSuccess('');

    loadFiles(previous.id);
  }

  function goToHistory(index: number) {
    const target = folderHistory[index];

    if (!target) return;

    if (index === 0) {
      goToRoot();
      return;
    }

    setFolderHistory((history) =>
      history.slice(0, index)
    );

    setCurrentFolderId(target.id);
    setCurrentFolderName(target.name);
    setSearch('');
    setUploadError('');
    setUploadSuccess('');

    loadFiles(target.id);
  }

  function goToRoot() {
    setCurrentFolderId('root');
    setCurrentFolderName('Mon Drive');
    setFolderHistory([]);
    setSearch('');
    setUploadError('');
    setUploadSuccess('');

    loadFiles('root');
  }

  function openCreateFolder() {
    setNewFolderName('');
    setCreateFolderError('');
    setShowCreateFolder(true);
  }

  function closeCreateFolder() {
    if (creatingFolder) return;

    setShowCreateFolder(false);
    setNewFolderName('');
    setCreateFolderError('');
  }

  async function createFolder() {
    const name = newFolderName.trim();

    if (!name) {
      setCreateFolderError(
        'Le nom du dossier est obligatoire.'
      );
      return;
    }

    try {
      setCreatingFolder(true);
      setCreateFolderError('');

      const response = await fetch(
        '/api/google/drive/folders',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name,
            parentId: currentFolderId,
          }),
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de créer le dossier.'
        );
      }

      setShowCreateFolder(false);
      setNewFolderName('');
      setCreateFolderError('');

      await loadFiles(currentFolderId);
    } catch (err) {
      console.error(err);

      setCreateFolderError(
        err instanceof Error
          ? err.message
          : 'Impossible de créer le dossier.'
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  function openFilePicker() {
    setUploadError('');
    setUploadSuccess('');

    fileInputRef.current?.click();
  }

  async function uploadFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    if (file.size === 0) {
      setUploadError('Le fichier est vide.');
      return;
    }

    try {
      setUploadingFile(true);
      setUploadProgress(0);
      setUploadError('');
      setUploadSuccess('');

      /*
       * 1) Le serveur ouvre une session d'envoi chez Google.
       */
      const prepareResponse = await fetch(
        '/api/google/drive/upload',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'prepare',
            name: file.name,
            mimeType:
              file.type ||
              'application/octet-stream',
            size: file.size,
            parentId: currentFolderId,
          }),
        }
      );

      const prepared = await readJson(prepareResponse);

      if (!prepareResponse.ok || !prepared?.uploadUrl) {
        if (prepared?.code === 'DRIVE_NOT_CONNECTED') {
          setDriveNotConnected(true);
        }

        throw new Error(
          prepared?.error ||
            'Impossible de préparer l’envoi du fichier.'
        );
      }

      /*
       * 2) Le navigateur envoie le fichier directement à Google.
       */
      const direct = await sendFileToGoogle(
        prepared.uploadUrl,
        file,
        setUploadProgress
      );

      if (!direct.ok) {
        /*
         * Envoi direct bloqué (réseau, navigateur…) :
         * pour un petit fichier, on repasse par le serveur.
         */
        if (
          direct.networkError &&
          file.size <= SERVER_UPLOAD_LIMIT
        ) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('parentId', currentFolderId);

          const response = await fetch(
            '/api/google/drive/upload',
            {
              method: 'POST',
              body: formData,
            }
          );

          const data = await readJson(response);

          if (!response.ok) {
            throw new Error(
              data?.error ||
                'Impossible d’importer le fichier.'
            );
          }
        } else {
          throw new Error(
            'L’envoi du fichier vers Google Drive a échoué. Vérifie ta connexion internet et réessaie.'
          );
        }
      }

      setUploadSuccess(
        `« ${file.name} » a été importé dans Google Drive.`
      );

      await loadFiles(currentFolderId);
    } catch (err) {
      console.error(err);

      setUploadError(
        err instanceof Error
          ? err.message
          : 'Impossible d’importer le fichier.'
      );
    } finally {
      setUploadingFile(false);
      setUploadProgress(null);
    }
  }

  function askDelete(file: DriveFile) {
    setDeleteError('');
    setDeletingItem(file);
  }

  function closeDelete() {
    if (deleting) return;

    setDeletingItem(null);
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!deletingItem) {
      return;
    }

    try {
      setDeleting(true);
      setDeleteError('');

      const response = await fetch(
        `/api/google/drive/delete?id=${encodeURIComponent(
          deletingItem.id
        )}`,
        {
          method: 'DELETE',
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de supprimer cet élément.'
        );
      }

      /*
       * On retire immédiatement l'élément
       * de la liste affichée.
       */
      setFiles((currentFiles) =>
        currentFiles.filter(
          (file) =>
            file.id !== deletingItem.id
        )
      );

      setUploadError('');
      setUploadSuccess(
        `« ${deletingItem.name} » a été placé dans la corbeille de Google Drive (récupérable pendant 30 jours).`
      );

      setDeletingItem(null);
      setDeleteError('');
    } catch (err) {
      console.error(err);

      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer cet élément.'
      );
    } finally {
      setDeleting(false);
    }
  }

  function getDownloadUrl(file: DriveFile) {
    const params = new URLSearchParams({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
    });

    return `/api/google/drive/download?${params.toString()}`;
  }

  const filteredFiles = files.filter(
    (file) =>
      file.name
        .toLocaleLowerCase('fr-FR')
        .includes(
          search
            .trim()
            .toLocaleLowerCase('fr-FR')
        )
  );

  const folders = filteredFiles.filter(
    (file) =>
      file.mimeType ===
      'application/vnd.google-apps.folder'
  );

  const regularFiles = filteredFiles.filter(
    (file) =>
      file.mimeType !==
      'application/vnd.google-apps.folder'
  );

  return (
    <main className="documents-page">
      <section className="documents-card">
        <div className="documents-drive-header">
          <div className="documents-drive-title">
            <div className="documents-drive-icon">
              <Cloud
                size={24}
                strokeWidth={2}
              />
            </div>

            <div>
              <h1>Google Drive</h1>

              <p>
                Gestion des fichiers et dossiers
                de l’association
              </p>

              {connection && (
                <div className="documents-connection">
                  <Link2 size={14} />

                  <span>
                    {connection.connected
                      ? `Relié au compte ${connection.email || 'Google'}`
                      : 'Aucun compte Google relié'}
                  </span>

                  {connection.canManage && (
                    <a
                      href="/api/google/drive/connect"
                      className="documents-connection-link"
                    >
                      {connection.connected
                        ? 'Changer / reconnecter'
                        : 'Connecter'}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="documents-drive-actions">
            <button
              type="button"
              className="documents-action-button documents-action-secondary"
              onClick={openCreateFolder}
              disabled={uploadingFile}
            >
              <Plus size={17} />

              <span>
                Nouveau dossier
              </span>
            </button>

            <button
              type="button"
              className="documents-action-button documents-action-primary"
              onClick={openFilePicker}
              disabled={uploadingFile}
            >
              {uploadingFile ? (
                <Loader2
                  size={17}
                  className="documents-spin"
                />
              ) : (
                <Upload size={17} />
              )}

              <span>
                {uploadingFile
                  ? uploadProgress
                    ? `Import… ${uploadProgress} %`
                    : 'Import en cours...'
                  : 'Importer un fichier'}
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="documents-hidden-file-input"
              onChange={uploadFile}
            />
          </div>
        </div>

        <div className="documents-content">
          {notice && (
            <div
              className={`documents-message ${
                notice.ok
                  ? 'documents-message-success'
                  : 'documents-message-error'
              }`}
            >
              {notice.ok ? (
                <Check size={18} />
              ) : (
                <AlertCircle size={18} />
              )}

              <span>{notice.text}</span>

              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {uploadSuccess && (
            <div className="documents-message documents-message-success">
              <Check size={18} />

              <span>
                {uploadSuccess}
              </span>

              <button
                type="button"
                onClick={() =>
                  setUploadSuccess('')
                }
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {uploadError && (
            <div className="documents-message documents-message-error">
              <AlertCircle size={18} />

              <span>
                {uploadError}
              </span>

              <button
                type="button"
                onClick={() =>
                  setUploadError('')
                }
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="documents-toolbar">
            <div className="documents-breadcrumb">
              {folderHistory.length > 0 ? (
                <button
                  type="button"
                  className="documents-back-button"
                  onClick={goBack}
                  title="Dossier précédent"
                >
                  <ArrowLeft size={17} />
                </button>
              ) : null}

              <button
                type="button"
                className="documents-breadcrumb-root"
                onClick={goToRoot}
              >
                Mon Drive
              </button>

              {folderHistory.slice(1).map(
                (item, index) => (
                  <span
                    key={item.id}
                    className="documents-breadcrumb-step"
                  >
                    <ChevronRight
                      size={16}
                      className="documents-breadcrumb-separator"
                    />

                    <button
                      type="button"
                      className="documents-breadcrumb-root"
                      onClick={() =>
                        goToHistory(index + 1)
                      }
                    >
                      {item.name}
                    </button>
                  </span>
                )
              )}

              {currentFolderId !== 'root' && (
                <span className="documents-breadcrumb-step">
                  <ChevronRight
                    size={16}
                    className="documents-breadcrumb-separator"
                  />

                  <span className="documents-breadcrumb-current">
                    {currentFolderName}
                  </span>
                </span>
              )}
            </div>

            <div className="documents-search">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Rechercher dans ce dossier..."
              />
            </div>

            <button
              type="button"
              className="documents-refresh-button"
              onClick={() =>
                loadFiles(
                  currentFolderId
                )
              }
              disabled={loading}
              title="Actualiser"
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? 'documents-spin'
                    : ''
                }
              />
            </button>
          </div>

          {loading ? (
            <div className="documents-state">
              <Loader2
                size={30}
                className="documents-spin"
              />

              <p>
                Chargement du Google Drive...
              </p>
            </div>
          ) : error ? (
            <div className="documents-state documents-state-error">
              <AlertCircle size={30} />

              <p>{error}</p>

              {driveNotConnected ? (
                connection?.canManage ? (
                  <a
                    href="/api/google/drive/connect"
                    className="documents-connect-button"
                  >
                    <Link2 size={17} />
                    Connecter Google Drive
                  </a>
                ) : (
                  <p className="documents-state-help">
                    Préviens le Président : il peut
                    reconnecter le Drive depuis cette page.
                  </p>
                )
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    loadFiles(
                      currentFolderId
                    )
                  }
                >
                  Réessayer
                </button>
              )}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="documents-empty">
              <FolderOpen
                size={42}
                strokeWidth={1.5}
              />

              <h2>
                {search
                  ? 'Aucun résultat'
                  : 'Dossier vide'}
              </h2>

              <p>
                {search
                  ? 'Aucun fichier ou dossier ne correspond à votre recherche.'
                  : 'Ce dossier ne contient actuellement aucun élément.'}
              </p>
            </div>
          ) : (
            <div className="documents-list">
              {folders.length > 0 && (
                <div className="documents-section">
                  <div className="documents-section-title">
                    Dossiers
                  </div>

                  <div className="documents-items">
                    {folders.map(
                      (folder) => (
                        <div
                          key={folder.id}
                          className="documents-item"
                        >
                          <div className="documents-item-icon documents-folder-icon">
                            <Folder
                              size={21}
                              strokeWidth={2}
                            />
                          </div>

                          <div className="documents-item-info">
                            <div className="documents-item-name">
                              {folder.name}
                            </div>

                            <div className="documents-item-meta">
                              Dossier
                            </div>
                          </div>

                          <div className="documents-item-actions">
                            <button
                              type="button"
                              className="documents-open-button"
                              onClick={() =>
                                openFolder(
                                  folder
                                )
                              }
                            >
                              Ouvrir
                              <ChevronRight
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              className="documents-delete-button"
                              onClick={() =>
                                askDelete(
                                  folder
                                )
                              }
                              title="Supprimer le dossier"
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {regularFiles.length > 0 && (
                <div className="documents-section">
                  <div className="documents-section-title">
                    Fichiers
                  </div>

                  <div className="documents-items">
                    {regularFiles.map(
                      (file) => (
                        <div
                          key={file.id}
                          className="documents-item"
                        >
                          <div className="documents-item-icon documents-file-icon">
                            {file.mimeType.includes(
                              'google-apps'
                            ) ? (
                              <FileText
                                size={21}
                                strokeWidth={2}
                              />
                            ) : (
                              <File
                                size={21}
                                strokeWidth={2}
                              />
                            )}
                          </div>

                          <div className="documents-item-info">
                            <div className="documents-item-name">
                              {file.name}
                            </div>

                            <div className="documents-item-meta">
                              {formatFileSize(
                                file.size
                              )}

                              {file.size &&
                              file.modifiedTime
                                ? ' • '
                                : ''}

                              {formatDate(
                                file.modifiedTime
                              )}
                            </div>
                          </div>

                          <div className="documents-item-actions">
                            {file.webViewLink && (
                              <a
                                href={
                                  file.webViewLink
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="documents-open-button"
                              >
                                Ouvrir
                                <ChevronRight
                                  size={15}
                                />
                              </a>
                            )}

                            {isDownloadable(
                              file.mimeType
                            ) && (
                              <a
                                href={getDownloadUrl(
                                  file
                                )}
                                className="documents-download-button"
                                title={
                                  EXPORTABLE_GOOGLE_TYPES.has(
                                    file.mimeType
                                  )
                                    ? 'Télécharger (converti en Word / Excel / PowerPoint / PDF)'
                                    : 'Télécharger'
                                }
                                aria-label={`Télécharger ${file.name}`}
                              >
                                <Download
                                  size={16}
                                />
                              </a>
                            )}

                            <button
                              type="button"
                              className="documents-delete-button"
                              onClick={() =>
                                askDelete(
                                  file
                                )
                              }
                              title="Supprimer le fichier"
                              aria-label={`Supprimer ${file.name}`}
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {showCreateFolder && (
        <div
          className="documents-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateFolder();
            }
          }}
        >
          <div
            className="documents-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-folder-title"
          >
            <div className="documents-modal-header">
              <div>
                <h2 id="create-folder-title">
                  Nouveau dossier
                </h2>

                <p>
                  Création dans «{' '}
                  {currentFolderName} »
                </p>
              </div>

              <button
                type="button"
                className="documents-modal-close"
                onClick={
                  closeCreateFolder
                }
                disabled={creatingFolder}
                aria-label="Fermer"
              >
                <X size={19} />
              </button>
            </div>

            <div className="documents-modal-body">
              <label
                htmlFor="new-folder-name"
                className="documents-modal-label"
              >
                Nom du dossier
              </label>

              <input
                id="new-folder-name"
                type="text"
                value={newFolderName}
                onChange={(event) =>
                  setNewFolderName(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      'Enter' &&
                    !creatingFolder
                  ) {
                    createFolder();
                  }
                }}
                placeholder="Ex. Conseil d'administration"
                autoFocus
                maxLength={150}
              />

              <p className="documents-modal-help">
                Le dossier sera créé dans
                « {currentFolderName} ».
              </p>

              {createFolderError && (
                <div className="documents-modal-error">
                  <AlertCircle
                    size={17}
                  />

                  <span>
                    {createFolderError}
                  </span>
                </div>
              )}
            </div>

            <div className="documents-modal-actions">
              <button
                type="button"
                className="documents-modal-button documents-modal-button-secondary"
                onClick={
                  closeCreateFolder
                }
                disabled={creatingFolder}
              >
                Annuler
              </button>

              <button
                type="button"
                className="documents-modal-button documents-modal-button-primary"
                onClick={createFolder}
                disabled={
                  creatingFolder ||
                  !newFolderName.trim()
                }
              >
                {creatingFolder ? (
                  <Loader2
                    size={17}
                    className="documents-spin"
                  />
                ) : (
                  <Check size={17} />
                )}

                {creatingFolder
                  ? 'Création...'
                  : 'Créer le dossier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingItem && (
        <div
          className="documents-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDelete();
            }
          }}
        >
          <div
            className="documents-modal documents-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="documents-modal-header">
              <div>
                <h2 id="delete-title">
                  Supprimer{' '}
                  {deletingItem.mimeType ===
                  'application/vnd.google-apps.folder'
                    ? 'le dossier'
                    : 'le fichier'}
                </h2>

                <p>
                  L’élément sera placé dans la
                  corbeille de Google Drive.
                </p>
              </div>

              <button
                type="button"
                className="documents-modal-close"
                onClick={closeDelete}
                disabled={deleting}
                aria-label="Fermer"
              >
                <X size={19} />
              </button>
            </div>

            <div className="documents-modal-body">
              <div className="documents-delete-warning">
                <AlertCircle size={20} />

                <div>
                  <strong>
                    {deletingItem.name}
                  </strong>

                  {deletingItem.mimeType ===
                    'application/vnd.google-apps.folder' && (
                    <p>
                      Le dossier et tout son contenu
                      iront dans la corbeille de Google
                      Drive. Ils restent récupérables
                      pendant 30 jours depuis Google Drive.
                    </p>
                  )}

                  {deletingItem.mimeType !==
                    'application/vnd.google-apps.folder' && (
                    <p>
                      Le fichier ira dans la corbeille
                      de Google Drive. Il reste
                      récupérable pendant 30 jours.
                    </p>
                  )}
                </div>
              </div>

              {deleteError && (
                <div className="documents-modal-error">
                  <AlertCircle
                    size={17}
                  />

                  <span>
                    {deleteError}
                  </span>
                </div>
              )}
            </div>

            <div className="documents-modal-actions">
              <button
                type="button"
                className="documents-modal-button documents-modal-button-secondary"
                onClick={closeDelete}
                disabled={deleting}
              >
                Annuler
              </button>

              <button
                type="button"
                className="documents-modal-button documents-modal-button-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2
                    size={17}
                    className="documents-spin"
                  />
                ) : (
                  <Trash2 size={17} />
                )}

                {deleting
                  ? 'Suppression...'
                  : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .documents-page {
          width: 100%;
          min-width: 0;
        }

        .documents-card {
          width: 100%;
          min-width: 0;
          background: #ffffff;
          border: 1px solid #eadfd4;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(54, 34, 20, 0.05);
        }

        .documents-drive-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px;
          border-bottom: 1px solid #eee4db;
        }

        .documents-drive-title {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .documents-drive-icon {
          flex: 0 0 auto;
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #fff0d9;
          color: #8f211c;
        }

        .documents-drive-title h1 {
          margin: 0;
          color: #2f2723;
          font-size: 21px;
          line-height: 1.2;
          font-weight: 750;
        }

        .documents-drive-title p {
          margin: 4px 0 0;
          color: #756c65;
          font-size: 13px;
          line-height: 1.4;
        }

        .documents-drive-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex: 0 0 auto;
        }

        .documents-action-button {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 14px;
          border-radius: 9px;
          border: 1px solid transparent;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .documents-action-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .documents-action-secondary {
          background: #fff7ee;
          border-color: #e8d6c4;
          color: #8f211c;
        }

        .documents-action-primary {
          background: #8f211c;
          border-color: #8f211c;
          color: #ffffff;
        }

        .documents-action-primary:hover:not(
            :disabled
          ) {
          background: #7a1c18;
        }

        .documents-hidden-file-input {
          display: none;
        }

        .documents-content {
          padding: 20px;
        }

        .documents-message {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 16px;
          padding: 11px 13px;
          border-radius: 9px;
          font-size: 13px;
        }

        .documents-message span {
          flex: 1;
          min-width: 0;
        }

        .documents-message button {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
        }

        .documents-message-success {
          color: #28613a;
          background: #edf8f0;
          border: 1px solid #cfe8d5;
        }

        .documents-message-error {
          color: #8f211c;
          background: #fff1ef;
          border: 1px solid #f0d0cb;
        }

        .documents-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, 320px) 40px;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .documents-breadcrumb {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 7px;
          color: #554b45;
          font-size: 13px;
          font-weight: 650;
        }

        .documents-breadcrumb-root {
          padding: 0;
          border: 0;
          background: transparent;
          color: #8f211c;
          font: inherit;
          cursor: pointer;
        }

        .documents-breadcrumb-separator {
          flex: 0 0 auto;
          color: #a69a91;
        }

        .documents-breadcrumb > span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .documents-breadcrumb {
          flex-wrap: wrap;
        }

        .documents-breadcrumb-step {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          max-width: 100%;
        }

        .documents-breadcrumb-step .documents-breadcrumb-root,
        .documents-breadcrumb-current {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .documents-connection {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 4px 10px;
          border: 1px solid #eee4db;
          border-radius: 999px;
          background: #fff7ee;
          color: #655b54;
          font-size: 12px;
          font-weight: 650;
        }

        .documents-connection-link {
          color: #8f211c;
          font-weight: 750;
          text-decoration: underline;
        }

        .documents-connect-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
          padding: 10px 16px;
          border-radius: 10px;
          background: #8f211c;
          color: #ffffff;
          font-size: 14px;
          font-weight: 750;
          text-decoration: none;
        }

        .documents-connect-button:hover {
          background: #7a1c18;
        }

        .documents-state-help {
          max-width: 420px;
          color: #655b54;
          font-size: 13px;
        }

        .documents-back-button {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 1px solid #e4d9cf;
          border-radius: 8px;
          background: #ffffff;
          color: #554b45;
          cursor: pointer;
        }

        .documents-search {
          min-width: 0;
        }

        .documents-search input {
          width: 100%;
          height: 38px;
          box-sizing: border-box;
          padding: 0 12px;
          border: 1px solid #ddd2c9;
          border-radius: 8px;
          background: #ffffff;
          color: #332c28;
          font: inherit;
          font-size: 13px;
          outline: none;
        }

        .documents-refresh-button {
          width: 40px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 1px solid #ddd2c9;
          border-radius: 8px;
          background: #ffffff;
          color: #554b45;
          cursor: pointer;
        }

        .documents-state {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #756c65;
          text-align: center;
        }

        .documents-state p {
          margin: 0;
          font-size: 13px;
        }

        .documents-state-error {
          color: #8f211c;
        }

        .documents-state-error button {
          margin-top: 4px;
          padding: 8px 13px;
          border: 0;
          border-radius: 8px;
          background: #8f211c;
          color: #ffffff;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .documents-empty {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
          color: #a1958d;
        }

        .documents-empty h2 {
          margin: 13px 0 5px;
          color: #554b45;
          font-size: 17px;
        }

        .documents-empty p {
          max-width: 460px;
          margin: 0;
          color: #857a72;
          font-size: 13px;
          line-height: 1.5;
        }

        .documents-section + .documents-section {
          margin-top: 24px;
        }

        .documents-section-title {
          margin-bottom: 8px;
          color: #756c65;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .documents-items {
          display: grid;
          gap: 7px;
        }

        .documents-item {
          min-width: 0;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 11px 12px;
          border: 1px solid #eee6df;
          border-radius: 9px;
          background: #ffffff;
        }

        .documents-item-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
        }

        .documents-folder-icon {
          background: #fff0d9;
          color: #8f211c;
        }

        .documents-file-icon {
          background: #f4f0ed;
          color: #655b54;
        }

        .documents-item-info {
          min-width: 0;
        }

        .documents-item-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #332c28;
          font-size: 13px;
          font-weight: 700;
        }

        .documents-item-meta {
          margin-top: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #8b8078;
          font-size: 11px;
        }

        .documents-item-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          flex: 0 0 auto;
        }

        .documents-open-button,
        .documents-download-button,
        .documents-delete-button {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 7px;
          font: inherit;
          cursor: pointer;
          text-decoration: none;
        }

        .documents-open-button {
          padding: 7px 11px;
          border: 0;
          background: #8f211c;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .documents-open-button:hover {
          background: #7a1c18;
        }

        .documents-download-button,
        .documents-delete-button {
          width: 34px;
          padding: 0;
        }

        .documents-download-button {
          border: 1px solid #ddd2c9;
          background: #ffffff;
          color: #655b54;
        }

        .documents-download-button:hover {
          background: #fff7ee;
          border-color: #cdb9aa;
          color: #8f211c;
        }

        .documents-delete-button {
          border: 1px solid #ecd0cb;
          background: #fff5f3;
          color: #8f211c;
        }

        .documents-delete-button:hover {
          background: #ffe8e4;
          border-color: #dca9a2;
        }

        .documents-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(34, 25, 20, 0.42);
        }

        .documents-modal {
          width: min(100%, 480px);
          max-height: calc(100dvh - 40px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #e5d9cf;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 20px 60px rgba(35, 25, 20, 0.2);
        }

        .documents-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 22px 17px;
          border-bottom: 1px solid #eee4db;
        }

        .documents-modal-header h2 {
          margin: 0;
          color: #332c28;
          font-size: 18px;
        }

        .documents-modal-header p {
          margin: 4px 0 0;
          color: #81766e;
          font-size: 12px;
        }

        .documents-modal-close {
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 1px solid #e3d8cf;
          border-radius: 8px;
          background: #ffffff;
          color: #655b54;
          cursor: pointer;
        }

        .documents-modal-body {
          padding: 22px;
          overflow-y: auto;
        }

        .documents-modal-label {
          display: block;
          margin-bottom: 7px;
          color: #4d443e;
          font-size: 12px;
          font-weight: 750;
        }

        .documents-modal-body input {
          width: 100%;
          height: 42px;
          box-sizing: border-box;
          padding: 0 12px;
          border: 1px solid #dcd1c8;
          border-radius: 8px;
          background: #ffffff;
          color: #332c28;
          font: inherit;
          font-size: 13px;
          outline: none;
        }

        .documents-modal-help {
          margin: 7px 0 0;
          color: #8a7f77;
          font-size: 11px;
          line-height: 1.45;
        }

        .documents-modal-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 12px;
          padding: 10px 11px;
          border: 1px solid #efd0cb;
          border-radius: 8px;
          background: #fff2f0;
          color: #8f211c;
          font-size: 12px;
          line-height: 1.4;
        }

        .documents-delete-warning {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 13px;
          border: 1px solid #efd0cb;
          border-radius: 9px;
          background: #fff5f3;
          color: #8f211c;
        }

        .documents-delete-warning strong {
          display: block;
          overflow-wrap: anywhere;
          color: #4d332e;
          font-size: 13px;
        }

        .documents-delete-warning p {
          margin: 5px 0 0;
          color: #75645f;
          font-size: 12px;
          line-height: 1.45;
        }

        .documents-modal-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          padding: 16px 22px 20px;
          border-top: 1px solid #eee4db;
        }

        .documents-modal-button {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 8px 15px;
          border-radius: 8px;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .documents-modal-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .documents-modal-button-secondary {
          border: 1px solid #ded2c8;
          background: #ffffff;
          color: #5d544e;
        }

        .documents-modal-button-primary {
          border: 1px solid #8f211c;
          background: #8f211c;
          color: #ffffff;
        }

        .documents-modal-button-danger {
          border: 1px solid #8f211c;
          background: #8f211c;
          color: #ffffff;
        }

        .documents-modal-button-danger:hover:not(
            :disabled
          ) {
          background: #7a1c18;
        }

        .documents-spin {
          animation: documents-spin 0.9s linear infinite;
        }

        @keyframes documents-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .documents-drive-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .documents-drive-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .documents-toolbar {
            grid-template-columns: minmax(0, 1fr) 40px;
          }

          .documents-search {
            grid-column: 1 / -1;
            grid-row: 1;
          }

          .documents-breadcrumb {
            grid-column: 1;
            grid-row: 2;
          }

          .documents-refresh-button {
            grid-column: 2;
            grid-row: 2;
          }
        }

        @media (max-width: 700px) {
          .documents-connection {
            display: flex;
            border-radius: 10px;
            padding: 7px 10px;
            gap: 2px 8px;
          }

          .documents-connection :global(svg) {
            display: none;
          }

          .documents-drive-header {
            padding: 18px;
            gap: 16px;
          }

          .documents-drive-actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 9px;
          }

          .documents-action-button {
            width: 100%;
            padding-left: 10px;
            padding-right: 10px;
          }

          .documents-content {
            padding: 16px;
          }

          .documents-toolbar {
            gap: 9px;
            margin-bottom: 16px;
          }

          .documents-item {
            grid-template-columns: 38px minmax(0, 1fr);
            gap: 9px;
            padding: 10px;
          }

          .documents-item-icon {
            width: 38px;
            height: 38px;
          }

          .documents-item-actions {
            grid-column: 2;
            justify-content: flex-start;
            flex-wrap: wrap;
          }

          .documents-modal-overlay {
            align-items: flex-start;
            padding: 12px;
            overflow-y: auto;
          }

          .documents-modal {
            width: 100%;
            max-height: calc(100dvh - 24px);
            margin-top: 8px;
            border-radius: 12px;
          }

          .documents-modal-header {
            padding: 17px 17px 15px;
          }

          .documents-modal-body {
            padding: 18px 17px;
          }

          .documents-modal-actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 9px;
            padding: 14px 17px 17px;
          }

          .documents-modal-button {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .documents-drive-title {
            gap: 10px;
          }

          .documents-drive-icon {
            width: 42px;
            height: 42px;
          }

          .documents-drive-title h1 {
            font-size: 19px;
          }

          .documents-drive-title p {
            font-size: 12px;
          }

          .documents-drive-actions {
            grid-template-columns: minmax(0, 1fr);
          }

          .documents-item-actions {
            width: 100%;
          }

          .documents-open-button {
            flex: 0 0 auto;
          }

          .documents-modal-actions {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </main>
  );
}
