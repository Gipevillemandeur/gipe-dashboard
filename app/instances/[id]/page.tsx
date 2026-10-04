'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, Clock3, MapPin, Save, FileText } from 'lucide-react'

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export default function InstanceDetailPage({ params }: { params: { id: string } }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const response = await fetch(`/api/instances/${params.id}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Impossible de charger la réunion.')
        setMeeting(data.meeting)
        setSummary(data.meeting.summary || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossible de charger la réunion.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  async function saveSummary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!meeting) return
    try {
      setSaving(true); setSaved(false); setError('')
      const response = await fetch(`/api/instances/${meeting.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer le résumé.')
      setMeeting(data.meeting)
      setSummary(data.meeting.summary || '')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le résumé.')
    } finally { setSaving(false) }
  }

  if (loading) return <main className="page"><section className="state-card">Chargement de la réunion…</section></main>
  if (!meeting) return <main className="page"><section className="state-card"><h1>Réunion introuvable</h1><p>{error}</p><Link href="/instances" className="back-link"><ArrowLeft size={16}/> Retour aux réunions</Link></section></main>

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/instances" className="back-link"><ArrowLeft size={16}/> Retour aux réunions</Link>
        <span className="status">Réunion passée</span>
      </div>

      <section className="hero">
        <div>
          <span className="eyebrow">{meeting.type}</span>
          <h1>{meeting.subject}</h1>
          <div className="meta">
            <span><CalendarDays size={16}/> {formatDate(meeting.meeting_date)}</span>
            {meeting.meeting_time && <span><Clock3 size={16}/> {meeting.meeting_time.slice(0,5)}</span>}
            {meeting.location && <span><MapPin size={16}/> {meeting.location}</span>}
          </div>
        </div>
      </section>

      {error && <div className="error" role="alert">{error}</div>}

      <section className="info-card">
        <div className="section-title"><CalendarDays size={19}/><div><h2>Informations de la réunion</h2><p>Les informations enregistrées lors de la création de la réunion.</p></div></div>
        <div className="info-grid">
          <div><span>Type</span><strong>{meeting.type}</strong></div>
          <div><span>Objet</span><strong>{meeting.subject}</strong></div>
          <div><span>Date</span><strong>{formatDate(meeting.meeting_date)}</strong></div>
          <div><span>Heure</span><strong>{meeting.meeting_time?.slice(0,5) || '—'}</strong></div>
          <div className="full"><span>Lieu</span><strong>{meeting.location || '—'}</strong></div>
        </div>
      </section>

      <section className="content-card">
        <div className="section-title"><FileText size={19}/><div><h2>Résumé / compte rendu</h2><p>Ajoutez ici le résumé de ce qui a été dit et décidé lors de la réunion.</p></div></div>
        <form onSubmit={saveSummary}>
          <textarea value={summary} onChange={e => { setSummary(e.target.value); setSaved(false) }} placeholder="Saisissez le résumé ou le compte rendu de la réunion…" />
          <div className="actions">
            {saved && <span className="saved">Résumé enregistré.</span>}
            <button className="primary-button" type="submit" disabled={saving}><Save size={16}/>{saving ? 'Enregistrement…' : 'Enregistrer le résumé'}</button>
          </div>
        </form>
      </section>

      <section className="content-card future-card">
        <div className="section-title"><FileText size={19}/><div><h2>Documents</h2><p>Les documents liés à cette réunion seront ajoutés ici.</p></div></div>
        <div className="documents-placeholder">L’ajout de documents sera disponible dans la prochaine étape.</div>
      </section>

      <style>{`
        .page{display:grid;gap:22px;padding:28px;max-width:1180px;margin:0 auto}
        .topbar{display:flex;align-items:center;justify-content:space-between;gap:16px}
        .back-link{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:0 14px;border:1px solid #e4c8c5;border-radius:10px;background:#fff;color:#8f211c;font-size:14px;font-weight:700;text-decoration:none}
        .back-link:hover{background:#fff8f7}
        .status{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;background:#fff0d9;color:#302b27;font-size:12px;font-weight:800}
        .hero{padding:4px 0}
        .eyebrow{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:#fff0d9;color:#302b27;font-size:12px;font-weight:800}
        h1{margin:10px 0 0;color:#0f172a;font-size:clamp(28px,4vw,38px);line-height:1.12;letter-spacing:-.03em}
        .meta{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:12px;color:#64748b;font-size:14px}.meta span{display:inline-flex;align-items:center;gap:6px}
        .error{padding:12px 14px;border:1px solid #e8c7c4;border-radius:10px;background:#fff7f6;color:#8f211c;font-size:14px}
        .info-card,.content-card{padding:22px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.04)}
        .section-title{display:flex;align-items:flex-start;gap:12px;color:#302b27}.section-title>svg{flex:0 0 auto;margin-top:2px}.section-title h2{margin:0;color:#0f172a;font-size:19px}.section-title p{margin:5px 0 0;color:#64748b;font-size:14px;line-height:1.5}
        .info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:20px}.info-grid>div{display:grid;gap:6px;min-width:0;padding:14px;border-radius:11px;background:#fffaf4;border:1px solid #f0e5d8}.info-grid .full{grid-column:1/-1}.info-grid span{color:#64748b;font-size:12px;font-weight:700}.info-grid strong{color:#0f172a;font-size:14px;overflow-wrap:anywhere}
        form{margin-top:20px}textarea{display:block;width:100%;min-height:260px;box-sizing:border-box;resize:vertical;padding:14px;border:1px solid #e2d7d1;border-radius:10px;background:#fff;color:#0f172a;font:inherit;line-height:1.6;outline:none}textarea:focus{border-color:#8f211c;box-shadow:0 0 0 3px rgba(143,33,28,.08)}
        .actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:14px}.saved{margin-right:auto;color:#2f6b45;font-size:13px;font-weight:700}.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 16px;border:0;border-radius:10px;background:#8f211c;color:#fff;font-size:14px;font-weight:700;cursor:pointer}.primary-button:hover{background:#7a1c18}.primary-button:disabled{opacity:.55;cursor:not-allowed}
        .future-card{min-height:150px}.documents-placeholder{margin-top:18px;padding:20px;border:1px dashed #d8c5bd;border-radius:12px;background:#fffaf4;color:#64748b;font-size:14px;text-align:center}.state-card{display:grid;gap:12px;padding:32px;border:1px solid #e2e8f0;border-radius:16px;background:#fff}.state-card h1{font-size:24px}.state-card p{margin:0;color:#64748b}
        @media(max-width:700px){.page{gap:16px;padding:18px 14px}.topbar{align-items:stretch;flex-direction:column}.back-link{width:100%;justify-content:center}.status{align-self:flex-start}.info-card,.content-card{padding:18px}.info-grid{grid-template-columns:minmax(0,1fr);gap:12px}.info-grid .full{grid-column:auto}.actions{align-items:stretch;flex-direction:column}.saved{margin:0}.primary-button{width:100%}.meta{gap:9px 14px}.future-card{min-height:120px}}
      `}</style>
    </main>
  )
}
