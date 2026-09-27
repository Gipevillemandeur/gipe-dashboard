import Link from 'next/link';
import { ArrowLeft, Pencil, FlaskConical, ShieldCheck } from 'lucide-react';
import { classes } from '@/lib/mock-data';

export default function ConseilsPage() {
  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">Conseils de classe</div><h1>Gestion des classes</h1><div className="kicker">Les données courantes sont alimentées par le fichier reçu du collège.</div></div>
        <div className="topbar-right"><Link className="btn" href="/"><ArrowLeft size={14}/> Accueil</Link><Link className="btn btn-primary" href="/import-college">Importer le collège</Link></div>
      </div>

      <section className="card section-card">
        <div className="section-head"><div><h2 className="section-title">Classes actuelles</h2><p className="section-sub">Les classes réelles peuvent varier d'une année à l'autre. La classe TEST, elle, reste toujours disponible.</p></div></div>
        <table className="table"><thead><tr><th>Classe</th><th>Niveau</th><th>Élèves</th><th>Équipe</th><th>Type</th><th></th></tr></thead><tbody>
          {classes.map((c)=><tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.level}</td><td>{c.students}</td><td>{c.teachers}</td><td>{c.status==='demo'?<span className="badge badge-info"><FlaskConical size={12}/> Démonstration</span>:<span className="badge badge-ok"><ShieldCheck size={12}/> Réelle</span>}</td><td><button className="btn"><Pencil size={13}/> Modifier</button></td></tr>)}
        </tbody></table>
      </section>

      <section className="page-grid two-col" style={{marginTop:18}}>
        <div className="card section-card"><h2 className="section-title">Règle d'import</h2><p className="section-sub" style={{marginTop:8}}>Le fichier du collège devient la référence pour les classes, élèves et équipes pédagogiques de l'année active. Les changements normaux sont appliqués sans validation ligne par ligne.</p></div>
        <div className="card section-card"><h2 className="section-title">Classe TEST</h2><p className="section-sub" style={{marginTop:8}}>Cette classe est indépendante du fichier du collège et n'est jamais supprimée lors d'un import. Elle sert à présenter l'application aux parents délégués.</p></div>
      </section>
    </>
  );
}
