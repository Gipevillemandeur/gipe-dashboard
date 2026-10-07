'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronRight,
  Cloud,
  File,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

const FOLDER_MIME =
  'application/vnd.google-apps.folder';

function isFolder(file: DriveFile) {
  return file.mimeType === FOLDER_MIME;
}

function formatDate(
  value?: string
) {
  if (!value) return '—';

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—';
  }

  return date.toLocaleDateString(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  );
}

function formatSize(
  value?: string
) {
  if (!value) return '';

  const bytes =
    Number(value);

  if (
    Number.isNaN(bytes) ||
    bytes < 0
  ) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} o`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(
      bytes / 1024
    )} Ko`;
  }

  if (
    bytes <
    1024 * 1024 * 1024
  ) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} Mo`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} Go`;
}

function getFileIcon(
  file: DriveFile
) {
  if (isFolder(file)) {
    return (
      <Folder
        size={23}
      />
    );
  }

  if (
    file.mimeType ===
      'application/pdf' ||
    file.mimeType.includes(
      'document'
    )
  ) {
    return (
      <FileText
        size={23}
      />
    );
  }

  return (
    <File
      size={23}
    />
  );
}

export default function DocumentsPage() {
  const [files, setFiles] =
    useState<DriveFile[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [
    connectionMessage,
    setConnectionMessage,
  ] = useState('');

  async function loadFiles() {
    setLoading(true);
    setError('');

    try {
      const response =
        await fetch(
          '/api/google/drive/files',
          {
            cache: 'no-store',
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger le Google Drive.'
        );
      }

      setFiles(
        data.files || []
      );
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
    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get('google') ===
      'connected'
    ) {
      setConnectionMessage(
        'La connexion Google Drive est bien enregistrée.'
      );
    }

    if (
      params.get('google')
    ) {
      window.history.replaceState(
        {},
        '',
        '/documents'
      );
    }

    void loadFiles();
  }, []);

  const filteredFiles =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return files;
      }

      return files.filter(
        (file) =>
          file.name
            .toLowerCase()
            .includes(value)
      );
    }, [
      files,
      search,
    ]);

  const folders =
    filteredFiles.filter(
      isFolder
    );

  const regularFiles =
    filteredFiles.filter(
      (file) =>
        !isFolder(file)
    );

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Gestion de l’association
          </div>

          <h1>
            Documents
          </h1>

          <div className="kicker">
            Gestion du Google Drive
            de l’association.
          </div>
        </div>

        <div className="topbar-right">
          <button
            className="btn"
            type="button"
            onClick={() =>
              void loadFiles()
            }
            disabled={loading}
          >
            {loading ? (
              <Loader2
                size={15}
                className="documents-spin"
              />
            ) : (
              <RefreshCw
                size={15}
              />
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
          <AlertCircle
            size={17}
          />

          <span>
            {error}
          </span>
        </div>
      )}

      <section className="card documents-drive-card">
        <div className="documents-drive-header">
          <div className="documents-drive-title">
            <div className="documents-drive-icon">
              <Cloud
                size={27}
              />
            </div>

            <div>
              <div className="eyebrow">
                Google Drive
              </div>

              <h2>
                Mon Drive
              </h2>

              <p>
                Contenu à la racine
                du Drive de
                l’association.
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
            <div className="documents-breadcrumb">
              <Cloud
                size={16}
              />

              <span>
                Mon Drive
              </span>
            </div>

            {filteredFiles.length ===
            0 ? (
              <div className="documents-empty">
                <FolderOpen
                  size={40}
                />

                <strong>
                  {search
                    ? 'Aucun élément trouvé'
                    : 'Le Drive est vide'}
                </strong>

                <span>
                  {search
                    ? 'Essaie une autre recherche.'
                    : 'Aucun fichier ou dossier n’est présent à la racine du Drive.'}
                </span>
              </div>
            ) : (
              <div className="documents-list">
                {folders.map(
                  (file) => (
                    <div
                      className="documents-row"
                      key={
                        file.id
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
                    </div>
                  )
                )}

                {regularFiles.map(
                  (file) => (
                    <div
                      className="documents-row"
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
                            className="btn documents-open-button"
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
          gap: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--gipe-line);
        }

        .documents-drive-title {
          display: flex;
          align-items: center;
          gap: 15px;
          min-width: 0;
        }

        .documents-drive-icon {
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: #fff0d9;
          color: #8f211c;
        }

        .documents-drive-title h2 {
          margin: 3px 0 3px;
          font-size: 21px;
        }

        .documents-drive-title p {
          margin: 0;
          color: var(--gipe-muted);
          font-size: 13px;
        }

        .documents-search {
          width: 280px;
          max-width: 100%;
        }

        .documents-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 17px 4px 12px;
          font-size: 13px;
          font-weight: 700;
          color: var(--gipe-muted);
        }

        .documents-list {
          border-top: 1px solid var(--gipe-line);
        }

        .documents-row {
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) 130px 110px;
          align-items: center;
          gap: 13px;
          min-width: 0;
          padding: 13px 8px;
          border-bottom: 1px solid var(--gipe-line);
        }

        .documents-row:last-child {
          border-bottom: 0;
        }

        .documents-row:hover {
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
        }

        .documents-open-button {
          min-width: 78px;
          min-height: 36px;
          justify-content: center;
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

        @keyframes documents-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 700px) {
          .documents-drive-header {
            flex-direction: column;
            align-items: stretch;
          }

          .documents-search {
            width: 100%;
          }

          .documents-row {
            grid-template-columns: 42px minmax(0, 1fr);
            gap: 10px;
            padding: 13px 4px;
          }

          .documents-row-date {
            grid-column: 2;
            grid-row: 2;
            text-align: left;
            margin-top: -7px;
          }

          .documents-row-action {
            grid-column: 2;
            grid-row: 3;
            justify-content: flex-start;
          }

          .documents-row-action:empty {
            display: none;
          }

          .documents-open-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
