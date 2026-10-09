'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Clock3, MapPin, Pencil, Trash2, X } from 'lucide-react'

type Meeting = {
  id:string
  type:string
  subject:string
  meeting_date:string
  meeting_time:string|null
  location:string|null
  school_year_id:string
}

type SchoolYear = {
  id:string
  label:string
}

const MEETING_TYPES = [
  'Réunion GIPE',
  'Conseil de classe',
  'Conseil de discipline',
  "Conseil d'administration",
  'Autre'
]

function formatDate(v:string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day:'2-digit',
    month:'2-digit',
    year:'numeric'
  }).format(new Date(`${v}T00:00:00`))
}

function isPast(m:Meeting) {
  return new Date(
    `${m.meeting_date}T${m.meeting_time || '23:59'}`
  ).getTime() < Date.now()
}

export default function InstancesPage() {
  const [meetings,setMeetings] = useState<Meeting[]>([])
  const [schoolYear,setSchoolYear] = useState<SchoolYear|null>(null)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [deleting,setDeleting] = useState(false)
  const [error,setError] = useState('')
  const [modalMode,setModalMode] = useState<'edit'|null>(null)
  const [selected,setSelected] = useState<Meeting|null>(null)

  const [type,setType] = useState(MEETING_TYPES[0])
  const [subject,setSubject] = useState('')
  const [date,setDate] = useState('')
  const [time,setTime] = useState('')
  const [location,setLocation] = useState('')

  async function load() {
    try {
      setLoading(true)

      const r = await fetch('/api/instances', {
        cache:'no-store'
      })

      const d = await r.json()

      if (!r.ok) {
        throw Error(
          d.error || 'Impossible de charger les réunions.'
        )
      }

      setMeetings(d.meetings || [])
      setSchoolYear(d.schoolYear || null)
    } catch(e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de charger les réunions.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function reset() {
    setType(MEETING_TYPES[0])
    setSubject('')
    setDate('')
    setTime('')
    setLocation('')
  }

  function edit(m:Meeting) {
    setError('')
    setSelected(m)
    setType(m.type)
    setSubject(m.subject)
    setDate(m.meeting_date)
    setTime(m.meeting_time?.slice(0,5) || '')
    setLocation(m.location || '')
    setModalMode('edit')
  }

  function close() {
    if (!saving && !deleting) {
      setModalMode(null)
      setSelected(null)
    }
  }

  async function submit(e:React.FormEvent) {
    e.preventDefault()

    try {
      setSaving(true)
      setError('')

      const r = await fetch('/api/instances', {
        method:'PUT',
        headers:{
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          id:selected?.id,
          type,
          subject,
          meetingDate:date,
          meetingTime:time,
          location
        })
      })

      const d = await r.json()

      if (!r.ok) {
        throw Error(
          d.error || 'Impossible d’enregistrer la réunion.'
        )
      }

      setMeetings(cur => {
        const n = cur.map(m =>
          m.id === d.meeting.id
            ? d.meeting
            : m
        )

        return [...n].sort((a,b) =>
          `${a.meeting_date}T${a.meeting_time || '23:59'}`
            .localeCompare(
              `${b.meeting_date}T${b.meeting_time || '23:59'}`
            )
        )
      })

      close()
      reset()
    } catch(e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible d’enregistrer la réunion.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function del(meeting:Meeting) {
    if (
      !window.confirm(
        `Supprimer la réunion « ${meeting.subject} » ?\n\nCette action est définitive.`
      )
    ) {
      return
    }

    try {
      setDeleting(true)

      const r = await fetch('/api/instances', {
        method:'DELETE',
        headers:{
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          id:meeting.id
        })
      })

      const d = await r.json()

      if (!r.ok) {
        throw Error(
          d.error || 'Impossible de supprimer la réunion.'
        )
      }

      setMeetings(cur =>
        cur.filter(m => m.id !== meeting.id)
      )

      if (selected?.id === meeting.id) {
        setModalMode(null)
        setSelected(null)
        reset()
      }
    } catch(e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de supprimer la réunion.'
      )
    } finally {
      setDeleting(false)
    }
  }

  const upcoming = useMemo(
    () => meetings.filter(m => !isPast(m)),
    [meetings]
  )

  const past = useMemo(
    () => [...meetings.filter(isPast)].reverse(),
    [meetings]
  )

  return (
    <main className="page">

      <section className="hero">
        <div>
          <div className="eyebrow">
            <CalendarDays size={16}/>
            Scolarité
          </div>

          <h1>Instances</h1>

          <p>
            Gérez les réunions et instances de l’établissement,
            leurs informations et leur suivi.
          </p>
        </div>

        <Link
          href="/conseils"
          className="back-link"
        >
          <ArrowLeft size={16}/>
          Scolarité
        </Link>
      </section>

      {error && !modalMode && (
        <div className="page-error">
          {error}
        </div>
      )}

      {loading ? (
        <section className="empty-card">
          <div className="empty-icon">
            <CalendarDays size={30}/>
          </div>

          <h2>Chargement des réunions…</h2>
        </section>
      ) : meetings.length === 0 ? (
        <section className="empty-card">
          <div className="empty-icon">
            <CalendarDays size={30}/>
          </div>

          <h2>Aucune réunion enregistrée</h2>

          <p>
            Les réunions sont créées depuis l’Agenda.
          </p>
        </section>
      ) : (
        <section className="meeting-sections">

          {upcoming.length > 0 && (
            <div className="meeting-group">

              <div className="group-title">
                <h2>À venir</h2>
                <span>{upcoming.length}</span>
              </div>

              <div className="meeting-list">
                {upcoming.map(m => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    past={false}
                    onEdit={() => edit(m)}
                    onDelete={() => del(m)}
                  />
                ))}
              </div>

            </div>
          )}

          {past.length > 0 && (
            <div className="meeting-group">

              <div className="group-title">
                <h2>Passées</h2>
                <span>{past.length}</span>
              </div>

              <div className="meeting-list">
                {past.map(m => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    past
                    onEdit={() => edit(m)}
                    onDelete={() => del(m)}
                  />
                ))}
              </div>

            </div>
          )}

        </section>
      )}

      {modalMode && (
        <div
          className="modal-backdrop"
          onMouseDown={close}
        >
          <div
            className="modal"
            onMouseDown={e => e.stopPropagation()}
          >

            <div className="modal-head">
              <div>
                <span>INSTANCE</span>
                <h2>Modifier la réunion</h2>
              </div>

              <button
                className="close-button"
                onClick={close}
                disabled={saving || deleting}
              >
                <X size={20}/>
              </button>
            </div>

            <form onSubmit={submit}>

              <div className="form-grid">

                <label>
                  <span>Type *</span>

                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    required
                  >
                    {MEETING_TYPES.map(x => (
                      <option key={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="full">
                  <span>Objet *</span>

                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    maxLength={200}
                    required
                  />
                </label>

                <div className="documents-two-columns">

                  <div className="documents-field">
                    <label>Date *</label>

                    <input
                      className="documents-date-input"
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="documents-field">
                    <label>Heure *</label>

                    <input
                      className="documents-date-input"
                      type="time"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      required
                    />
                  </div>

                </div>

                <label className="full">
                  <span>Lieu</span>

                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    maxLength={200}
                  />
                </label>

              </div>

              {error && (
                <div className="form-error">
                  {error}
                </div>
              )}

              <div className="modal-actions">

                <div className="modal-actions-right">

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={close}
                    disabled={saving}
                  >
                    Annuler
                  </button>

                  <button
                    className="primary-button"
                    disabled={saving}
                  >
                    <Pencil size={16}/>
                    {saving
                      ? 'Enregistrement…'
                      : 'Enregistrer'}
                  </button>

                </div>

              </div>

            </form>

          </div>
        </div>
      )}

      <style>{`

        .page{
          display:grid;
          gap:24px;
          padding:28px
        }

        .hero{
          display:flex;
          justify-content:space-between;
          gap:24px
        }

        .eyebrow{
          display:inline-flex;
          gap:8px;
          align-items:center;
          margin-bottom:8px;
          color:#64748b;
          font-size:14px;
          font-weight:700
        }

        h1{
          margin:0;
          color:#0f172a;
          font-size:clamp(28px,4vw,38px)
        }

        .hero p{
          max-width:760px;
          margin:10px 0 0;
          color:#64748b;
          line-height:1.6
        }

        .back-link{
          display:inline-flex;
          align-items:center;
          gap:7px;
          min-height:44px;
          padding:0 14px;
          border:1px solid #e2e8f0;
          border-radius:12px;
          background:#fff;
          color:#475569;
          font-weight:700;
          text-decoration:none
        }

        .page-error,
        .form-error{
          padding:12px 14px;
          border:1px solid #e8c7c4;
          border-radius:10px;
          background:#fff7f6;
          color:#8f211c
        }

        .empty-card{
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          min-height:330px;
          padding:40px 24px;
          border:1px dashed #cbd5e1;
          border-radius:18px;
          background:#fff;
          text-align:center
        }

        .empty-icon{
          display:grid;
          place-items:center;
          width:64px;
          height:64px;
          border-radius:16px;
          background:#fff0d9;
          color:#302b27
        }

        .empty-card h2{
          margin:18px 0 0
        }

        .empty-card p{
          color:#64748b
        }

        .meeting-sections{
          display:grid;
          gap:24px
        }

        .meeting-group{
          display:grid;
          gap:12px
        }

        .group-title{
          display:flex;
          align-items:center;
          gap:9px
        }

        .group-title h2{
          margin:0;
          color:#0f172a;
          font-size:19px
        }

        .group-title span{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:25px;
          height:25px;
          border-radius:999px;
          background:#fff0d9;
          color:#302b27;
          font-size:12px;
          font-weight:700
        }

        .meeting-list{
          display:grid;
          gap:10px
        }

        .meeting-card{
          display:grid;
          grid-template-columns:minmax(220px,1fr) auto;
          align-items:center;
          gap:20px;
          padding:18px 20px;
          border:1px solid #e2e8f0;
          border-radius:15px;
          background:#fff;
          box-shadow:0 4px 16px rgba(15,23,42,.04);
          text-decoration:none;
          color:inherit
        }

        .meeting-card.clickable{
          cursor:pointer
        }

        .meeting-card.clickable:hover{
          border-color:#d8b8b4;
          box-shadow:0 8px 22px rgba(15,23,42,.07)
        }

        .meeting-main{
          min-width:0
        }

        .meeting-type{
          display:inline-flex;
          padding:4px 9px;
          border-radius:999px;
          background:#fff0d9;
          color:#302b27;
          font-size:12px;
          font-weight:700
        }

        .meeting-main h3{
          margin:8px 0 0;
          color:#0f172a;
          font-size:17px
        }

        .meeting-meta{
          display:flex;
          flex-wrap:wrap;
          gap:12px 18px;
          margin-top:8px;
          color:#64748b;
          font-size:13px
        }

        .meeting-meta span{
          display:inline-flex;
          align-items:center;
          gap:5px
        }

        .meeting-actions{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap:8px;
          flex-wrap:wrap
        }

        .open-hint,
        .edit-hint,
        .delete-hint{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:7px;
          min-height:40px;
          padding:0 14px;
          border:1px solid #e4c8c5;
          border-radius:10px;
          background:#fff;
          color:#8f211c;
          font-size:14px;
          font-weight:700;
          cursor:pointer;
          text-decoration:none
        }

        .delete-hint:hover{
          background:#fff5f4
        }

        .modal-backdrop{
          position:fixed;
          inset:0;
          z-index:1000;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:20px;
          background:rgba(15,23,42,.45)
        }

        .modal{
          width:min(620px,100%);
          max-height:calc(100vh - 40px);
          overflow-y:auto;
          border-radius:18px;
          background:#fff;
          box-shadow:0 20px 60px rgba(15,23,42,.2)
        }

        .modal-head{
          display:flex;
          justify-content:space-between;
          gap:16px;
          padding:22px 24px;
          border-bottom:1px solid #e2e8f0
        }

        .modal-head span{
          color:#64748b;
          font-size:11px;
          font-weight:800;
          letter-spacing:.08em
        }

        .modal-head h2{
          margin:5px 0 0;
          font-size:21px
        }

        .close-button{
          display:grid;
          place-items:center;
          width:38px;
          height:38px;
          border:1px solid #e2e8f0;
          border-radius:10px;
          background:#fff;
          color:#475569;
          cursor:pointer
        }

        .modal form{
          padding:24px;
          min-width:0
        }

        .form-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:16px;
          min-width:0
        }

        .form-grid>label{
          display:grid;
          gap:7px;
          min-width:0
        }

        .form-grid>label.full{
          grid-column:1/-1
        }

        .form-grid label>span{
          color:#334155;
          font-size:13px;
          font-weight:700
        }

        .form-grid input,
        .form-grid select{
          width:100%;
          min-width:0;
          max-width:100%;
          min-height:44px;
          box-sizing:border-box;
          padding:0 12px;
          border:1px solid #e2d7d1;
          border-radius:10px;
          background:#fff;
          color:#0f172a;
          font:inherit
        }

        .documents-field{
          display:grid;
          gap:7px;
          font-size:12px;
          font-weight:700;
          min-width:0
        }

        .documents-two-columns{
          display:grid;
          grid-template-columns:minmax(0,1fr) minmax(0,1fr);
          gap:16px;
          min-width:0;
          grid-column:1/-1
        }

        .documents-date-input{
          width:100%!important;
          min-width:0!important;
          max-width:100%!important;
          height:44px!important;
          min-height:44px!important;
          box-sizing:border-box!important;
          padding:0 12px!important;
          text-align:center!important;
          line-height:normal!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important
        }

        .documents-date-input::-webkit-datetime-edit{
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          width:100%!important;
          height:100%!important;
          padding:0!important;
          margin:0!important
        }

        .documents-date-input::-webkit-datetime-edit-fields-wrapper{
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          width:100%!important;
          height:100%!important;
          padding:0!important;
          margin:0!important
        }

        .documents-date-input::-webkit-date-and-time-value{
          text-align:center!important;
          line-height:normal!important
        }

        .modal-actions{
          display:flex;
          justify-content:flex-end;
          gap:10px;
          margin-top:24px;
          padding-top:18px;
          border-top:1px solid #eef2f7
        }

        .modal-actions-right{
          display:flex;
          gap:10px
        }

        .secondary-button,
        .primary-button{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:7px;
          min-height:42px;
          padding:0 16px;
          border-radius:10px;
          font-weight:700;
          cursor:pointer
        }

        .secondary-button{
          border:1px solid #e2d7d1;
          background:#fff;
          color:#475569
        }

        .primary-button{
          border:0;
          background:#8f211c;
          color:#fff
        }

        .primary-button:hover{
          background:#7a1c18
        }

        @media(max-width:760px){

          .page{
            gap:18px;
            padding:18px 14px
          }

          .hero{
            flex-direction:column
          }

          .back-link{
            width:auto;
            align-self:flex-start;
            justify-content:center
          }

          .meeting-card{
            grid-template-columns:1fr;
            gap:14px
          }

          .meeting-actions{
            width:100%;
            justify-content:stretch
          }

          .open-hint,
          .edit-hint,
          .delete-hint{
            flex:1;
            width:auto
          }

          .modal-backdrop{
            align-items:flex-end;
            padding:0
          }

          .modal{
            width:100%;
            max-height:92vh;
            border-radius:18px 18px 0 0
          }

          .modal-head,
          .modal form{
            padding-left:18px;
            padding-right:18px
          }

          .form-grid{
            grid-template-columns:minmax(0,1fr)
          }

          .form-grid>label.full{
            grid-column:auto
          }

          .documents-two-columns{
            grid-template-columns:minmax(0,1fr);
            gap:16px;
            grid-column:auto
          }

          .documents-date-input{
            width:100%!important;
            min-width:0!important;
            max-width:100%!important;
            height:48px!important;
            min-height:48px!important;
            box-sizing:border-box!important;
            padding:0 12px!important;
            display:flex!important;
            align-items:center!important;
            justify-content:center!important;
            -webkit-appearance:none!important;
            appearance:none!important;
            text-align:center!important;
            line-height:normal!important
          }

          .documents-date-input::-webkit-datetime-edit{
            display:flex!important;
            align-items:center!important;
            justify-content:center!important;
            width:100%!important;
            height:100%!important;
            padding:0!important;
            margin:0!important
          }

          .documents-date-input::-webkit-datetime-edit-fields-wrapper{
            display:flex!important;
            align-items:center!important;
            justify-content:center!important;
            width:100%!important;
            height:100%!important;
            padding:0!important;
            margin:0!important
          }

          .documents-date-input::-webkit-date-and-time-value{
            text-align:center!important;
            line-height:normal!important
          }

          .modal-actions{
            align-items:stretch;
            flex-direction:column
          }

          .modal-actions-right{
            display:grid;
            grid-template-columns:1fr 1fr
          }

        }

      `}</style>

    </main>
  )
}

function MeetingCard({
  meeting,
  past,
  onEdit,
  onDelete
}:{
  meeting:Meeting
  past:boolean
  onEdit:()=>void
  onDelete:()=>void
}) {

  return (
    <article className="meeting-card">

      <div className="meeting-main">

        <span className="meeting-type">
          {meeting.type}
        </span>

        <h3>{meeting.subject}</h3>

        <div className="meeting-meta">

          <span>
            <CalendarDays size={14}/>
            {formatDate(meeting.meeting_date)}
          </span>

          {meeting.meeting_time && (
            <span>
              <Clock3 size={14}/>
              {meeting.meeting_time.slice(0,5)}
            </span>
          )}

          {meeting.location && (
            <span>
              <MapPin size={14}/>
              {meeting.location}
            </span>
          )}

        </div>

      </div>

      <div className="meeting-actions">

        {past ? (
          <Link
            href={`/instances/${meeting.id}`}
            className="open-hint"
          >
            Ouvrir la réunion
          </Link>
        ) : (
          <button
            className="edit-hint"
            onClick={onEdit}
          >
            <Pencil size={15}/>
            Modifier
          </button>
        )}

        {past ? null : null}

        <button
          className="delete-hint"
          onClick={onDelete}
        >
          <Trash2 size={15}/>
          Supprimer
        </button>

      </div>

    </article>
  )
}
