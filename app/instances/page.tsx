import Link from 'next/link'
import { ArrowLeft, CalendarDays, Plus } from 'lucide-react'

export default function InstancesPage() {
  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow"><CalendarDays size={16} />Scolarité</div>
          <h1>Instances</h1>
          <p>Gérez les réunions et instances de l'établissement, leurs informations et les documents associés.</p>
        </div>
        <Link href="/conseils" className="back-link"><ArrowLeft size={16} />Scolarité</Link>
      </section>

      <section className="toolbar">
        <div>
          <h2>Réunions</h2>
          <p>Les réunions à venir et passées seront regroupées ici.</p>
        </div>
        <button type="button" className="add-button" disabled><Plus size={18} />Ajouter une réunion</button>
      </section>

      <section className="empty-card">
        <div className="empty-icon"><CalendarDays size={30} /></div>
        <h2>Aucune réunion enregistrée</h2>
        <p>Commencez par ajouter votre première réunion. Vous pourrez ensuite y associer un résumé, un compte rendu et plusieurs documents.</p>
        <button type="button" className="empty-button" disabled><Plus size={17} />Ajouter une réunion</button>
      </section>

      <style>{`
        .page { display:grid; gap:24px; padding:28px; }
        .hero { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; }
        .eyebrow { display:inline-flex; align-items:center; gap:8px; margin-bottom:8px; color:#64748b; font-size:14px; font-weight:700; }
        h1 { margin:0; color:#0f172a; font-size:clamp(28px,4vw,38px); line-height:1.1; letter-spacing:-.03em; }
        .hero p { max-width:760px; margin:10px 0 0; color:#64748b; line-height:1.6; }
        .back-link { display:inline-flex; align-items:center; gap:7px; min-height:44px; padding:0 14px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; color:#475569; font-size:14px; font-weight:700; text-decoration:none; white-space:nowrap; }
        .back-link:hover { background:#f8fafc; }
        .toolbar { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:20px 22px; border:1px solid #e2e8f0; border-radius:16px; background:#fff; box-shadow:0 4px 16px rgba(15,23,42,.04); }
        .toolbar h2 { margin:0; color:#0f172a; font-size:19px; }
        .toolbar p { margin:5px 0 0; color:#64748b; font-size:14px; }
        .add-button, .empty-button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:42px; padding:0 16px; border:0; border-radius:10px; background:#8f211c; color:#fff; font-size:14px; font-weight:700; }
        .add-button:disabled, .empty-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .add-button:not(:disabled):hover,
        .empty-button:not(:disabled):hover {
          background: #7a1c18;
        }
        .empty-card { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:330px; padding:40px 24px; border:1px dashed #cbd5e1; border-radius:18px; background:#fff; text-align:center; }
        .empty-icon { display:grid; place-items:center; width:64px; height:64px; border-radius:16px; background:#f1f5f9; color:#64748b; }
        .empty-card h2 { margin:18px 0 0; color:#0f172a; font-size:20px; }
        .empty-card p { max-width:540px; margin:8px 0 20px; color:#64748b; line-height:1.6; }
        @media (max-width:760px) {
          .page { gap:18px; padding:18px 14px; }
          .hero { flex-direction:column; gap:14px; }
          .back-link { width:100%; justify-content:center; }
          .toolbar { align-items:stretch; flex-direction:column; padding:18px; }
          .add-button { width:100%; }
          .empty-card { min-height:300px; padding:32px 18px; }
          .empty-button { width:100%; max-width:280px; }
        }
      `}</style>
    </main>
  )
}

