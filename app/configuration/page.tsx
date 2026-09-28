'use client';

import Link from 'next/link';
import { ArrowLeft, GraduationCap, Users } from 'lucide-react';

export default function ConfigurationPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Configuration</div>
          <h1>Configuration des conseils</h1>
          <div className="kicker">
            Gère séparément les classes et la direction du collège.
          </div>
        </div>

        <div className="topbar-right">
          <Link className="btn" href="/conseils">
            <ArrowLeft size={14} /> Conseils de classe
          </Link>
        </div>
      </div>

      <div
  className="page-grid"
  style={{
    gridTemplateColumns: '1fr 1fr',
  }}
>

        <Link
          href="/configuration/classes"
          className="card section-card"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="stat-top">
            <div className="stat-label">Classes</div>

            <div className="stat-icon">
              <GraduationCap size={17} />
            </div>
          </div>

          <h2 className="section-title" style={{ marginTop: 14 }}>
            Gérer les classes
          </h2>

          <p className="section-sub" style={{ marginTop: 8 }}>
            Consulter les classes actives et modifier leurs codes d’accès
            aux conseils de classe.
          </p>

          <div style={{ marginTop: 18 }}>
            <span className="btn btn-primary">
              Ouvrir la gestion des classes →
            </span>
          </div>
        </Link>


        <Link
          href="/configuration/direction"
          className="card section-card"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="stat-top">
            <div className="stat-label">Direction</div>

            <div className="stat-icon">
              <Users size={17} />
            </div>
          </div>

          <h2 className="section-title" style={{ marginTop: 14 }}>
            Gérer la direction
          </h2>

          <p className="section-sub" style={{ marginTop: 8 }}>
            Ajouter, modifier ou supprimer les membres de la direction
            utilisés dans les comptes rendus.
          </p>

          <div style={{ marginTop: 18 }}>
            <span className="btn btn-primary">
              Ouvrir la gestion de la direction →
            </span>
          </div>
        </Link>

      </div>
    </>
  );
}
