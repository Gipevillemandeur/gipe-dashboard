import Link from 'next/link';
import { CalendarDays, FileText, GraduationCap, Users, Upload, Globe2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { getDashboardSnapshot } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();
  const realClasses = snapshot.classes.filter((c) => c.status === 'active');
  const students = realClasses.reduce((sum, c) => sum + c.students, 0);
  const demo = snapshot.classes.find((c) => c.status === 'demo');

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">Année scolaire {snapshot.schoolYear.replace("-", "–")}</div><h1>Tableau de bord</h1><div className="kicker">Tout ce qui concerne le GIPE, depuis un seul endroit.</div></div>
        <div className="topbar-right"><span className="user-pill">Administrateur GIPE</span></div>
      </div>

      <div className="page-grid cards-4">
        <div className="card stat"><div className="stat-top"><div className="stat-label">Classes actives</div><div className="stat-icon"><GraduationCap size={17}/></div></div><div className="stat-value">{realClasses.length}</div><div className="stat-note">La liste se met à jour depuis le fichier du collège.</div></div>
        <div className="card stat"><div className="stat-top"><div className="stat-label">Élèves</div><div className="stat-icon"><Users size={17}/></div></div><div className="stat-value">{students}</div><div className="stat-note">Situation actuelle de l'établissement.</div></div>
        <div className="card stat"><div className="stat-top"><div className="stat-label">Conseils à préparer</div><div className="stat-icon"><CalendarDays size={17}/></div></div><div className="stat-value">—</div><div className="stat-note">Dates à préparer dans le module Conseils.</div></div>
        <div className="card stat"><div className="stat-top"><div className="stat-label">Classe TEST</div><div className="stat-icon"><CheckCircle2 size={17}/></div></div><div className="stat-value">Active</div><div className="stat-note">Toujours conservée pour les démonstrations.</div></div>
      </div>

      <div className="page-grid two-col" style={{marginTop:18}}>
        <section className="card section-card">
          <div className="section-head"><div><h2 className="section-title">Accès rapides</h2><p className="section-sub">Les actions que le bureau utilise le plus.</p></div></div>
          <div className="quick-grid">
            <Link className="quick" href="/import-college"><div className="quick-icon"><Upload size={17}/></div><div><strong>Importer la liste du collège</strong><span>Élèves, classes et équipes.</span></div></Link>
            <Link className="quick" href="/conseils"><div className="quick-icon"><Users size={17}/></div><div><strong>Gérer les conseils</strong><span>Classes, codes et dates.</span></div></Link>
            <Link className="quick" href="#"><div className="quick-icon"><Globe2 size={17}/></div><div><strong>Modifier le site</strong><span>Actualités, événements, documents.</span></div></Link>
            <Link className="quick" href="#"><div className="quick-icon"><FileText size={17}/></div><div><strong>Documents du GIPE</strong><span>Accéder aux ressources du bureau.</span></div></Link>
          </div>
        </section>

        <section className="card section-card">
          <div className="section-head"><div><h2 className="section-title">À faire</h2><p className="section-sub">Les prochains éléments à vérifier.</p></div></div>
          <div className="list">
            <div className="list-item"><div className="item-main"><strong>Mettre à jour les listes du collège</strong><span>Après réception du prochain fichier.</span></div><span className="badge badge-warn">À faire</span></div>
            <div className="list-item"><div className="item-main"><strong>Conseil de classe 3A</strong><span>Date à confirmer dans le dashboard.</span></div><span className="badge badge-info">À préparer</span></div>
            <div className="list-item"><div className="item-main"><strong>Classe TEST</strong><span>Disponible pour les démonstrations.</span></div><span className="badge badge-ok">OK</span></div>
          </div>
        </section>
      </div>

      <section className="card section-card" style={{marginTop:18}}>
        <div className="section-head"><div><h2 className="section-title">Fonctionnement retenu</h2><p className="section-sub">Les données du collège alimentent l'année active ; la classe TEST reste permanente.</p></div><Link className="btn" href="/conseils">Voir les conseils <ArrowRight size={14} style={{verticalAlign:'middle'}}/></Link></div>
        <div className="notice"><CheckCircle2 size={16} color="#1d6d3a"/><div><strong>Import automatique de l'état courant</strong><br/>Le prochain fichier du collège remplacera la situation actuelle des élèves et des équipes. Les anciens PDF de comptes rendus restent dans la boîte mail du GIPE.</div></div>
      </section>

      <div className="footer-note">{snapshot.connected ? "Données chargées depuis Supabase." : "Mode démonstration : Supabase n'est pas encore connecté ou aucune année active n'est configurée."}</div>
    </>
  );
}
