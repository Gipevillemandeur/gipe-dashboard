'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Cloud,
  File,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

type FolderHistoryItem = {
  id: string;
  name: string;
};

const FOLDER_MIME =
  'application/vnd.google-apps.folder';

function isFolder(file: DriveFile) {
  return file.mimeType === FOLDER_MIME;
}

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatSize(value?: string) {
  if (!value) return '';

  const bytes = Number(value);

  if (Number.isNaN(bytes) || bytes < 0) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} o`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} Ko`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} Go`;
}

function getFileIcon(file: DriveFile) {
  if (isFolder(file)) {
    return <Folder size={23} />;
  }

  if (
    file.mimeType === 'application/pdf' ||
    file.mimeType.includes('document')
  ) {
    return <FileText size={23} />;
  }

  return <File size={23} />;
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [connectionMessage, setConnectionMessage] =
    useState('');

  const [currentFolderId, setCurrentFolderId] =
    useState('root');

  const [currentFolderName, setCurrentFolderName] =
    useState('Mon Drive');

  const [folderHistory, setFolderHistory] =
    useState<FolderHistoryItem[]>([]);

  const [showCreateFolder, setShowCreateFolder] =
    useState(false);

  const [newFolderName, setNewFolderName] =
    useState('');

  const [creatingFolder, setCreatingFolder] =
    useState(false);

  const [createFolderError, setCreateFolderError] =
    useState('');

  async function loadFiles(folderId: string) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/google/drive/files?folderId=${encodeURIComponent(
          folderId
        )}`,
        {
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger le Google Drive.'
        );
      }

      setFiles(data.files || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger le Google Drive.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get('google') === 'connected') {
      setConnectionMessage(
        'La connexion Google Drive est bien enregistrée.'
      );
    }

    if (params.get('google')) {
      window.history.replaceState(
        {},
        '',
        '/documents'
      );
    }

    void loadFiles('root');
  }, []);

  const filteredFiles = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return files;
    }

    return files.filter((file) =>
      file.name.toLowerCase().includes(value)
    );
  }, [files, search]);

  const folders = filteredFiles.filter(isFolder);

  const regularFiles = filteredFiles.filter(
    (file) => !isFolder(file)
  );

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

    void loadFiles(folder.id);
  }

  function goBack() {
    if (folderHistory.length === 0) {
      return;
    }

    const previousFolder =
      folderHistory[folderHistory.length - 1];

    setFolderHistory((previous) =>
      previous.slice(0, -1)
    );

    setCurrentFolderId(previousFolder.id);
    setCurrentFolderName(previousFolder.name);
    setSearch('');

    void loadFiles(previousFolder.id);
  }

  function goToRoot() {
    setFolderHistory([]);
    setCurrentFolderId('root');
    setCurrentFolderName('Mon Drive');
    setSearch('');

    void loadFiles('root');
  }

  function openCreateFolder() {
    setNewFolderName('');
    setCreateFolderError('');
    setShowCreateFolder(true);
  }

  function closeCreateFolder() {
    if (creatingFolder) {
      return;
    }

    setShowCreateFolder(false);
    setNewFolderName('');
    setCreateFolderError('');
  }

  async function createFolder() {
    const name =
      newFolderName.trim();

    if (!name) {
      setCreateFolderError(
        'Indique le nom du dossier.'
      );
      return;
    }

    setCreatingFolder(true);
    setCreateFolderError('');

    try {
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
            parentId:
              currentFolderId,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de créer le dossier.'
        );
      }

      setShowCreateFolder(false);
      setNewFolderName('');

      await loadFiles(
        currentFolderId
      );
    } catch (err) {
      setCreateFolderError(
        err instanceof Error
          ? err.message
          : 'Impossible de créer le dossier.'
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Gestion de l’association
          </div>

          <h1>Documents</h1>

          <div className="kicker">
            Gestion du Google Drive de l’association.
          </div>
        </div>

        <div className="topbar-right">
          <button
            className="btn"
            type="button"
            onClick={() =>
              void loadFiles(
                currentFolderId
              )
            }
            disabled={loading}
          >
            {loading ? (
              <Loader2
                size={15}
                className="documents-spin"
              />
            ) : (
              <RefreshCw size={15} />
            )}

            Actualiser
          </button>
        </div>
      </div>

      {connectionMessage && (
        <div className="notice notice-success documents-notice">
          {connectionMessage}
        </div>
      )}

      {error && (
        <div className="notice notice-error documents-notice documents-error">
          <AlertCircle size={17} />

          <span>{error}</span>
        </div>
      )}

      <section className="card documents-drive-card">
        <div className="documents-drive-header">
          <div className="documents-drive-title">
            <div className="documents-drive-icon">
              <Cloud size={27} />
            </div>

            <div className="documents-drive-heading">
              <div className="eyebrow">
                Google Drive
              </div>

              <h2>{currentFolderName}</h2>

              <p>
                {currentFolderId === 'root'
                  ? 'Contenu à la racine du Drive de l’association.'
                  : 'Contenu de ce dossier.'}
              </p>
            </div>
          </div>

          <div className="documents-search">
            <input
              className="input"
              type="search"
              placeholder="Rechercher..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>
        </div>

        <div className="documents-toolbar">
          <button
            className="btn btn-primary"
            type="button"
            onClick={
              openCreateFolder
            }
          >
            <Plus size={16} />

            Nouveau dossier
          </button>
        </div>

        <div className="documents-navigation">
          <button
            className="documents-root-button"
            type="button"
            onClick={goToRoot}
          >
            <Cloud size={16} />

            Mon Drive
          </button>

          {folderHistory.map(
            (item, index) => (
              <div
                className="documents-navigation-item"
                key={`${item.id}-${index}`}
              >
                <ChevronRight
                  size={15}
                />

                <span>
                  {item.name}
                </span>
              </div>
            )
          )}

          {currentFolderId !==
            'root' && (
            <div className="documents-navigation-current">
              <ChevronRight
                size={15}
              />

              <span>
                {currentFolderName}
              </span>
            </div>
          )}
        </div>

        {currentFolderId !==
          'root' && (
          <div className="documents-back-bar">
            <button
              className="btn"
              type="button"
              onClick={
                goBack
              }
            >
              <ArrowLeft
                size={15}
              />

              Retour
            </button>
          </div>
        )}

        {loading ? (
          <div className="documents-loading">
            <Loader2
              size={25}
              className="documents-spin"
            />

            <span>
              Chargement du
              Google Drive…
            </span>
          </div>
        ) : (
          <>
            {filteredFiles.length ===
            0 ? (
              <div className="documents-empty">
                <FolderOpen
                  size={40}
                />

                <strong>
                  {search
                    ? 'Aucun élément trouvé'
                    : 'Ce dossier est vide'}
                </strong>

                <span>
                  {search
                    ? 'Essaie une autre recherche.'
                    : 'Aucun fichier ou dossier n’est présent ici.'}
                </span>
              </div>
            ) : (
              <div className="documents-list">
                {folders.map(
                  (file) => (
                    <button
                      className="documents-row documents-folder-row"
                      type="button"
                      key={
                        file.id
                      }
                      onClick={() =>
                        openFolder(
                          file
                        )
                      }
                    >
                      <div className="documents-row-icon documents-folder-icon">
                        {getFileIcon(
                          file
                        )}
                      </div>

                      <div className="documents-row-main">
                        <strong>
                          {file.name}
                        </strong>

                        <span>
                          Dossier
                        </span>
                      </div>

                      <div className="documents-row-date">
                        —
                      </div>

                      <div className="documents-row-action">
                        <ChevronRight
                          size={18}
                        />
                      </div>
                    </button>
                  )
                )}

                {regularFiles.map(
                  (file) => (
                    <div
                      className="documents-row documents-file-row"
                      key={
                        file.id
                      }
                    >
                      <div className="documents-row-icon">
                        {getFileIcon(
                          file
                        )}
                      </div>

                      <div className="documents-row-main">
                        <strong>
                          {file.name}
                        </strong>

                        <span>
                          {file.mimeType}

                          {formatSize(
                            file.size
                          )
                            ? ` · ${formatSize(
                                file.size
                              )}`
                            : ''}
                        </span>
                      </div>

                      <div className="documents-row-date">
                        {formatDate(
                          file.modifiedTime
                        )}
                      </div>

                      <div className="documents-row-action">
                        {file.webViewLink ? (
                          <a
                            href={
                              file.webViewLink
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="documents-open-button"
                          >
                            Ouvrir
                          </a>
                        ) : null}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </section>

      {showCreateFolder && (
        <div
          className="documents-modal-overlay"
          onMouseDown={(
            event
          ) => {
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
                <div className="eyebrow">
                  Google Drive
                </div>

                <h2 id="create-folder-title">
                  Nouveau dossier
                </h2>
              </div>

              <button
                className="documents-modal-close"
                type="button"
                onClick={
                  closeCreateFolder
                }
                disabled={
                  creatingFolder
                }
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="documents-modal-body">
              <label
                className="documents-modal-label"
                htmlFor="new-folder-name"
              >
                Nom du dossier
              </label>

              <input
                id="new-folder-name"
                className="input"
                type="text"
                value={
                  newFolderName
                }
                onChange={(
                  event
                ) =>
                  setNewFolderName(
                    event.target
                      .value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    'Enter'
                  ) {
                    void createFolder();
                  }

                  if (
                    event.key ===
                    'Escape'
                  ) {
                    closeCreateFolder();
                  }
                }}
                placeholder="Ex. Réunions 2026"
                autoFocus
                maxLength={150}
                disabled={
                  creatingFolder
                }
              />

              {createFolderError && (
                <div className="documents-form-error">
                  <AlertCircle
                    size={16}
                  />

                  <span>
                    {
                      createFolderError
                    }
                  </span>
                </div>
              )}

              <p className="documents-modal-help">
                Le dossier sera créé
                dans «{' '}
                {
                  currentFolderName
                } ».
              </p>
            </div>

            <div className="documents-modal-footer">
              <button
                className="btn"
                type="button"
                onClick={
                  closeCreateFolder
                }
                disabled={
                  creatingFolder
                }
              >
                Annuler
              </button>

              <button
                className="btn btn-primary"
                type="button"
                onClick={() =>
                  void createFolder()
                }
                disabled={
                  creatingFolder ||
                  !newFolderName.trim()
                }
              >
                {creatingFolder ? (
                  <Loader2
                    size={15}
                    className="documents-spin"
                  />
                ) : (
                  <Check size={15} />
                )}

                Créer le dossier
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .documents-notice {
          margin-bottom: 18px;
        }

        .documents-error {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .documents-drive-card {
          min-width: 0;
        }

        .documents-drive-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px;
          border-bottom: 1px solid var(--gipe-line);
        }

        .documents-drive-title {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
          flex: 1;
        }

        .documents-drive-icon {
          width: 56px;
          height: 56px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: #fff0d9;
          color: #8f211c;
        }

        .documents-drive-heading {
          min-width: 0;
        }

        .documents-drive-title h2 {
          margin: 5px 0 5px;
          font-size: 21px;
          line-height: 1.2;
        }

        .documents-drive-title p {
          margin: 0;
          color: var(--gipe-muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .documents-search {
          width: 280px;
          max-width: 100%;
          flex-shrink: 0;
        }

        .documents-search .input {
          width: 100%;
          box-sizing: border-box;
        }

        .documents-toolbar {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 14px 4px 0;
        }

        .documents-toolbar .btn {
          min-height: 38px;
        }

        .documents-navigation {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          overflow-x: auto;
          padding: 14px 4px 12px;
          border-bottom: 1px solid var(--gipe-line);
        }

        .documents-root-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 0;
          background: transparent;
          padding: 4px 6px;
          border-radius: 6px;
          color: var(--gipe-muted);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .documents-root-button:hover {
          background: #fff0d9;
          color: #8f211c;
        }

        .documents-navigation-item,
        .documents-navigation-current {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          color: var(--gipe-muted);
          font-size: 13px;
          white-space: nowrap;
        }

        .documents-navigation-item span,
        .documents-navigation-current span {
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }

        .documents-navigation-current {
          font-weight: 700;
          color: var(--gipe-text);
        }

        .documents-back-bar {
          padding: 12px 4px 0;
        }

        .documents-back-bar .btn {
          min-height: 36px;
        }

        .documents-list {
          border-top: 1px solid var(--gipe-line);
          margin-top: 12px;
        }

        .documents-row {
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) 130px 110px;
          align-items: center;
          gap: 13px;
          width: 100%;
          min-width: 0;
          padding: 13px 8px;
          border: 0;
          border-bottom: 1px solid var(--gipe-line);
          background: transparent;
          box-sizing: border-box;
          text-align: left;
        }

        .documents-row:last-child {
          border-bottom: 0;
        }

        .documents-folder-row {
          cursor: pointer;
          font-family: inherit;
        }

        .documents-folder-row:hover,
        .documents-file-row:hover {
          background: #fffaf3;
        }

        .documents-row-icon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f7f7f7;
          color: #6b625c;
        }

        .documents-folder-icon {
          background: #fff0d9;
          color: #8f211c;
        }

        .documents-row-main {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .documents-row-main strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
        }

        .documents-row-main span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          color: var(--gipe-muted);
        }

        .documents-row-date {
          font-size: 12px;
          color: var(--gipe-muted);
          text-align: right;
        }

        .documents-row-action {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }

        .documents-open-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 78px;
          height: 36px;
          padding: 0 15px;
          box-sizing: border-box;
          border-radius: 8px;
          border: 1px solid #8f211c;
          background: #8f211c;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          text-decoration: none;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            transform 0.15s ease;
        }

        .documents-open-button:hover {
          background: #7a1c18;
          border-color: #7a1c18;
          color: #ffffff;
          transform: translateY(-1px);
        }

        .documents-loading {
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--gipe-muted);
        }

        .documents-empty {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--gipe-muted);
          text-align: center;
        }

        .documents-empty svg {
          margin-bottom: 6px;
        }

        .documents-empty strong {
          color: var(--gipe-text);
        }

        .documents-spin {
          animation: documents-spin 1s linear infinite;
        }

        .documents-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(24, 18, 16, 0.42);
        }

        .documents-modal {
          width: min(520px, 100%);
          max-height: calc(100dvh - 48px);
          overflow-y: auto;
          background: #ffffff;
          border: 1px solid var(--gipe-line);
          border-radius: 16px;
          box-shadow:
            0 20px 60px
              rgba(0, 0, 0, 0.2);
        }

        .documents-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 24px 18px;
          border-bottom: 1px solid var(--gipe-line);
        }

        .documents-modal-header h2 {
          margin: 5px 0 0;
          font-size: 22px;
        }

        .documents-modal-close {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--gipe-line);
          border-radius: 9px;
          background: #ffffff;
          color: var(--gipe-muted);
          cursor: pointer;
        }

        .documents-modal-close:hover {
          color: #8f211c;
          border-color: #d7b4b0;
        }

        .documents-modal-body {
          padding: 22px 24px;
        }

        .documents-modal-label {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 700;
        }

        .documents-modal-help {
          margin: 9px 0 0;
          color: var(--gipe-muted);
          font-size: 12px;
          line-height: 1.45;
        }

        .documents-form-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 10px;
          padding: 10px 12px;
          border: 1px solid #efc8c4;
          border-radius: 8px;
          background: #fff0ee;
          color: #8a2b22;
          font-size: 13px;
          line-height: 1.4;
        }

        .documents-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px 20px;
          border-top: 1px solid var(--gipe-line);
        }

        @media (max-width: 700px) {
          .documents-drive-header {
            flex-direction: column;
            align-items: stretch;
            gap: 18px;
            padding: 18px;
          }

          .documents-drive-title {
            gap: 15px;
          }

          .documents-drive-icon {
            width: 52px;
            height: 52px;
          }

          .documents-drive-title h2 {
            font-size: 21px;
          }

          .documents-search {
            width: 100%;
          }

          .documents-toolbar {
            justify-content: stretch;
            padding: 14px 0 0;
          }

          .documents-toolbar .btn {
            width: 100%;
            justify-content: center;
          }

          .documents-navigation {
            padding-left: 0;
            padding-right: 0;
          }

          .documents-row {
            grid-template-columns: 42px minmax(0, 1fr) auto;
            grid-template-rows: auto auto;
            column-gap: 10px;
            row-gap: 3px;
            padding: 13px 8px;
          }

          .documents-row-icon {
            grid-column: 1;
            grid-row: 1 / span 2;
          }

          .documents-row-main {
            grid-column: 2;
            grid-row: 1;
            min-width: 0;
          }

          .documents-row-date {
            grid-column: 2;
            grid-row: 2;
            text-align: left;
            margin: 0;
            font-size: 12px;
          }

          .documents-row-action {
            grid-column: 3;
            grid-row: 1 / span 2;
            justify-content: flex-end;
            align-items: center;
          }

          .documents-file-row
            .documents-row-action {
            padding-left: 4px;
          }

          .documents-open-button {
            min-width: 72px;
            width: auto;
            height: 36px;
            padding: 0 12px;
            font-size: 13px;
          }

          .documents-folder-row
            .documents-row-action {
            padding-left: 8px;
          }

          .documents-back-bar .btn {
            width: 100%;
            justify-content: center;
          }

          .documents-modal-overlay {
            align-items: flex-start;
            padding: 16px;
            padding-top: max(
              16px,
              env(safe-area-inset-top)
            );
          }

          .documents-modal {
            width: 100%;
            max-height: calc(
              100dvh - 32px
            );
            border-radius: 14px;
          }

          .documents-modal-header {
            padding: 18px 18px 16px;
          }

          .documents-modal-body {
            padding: 18px;
          }

          .documents-modal-footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            padding: 14px 18px 18px;
          }

          .documents-modal-footer .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
