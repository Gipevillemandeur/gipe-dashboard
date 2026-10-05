'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Save,
  FileText,
  Upload,
  Trash2,
  ExternalLink,
} from 'lucide-react'

type Meeting = {
  id: string
  type: string
  subject: string
  meeting_date: string
  meeting_time: string | null
  location: string | null
  school_year_id: string
  summary: string | null
}

type MeetingDocument = {
  id: string
  meeting_id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  created_at: string
  updated_at: string
  download_url: string | null
}

type PageProps = {
  params: Promise<{
    id: string
  }>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function formatFileSize(size: number | null) {
  if (!size) return ''

  if (size < 1024) {
    return `${size} o`
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} Ko`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} Mo`
}

export default function InstanceDetailPage({
  params,
}: PageProps) {
  const [meeting, setMeeting] =
    useState<Meeting | null>(null)

  const [summary, setSummary] = useState('')

  const [documents, setDocuments] =
    useState<MeetingDocument[]>([])

  const [loading, setLoading] = useState(true)
  const [documentsLoading, setDocumentsLoading] =
    useState(true)

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] =
    useState<string | null>(null)

  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function loadDocuments(id: string) {
    try {
      setDocumentsLoading(true)

      const response = await fetch(
        `/api/instances/${id}/documents`,
        {
          cache: 'no-store',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible de charger les documents.'
        )
      }

      setDocuments(data.documents || [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les documents.'
      )
    } finally {
      setDocumentsLoading(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')

        const { id } = await params

        const response = await fetch(
          `/api/instances/${id}`,
          {
            cache: 'no-store',
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.error ||
              'Impossible de charger la réunion.'
          )
        }

        setMeeting(data.meeting)
        setSummary(data.meeting.summary || '')

        await loadDocuments(id)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger la réunion.'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params])

  async function saveSummary(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!meeting) return

    try {
      setSaving(true)
      setSaved(false)
      setError('')

      const response = await fetch(
        `/api/instances/${meeting.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible d’enregistrer le résumé.'
        )
      }

      setMeeting(data.meeting)
      setSummary(data.meeting.summary || '')
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer le résumé.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!meeting) return

    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) return

    if (file.size > 50 * 1024 * 1024) {
      setError(
        'Le fichier dépasse la limite de 50 Mo.'
      )
      return
    }

    try {
      setUploading(true)
      setError('')

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(
        `/api/instances/${meeting.id}/documents`,
        {
          method: 'POST',
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible d’ajouter le document.'
        )
      }

      setDocuments((current) => [
        data.document,
        ...current,
      ])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’ajouter le document.'
      )
    } finally {
      setUploading(false)
    }
  }

  async function deleteDocument(
    document: MeetingDocument
  ) {
    if (!meeting) return

    const confirmed = window.confirm(
      `Supprimer le document « ${document.file_name} » ?`
    )

    if (!confirmed) return

    try {
      setDeletingDocumentId(document.id)
      setError('')

      const response = await fetch(
        `/api/instances/${meeting.id}/documents`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: document.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible de supprimer le document.'
        )
      }

      setDocuments((current) =>
        current.filter(
          (item) => item.id !== document.id
        )
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer le document.'
      )
    } finally {
      setDeletingDocumentId(null)
    }
  }

  if (loading) {
    return (
      <main className="page">
        <section className="state-card">
          Chargement de la réunion…
        </section>
      </main>
    )
  }

  if (!meeting) {
    return (
      <main className="page">
        <section className="state-card">
          <h1>Réunion introuvable</h1>

          <p>{error}</p>

          <Link
            href="/instances"
            className="back-link"
          >
            <ArrowLeft size={16} />
            Retour aux réunions
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <div className="topbar">
        <Link
          href="/instances"
          className="back-link"
        >
          <ArrowLeft size={16} />
          Retour aux réunions
        </Link>

        <span className="status">
          Réunion passée
        </span>
      </div>

      <section className="hero">
        <div>
          <span className="eyebrow">
            {meeting.type}
          </span>

          <h1>{meeting.subject}</h1>

          <div className="meta">
            <span>
              <CalendarDays size={16} />
              {formatDate(
                meeting.meeting_date
              )}
            </span>

            {meeting.meeting_time && (
              <span>
                <Clock3 size={16} />
                {meeting.meeting_time.slice(0, 5)}
              </span>
            )}

            {meeting.location && (
              <span>
                <MapPin size={16} />
                {meeting.location}
              </span>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <section className="info-card">
        <div className="section-title">
          <CalendarDays size={19} />

          <div>
            <h2>
              Informations de la réunion
            </h2>

            <p>
              Les informations enregistrées lors
              de la création de la réunion.
            </p>
          </div>
        </div>

        <div className="info-grid">
          <div>
            <span>Type</span>
            <strong>{meeting.type}</strong>
          </div>

          <div>
            <span>Objet</span>
            <strong>{meeting.subject}</strong>
          </div>

          <div>
            <span>Date</span>
            <strong>
              {formatDate(
                meeting.meeting_date
              )}
            </strong>
          </div>

          <div>
            <span>Heure</span>
            <strong>
              {meeting.meeting_time?.slice(0, 5) ||
                '—'}
            </strong>
          </div>

          <div className="full">
            <span>Lieu</span>
            <strong>
              {meeting.location || '—'}
            </strong>
          </div>
        </div>
      </section>

      <section className="content-card">
        <div className="section-title">
          <FileText size={19} />

          <div>
            <h2>
              Résumé / compte rendu
            </h2>

            <p>
              Ajoutez ici le résumé de ce qui a
              été dit et décidé lors de la
              réunion.
            </p>
          </div>
        </div>

        <form onSubmit={saveSummary}>
          <textarea
            value={summary}
            onChange={(event) => {
              setSummary(event.target.value)
              setSaved(false)
            }}
            placeholder="Saisissez le résumé ou le compte rendu de la réunion…"
          />

          <div className="actions">
            {saved && (
              <span className="saved">
                Résumé enregistré.
              </span>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={saving}
            >
              <Save size={16} />

              {saving
                ? 'Enregistrement…'
                : 'Enregistrer le résumé'}
            </button>
          </div>
        </form>
      </section>

      <section className="content-card">
        <div className="documents-header">
          <div className="section-title">
            <FileText size={19} />

            <div>
              <h2>Documents associés</h2>

              <p>
                Tous les documents de cette
                réunion seront conservés avec
                elle et archivés dans son dossier
                Drive lors de la clôture.
              </p>
            </div>
          </div>

          <label className="upload-button">
            <Upload size={16} />

            {uploading
              ? 'Envoi…'
              : 'Ajouter un document'}

            <input
              type="file"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {documentsLoading ? (
          <div className="documents-empty">
            Chargement des documents…
          </div>
        ) : documents.length === 0 ? (
          <div className="documents-empty">
            Aucun document associé à cette
            réunion pour le moment.
          </div>
        ) : (
          <div className="documents-list">
            {documents.map((document) => (
              <div
                key={document.id}
                className="document-row"
              >
                <div className="document-icon">
                  <FileText size={20} />
                </div>

                <div className="document-info">
                  <strong>
                    {document.file_name}
                  </strong>

                  <span>
                    {[
                      document.file_type,
                      formatFileSize(
                        document.file_size
                      ),
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                </div>

                <div className="document-actions">
                  {document.download_url && (
                    <a
                      href={
                        document.download_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="document-action"
                    >
                      <ExternalLink
                        size={15}
                      />
                      Ouvrir
                    </a>
                  )}

                  <button
                    type="button"
                    className="document-delete"
                    onClick={() =>
                      deleteDocument(
                        document
                      )
                    }
                    disabled={
                      deletingDocumentId ===
                      document.id
                    }
                    aria-label={`Supprimer ${document.file_name}`}
                  >
                    <Trash2 size={15} />

                    {deletingDocumentId ===
                    document.id
                      ? 'Suppression…'
                      : 'Supprimer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .page {
          display: grid;
          gap: 22px;
          padding: 28px;
          max-width: 1180px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 42px;
          padding: 0 14px;
          border: 1px solid #e4c8c5;
          border-radius: 10px;
          background: #fff;
          color: #8f211c;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .back-link:hover {
          background: #fff8f7;
        }

        .status {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          background: #fff0d9;
          color: #302b27;
          font-size: 12px;
          font-weight: 800;
        }

        .hero {
          padding: 4px 0;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #fff0d9;
          color: #302b27;
          font-size: 12px;
          font-weight: 800;
        }

        h1 {
          margin: 10px 0 0;
          color: #0f172a;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.12;
          letter-spacing: -0.03em;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 18px;
          margin-top: 12px;
          color: #64748b;
          font-size: 14px;
        }

        .meta span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .error {
          padding: 12px 14px;
          border: 1px solid #e8c7c4;
          border-radius: 10px;
          background: #fff7f6;
          color: #8f211c;
          font-size: 14px;
        }

        .info-card,
        .content-card {
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .section-title {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          color: #302b27;
        }

        .section-title > svg {
          flex: 0 0 auto;
          margin-top: 2px;
        }

        .section-title h2 {
          margin: 0;
          color: #0f172a;
          font-size: 19px;
        }

        .section-title p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .info-grid > div {
          display: grid;
          gap: 6px;
          min-width: 0;
          padding: 14px;
          border-radius: 11px;
          background: #fffaf4;
          border: 1px solid #f0e5d8;
        }

        .info-grid .full {
          grid-column: 1 / -1;
        }

        .info-grid span {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .info-grid strong {
          color: #0f172a;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        form {
          margin-top: 20px;
        }

        textarea {
          display: block;
          width: 100%;
          min-height: 260px;
          box-sizing: border-box;
          resize: vertical;
          padding: 14px;
          border: 1px solid #e2d7d1;
          border-radius: 10px;
          background: #fff;
          color: #0f172a;
          font: inherit;
          line-height: 1.6;
          outline: none;
        }

        textarea:focus {
          border-color: #8f211c;
          box-shadow: 0 0 0 3px rgba(143, 33, 28, 0.08);
        }

        .actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 14px;
        }

        .saved {
          margin-right: auto;
          color: #2f6b45;
          font-size: 13px;
          font-weight: 700;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border: 0;
          border-radius: 10px;
          background: #8f211c;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .primary-button:hover {
          background: #7a1c18;
        }

        .primary-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .documents-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .upload-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 15px;
          border-radius: 10px;
          background: #8f211c;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .upload-button:hover {
          background: #7a1c18;
        }

        .upload-button input {
          display: none;
        }

        .documents-empty {
          margin-top: 18px;
          padding: 22px;
          border: 1px dashed #d8c5bd;
          border-radius: 12px;
          background: #fffaf4;
          color: #64748b;
          font-size: 14px;
          text-align: center;
        }

        .documents-list {
          display: grid;
          gap: 10px;
          margin-top: 18px;
        }

        .document-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 12px 14px;
          border: 1px solid #eadfd5;
          border-radius: 11px;
          background: #fffaf4;
        }

        .document-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border-radius: 9px;
          background: #fff0d9;
          color: #8f211c;
        }

        .document-info {
          display: grid;
          gap: 4px;
          min-width: 0;
          flex: 1 1 auto;
        }

        .document-info strong {
          color: #0f172a;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .document-info span {
          color: #64748b;
          font-size: 12px;
        }

        .document-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .document-action,
        .document-delete {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 36px;
          padding: 0 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
        }

        .document-action {
          border: 1px solid #e4c8c5;
          background: #fff;
          color: #8f211c;
        }

        .document-action:hover {
          background: #fff8f7;
        }

        .document-delete {
          border: 1px solid #e4c8c5;
          background: #fff;
          color: #8f211c;
        }

        .document-delete:hover {
          background: #fff0ef;
        }

        .document-delete:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .state-card {
          display: grid;
          gap: 12px;
          padding: 32px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
        }

        .state-card h1 {
          font-size: 24px;
        }

        .state-card p {
          margin: 0;
          color: #64748b;
        }

        @media (max-width: 700px) {
          .page {
            gap: 16px;
            padding: 18px 14px;
          }

          .topbar {
            align-items: stretch;
            flex-direction: column;
          }

          .back-link {
            width: 100%;
            justify-content: center;
          }

          .status {
            align-self: flex-start;
          }

          .info-card,
          .content-card {
            padding: 18px;
          }

          .info-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
          }

          .info-grid .full {
            grid-column: auto;
          }

          .actions {
            align-items: stretch;
            flex-direction: column;
          }

          .saved {
            margin: 0;
          }

          .primary-button {
            width: 100%;
          }

          .meta {
            gap: 9px 14px;
          }

          .documents-header {
            align-items: stretch;
            flex-direction: column;
          }

          .upload-button {
            width: 100%;
          }

          .document-row {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .document-info {
            min-width: calc(100% - 52px);
          }

          .document-actions {
            width: 100%;
            margin-left: 50px;
          }

          .document-action,
          .document-delete {
            flex: 1 1 0;
          }
        }
      `}</style>
    </main>
  )
}
