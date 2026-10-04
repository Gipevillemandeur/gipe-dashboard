'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  X,
} from 'lucide-react'

type Meeting = {
  id: string
  type: string
  subject: string
  meeting_date: string
  meeting_time: string | null
  location: string | null
  school_year_id: string
}

type SchoolYear = {
  id: string
  label: string
}

const MEETING_TYPES = [
  'Réunion GIPE',
  'Conseil de classe',
  'Conseil de discipline',
  "Conseil d'administration",
  'Autre',
]

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function isPastMeeting(meeting: Meeting) {
  const meetingDateTime = new Date(
    `${meeting.meeting_date}T${meeting.meeting_time || '23:59'}`
  )

  return meetingDateTime.getTime() < Date.now()
}

export default function InstancesPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const [type, setType] = useState('Réunion GIPE')
  const [subject, setSubject] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [location, setLocation] = useState('')

  async function loadMeetings() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/instances', {
        cache: 'no-store',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Impossible de charger les réunions.')
      }

      setMeetings(data.meetings || [])
      setSchoolYear(data.schoolYear || null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les réunions.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMeetings()
  }, [])

  function resetForm() {
    setType('Réunion GIPE')
    setSubject('')
    setMeetingDate('')
    setMeetingTime('')
    setLocation('')
  }

  function openModal() {
    setError('')
    resetForm()
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setError('')

      const response = await fetch('/api/instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          subject,
          meetingDate,
          meetingTime,
          location,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'ajouter la réunion.")
      }

      setMeetings((current) =>
        [...current, data.meeting].sort((a, b) => {
          const aKey = `${a.meeting_date}T${a.meeting_time || '23:59'}`
          const bKey = `${b.meeting_date}T${b.meeting_time || '23:59'}`
          return aKey.localeCompare(bKey)
        })
      )

      setModalOpen(false)
      resetForm()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'ajouter la réunion."
      )
    } finally {
      setSaving(false)
    }
  }

  const upcomingMeetings = useMemo(
    () => meetings.filter((meeting) => !isPastMeeting(meeting)),
    [meetings]
  )

  const pastMeetings = useMemo(
    () => [...meetings.filter(isPastMeeting)].reverse(),
    [meetings]
  )

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <CalendarDays size={16} />
            Scolarité
          </div>

          <h1>Instances</h1>

          <p>
            Gérez les réunions et instances de l&apos;établissement, leurs
            informations et les documents associés.
          </p>
        </div>

        <Link href="/conseils" className="back-link">
          <ArrowLeft size={16} />
          Scolarité
        </Link>
      </section>

      <section className="toolbar">
        <div>
          <h2>Réunions</h2>
          <p>
            {schoolYear
              ? `Année scolaire ${schoolYear.label}`
              : 'Les réunions à venir et passées seront regroupées ici.'}
          </p>
        </div>

        <button type="button" className="add-button" onClick={openModal}>
          <Plus size={18} />
          Ajouter une réunion
        </button>
      </section>

      {error && !modalOpen && (
        <div className="page-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <section className="empty-card">
          <div className="empty-icon">
            <CalendarDays size={30} />
          </div>
          <h2>Chargement des réunions…</h2>
        </section>
      ) : meetings.length === 0 ? (
        <section className="empty-card">
          <div className="empty-icon">
            <CalendarDays size={30} />
          </div>

          <h2>Aucune réunion enregistrée</h2>

          <p>
            Commencez par ajouter votre première réunion. Vous pourrez ensuite
            y associer un résumé, un compte rendu et plusieurs documents.
          </p>
        </section>
      ) : (
        <section className="meeting-sections">
          {upcomingMeetings.length > 0 && (
            <div className="meeting-group">
              <div className="group-title">
                <h2>À venir</h2>
                <span>{upcomingMeetings.length}</span>
              </div>

              <div className="meeting-list">
                {upcomingMeetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </div>
          )}

          {pastMeetings.length > 0 && (
            <div className="meeting-group">
              <div className="group-title">
                <h2>Passées</h2>
                <span>{pastMeetings.length}</span>
              </div>

              <div className="meeting-list">
                {pastMeetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span>INSTANCE</span>
                <h2 id="meeting-modal-title">Ajouter une réunion</h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <div className="form-grid">
                <label>
                  <span>Type *</span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    required
                  >
                    {MEETING_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="full">
                  <span>Objet *</span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Ex. Préparation du bal de fin d'année"
                    maxLength={200}
                    required
                  />
                </label>

                <label>
                  <span>Date *</span>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(event) => setMeetingDate(event.target.value)}
                    required
                  />
                </label>

                <label>
                  <span>Heure *</span>
                  <input
                    type="time"
                    value={meetingTime}
                    onChange={(event) => setMeetingTime(event.target.value)}
                    required
                  />
                </label>

                <label className="full">
                  <span>Lieu</span>
                  <input
                    type="text"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Ex. Salle de réunion du collège"
                    maxLength={200}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page {
          display: grid;
          gap: 24px;
          padding: 28px;
        }

        .hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: #64748b;
          font-size: 14px;
          font-weight: 700;
        }

        h1 {
          margin: 0;
          color: #0f172a;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .hero p {
          max-width: 760px;
          margin: 10px 0 0;
          color: #64748b;
          line-height: 1.6;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 44px;
          padding: 0 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fff;
          color: #475569;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
        }

        .back-link:hover {
          background: #f8fafc;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 22px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .toolbar h2,
        .group-title h2 {
          margin: 0;
          color: #0f172a;
          font-size: 19px;
        }

        .toolbar p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .add-button,
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

        .add-button:hover,
        .primary-button:hover {
          background: #7a1c18;
        }

        .add-button:disabled,
        .primary-button:disabled,
        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .page-error,
        .form-error {
          padding: 12px 14px;
          border: 1px solid #e8c7c4;
          border-radius: 10px;
          background: #fff7f6;
          color: #8f211c;
          font-size: 14px;
        }

        .empty-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 330px;
          padding: 40px 24px;
          border: 1px dashed #cbd5e1;
          border-radius: 18px;
          background: #fff;
          text-align: center;
        }

        .empty-icon {
          display: grid;
          place-items: center;
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: #fff0d9;
          color: #302b27;
        }

        .empty-card h2 {
          margin: 18px 0 0;
          color: #0f172a;
          font-size: 20px;
        }

        .empty-card p {
          max-width: 540px;
          margin: 8px 0 0;
          color: #64748b;
          line-height: 1.6;
        }

        .meeting-sections {
          display: grid;
          gap: 24px;
        }

        .meeting-group {
          display: grid;
          gap: 12px;
        }

        .group-title {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .group-title span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 25px;
          height: 25px;
          padding: 0 7px;
          border-radius: 999px;
          background: #fff0d9;
          color: #302b27;
          font-size: 12px;
          font-weight: 700;
        }

        .meeting-list {
          display: grid;
          gap: 10px;
        }

        .meeting-card {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) auto;
          align-items: center;
          gap: 20px;
          padding: 18px 20px;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .meeting-main {
          min-width: 0;
        }

        .meeting-type {
          display: inline-flex;
          align-items: center;
          min-height: 25px;
          padding: 4px 9px;
          border-radius: 999px;
          background: #fff0d9;
          color: #302b27;
          font-size: 12px;
          font-weight: 700;
        }

        .meeting-main h3 {
          margin: 8px 0 0;
          color: #0f172a;
          font-size: 17px;
        }

        .meeting-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 18px;
          margin-top: 8px;
          color: #64748b;
          font-size: 13px;
        }

        .meeting-meta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.45);
        }

        .modal {
          width: min(620px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
        }

        .modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 24px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-head span {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .modal-head h2 {
          margin: 5px 0 0;
          color: #0f172a;
          font-size: 21px;
        }

        .close-button {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
          color: #475569;
          cursor: pointer;
        }

        .close-button:hover {
          background: #f8fafc;
        }

        .modal form {
          padding: 24px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 17px;
        }

        label {
          display: grid;
          gap: 7px;
        }

        label.full {
          grid-column: 1 / -1;
        }

        label > span {
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        input,
        select {
          width: 100%;
          min-height: 44px;
          box-sizing: border-box;
          padding: 0 12px;
          border: 1px solid #e2d7d1;
          border-radius: 10px;
          background: #fff;
          color: #0f172a;
          font: inherit;
          outline: none;
        }

        input:focus,
        select:focus {
          border-color: #8f211c;
          box-shadow: 0 0 0 3px rgba(143, 33, 28, 0.08);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid #eef2f7;
        }

        .secondary-button {
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid #e2d7d1;
          border-radius: 10px;
          background: #fff;
          color: #475569;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        @media (max-width: 760px) {
          .page {
            gap: 18px;
            padding: 18px 14px;
          }

          .hero {
            flex-direction: column;
            gap: 14px;
          }

          .back-link {
            width: 100%;
            justify-content: center;
          }

          .toolbar {
            align-items: stretch;
            flex-direction: column;
            padding: 18px;
          }

          .add-button {
            width: 100%;
          }

          .meeting-card {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .modal {
            width: 100%;
            max-height: 92vh;
            border-radius: 18px 18px 0 0;
          }

          .modal-head,
          .modal form {
            padding-left: 18px;
            padding-right: 18px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          label.full {
            grid-column: auto;
          }

          .modal-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </main>
  )
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <article className="meeting-card">
      <div className="meeting-main">
        <span className="meeting-type">{meeting.type}</span>
        <h3>{meeting.subject}</h3>

        <div className="meeting-meta">
          <span>
            <CalendarDays size={14} />
            {formatDate(meeting.meeting_date)}
          </span>

          {meeting.meeting_time && (
            <span>
              <Clock3 size={14} />
              {meeting.meeting_time.slice(0, 5)}
            </span>
          )}

          {meeting.location && (
            <span>
              <MapPin size={14} />
              {meeting.location}
            </span>
          )}
        </div>
      </div>

    </article>
  )
}

