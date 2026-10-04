import Link from 'next/link';
import {
  ArrowLeft,
  Pencil,
  FlaskConical,
  ShieldCheck,
  GraduationCap,
  Users,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';

import { getDashboardSnapshot } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function ConseilsPage() {
  const snapshot = await getDashboardSnapshot();

  const realClasses = snapshot.classes.filter(
    (c) => c.status === 'active'
  );

  const students = realClasses.reduce(
    (sum, c) => sum + c.students,
    0
  );

  const demo = snapshot.classes.find(
    (c) => c.status === 'demo'
  );

  return (
    <>
      <div className="topbar conseils-topbar">
        <div>
          <div className="eyebrow">
            Conseils de classe
          </div>

          <h1>
            Gestion des classes
          </h1>

          <div className="kicker">
            {snapshot.connected
              ? `Année active : ${snapshot.schoolYear}`
              : 'Mode démonstration : base Supabase non connectée.'}
          </div>
        </div>

        <div className="topbar-right conseils-topbar-action">
          <Link className="btn conseils-home-button" href="/">
            <ArrowLeft size={14} />
            Accueil
          </Link>
        </div>
      </div>

      <div className="page-grid cards-4 conseils-stats-grid">
        <div className="card stat conseils-stat-card">
          <div className="stat-top">
            <div className="stat-label">
              Classes actives
            </div>

            <div className="stat-icon">
              <GraduationCap size={17} />
            </div>
          </div>

          <div className="stat-value">
            {realClasses.length}
          </div>

          <div className="stat-note">
            Classes réelles de l'année active.
          </div>
        </div>

        <div className="card stat conseils-stat-card">
          <div className="stat-top">
            <div className="stat-label">
              Élèves
            </div>

            <div className="stat-icon">
              <Users size={17} />
            </div>
          </div>

          <div className="stat-value">
            {students}
          </div>

          <div className="stat-note">
            Élèves des classes réelles.
          </div>
        </div>

        <div className="card stat conseils-stat-card">
          <div className="stat-top">
            <div className="stat-label">
              Conseils à préparer
            </div>

            <div className="stat-icon">
              <CalendarDays size={17} />
            </div>
          </div>

          <div className="stat-value">
            —
          </div>

          <div className="stat-note">
            Dates et préparation des conseils.
          </div>
        </div>

        <div className="card stat conseils-stat-card">
          <div className="stat-top">
            <div className="stat-label">
              Classe TEST
            </div>

            <div className="stat-icon">
              <CheckCircle2 size={17} />
            </div>
          </div>

          <div className="stat-value">
            {demo ? 'Active' : '—'}
          </div>

          <div className="stat-note">
            Conservée pour les démonstrations.
          </div>
        </div>
      </div>

      <section className="card section-card conseils-classes-section">
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Classes actuelles
            </h2>

            <p className="section-sub">
              Les classes réelles proviennent du dernier
              import du collège. La classe TEST reste disponible.
            </p>
          </div>
        </div>

        <div className="conseils-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Niveau</th>
                <th>Élèves</th>
                <th>Équipe</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {snapshot.classes.map((c) => (
                <tr key={c.name}>
                  <td>
                    <strong>
                      {c.name}
                    </strong>
                  </td>

                  <td>
                    {c.level}
                  </td>

                  <td>
                    {c.students}
                  </td>

                  <td>
                    {c.teachers}
                  </td>

                  <td>
                    {c.status === 'demo' ? (
                      <span className="badge badge-info">
                        <FlaskConical size={12} />
                        Démonstration
                      </span>
                    ) : (
                      <span className="badge badge-ok">
                        <ShieldCheck size={12} />
                        Réelle
                      </span>
                    )}
                  </td>

                  <td>
                    <button
                      className="btn conseils-edit-button"
                      type="button"
                    >
                      <Pencil size={13} />
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="conseils-mobile-list">
          {snapshot.classes.map((c) => (
            <div
              className="conseils-mobile-card"
              key={c.name}
            >
              <div className="conseils-mobile-card-head">
                <div>
                  <strong>
                    {c.name}
                  </strong>

                  <span>
                    {c.level}
                  </span>
                </div>

                <button
                  className="btn conseils-edit-button"
                  type="button"
                >
                  <Pencil size={13} />
                  Modifier
                </button>
              </div>

              <div className="conseils-mobile-details">
                <div>
                  <span>Élèves</span>
                  <strong>{c.students}</strong>
                </div>

                <div>
                  <span>Équipe</span>
                  <strong>{c.teachers}</strong>
                </div>

                <div>
                  <span>Type</span>

                  {c.status === 'demo' ? (
                    <span className="badge badge-info">
                      <FlaskConical size={12} />
                      Démonstration
                    </span>
                  ) : (
                    <span className="badge badge-ok">
                      <ShieldCheck size={12} />
                      Réelle
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="page-grid two-col conseils-bottom-grid">
        <div className="card section-card">
          <h2 className="section-title">
            Règle d'import
          </h2>

          <p className="section-sub conseils-bottom-text">
            Le fichier du collège devient la référence
            pour les classes, élèves et équipes pédagogiques.
            Les anciens comptes rendus PDF ne sont pas stockés ici.
          </p>
        </div>

        <div className="card section-card">
          <h2 className="section-title">
            Classe TEST
          </h2>

          <p className="section-sub conseils-bottom-text">
            Cette classe est indépendante du fichier du collège.
            Elle sert à présenter l'application et à former les
            futurs parents délégués.
          </p>
        </div>
      </section>

      <style jsx>{`
        .conseils-classes-section {
          margin-top: 18px;
        }

        .conseils-bottom-grid {
          margin-top: 18px;
        }

        .conseils-bottom-text {
          margin-top: 8px;
        }

        .conseils-table-wrap {
          overflow-x: auto;
        }

        .conseils-mobile-list {
          display: none;
        }

        .conseils-edit-button {
          white-space: nowrap;
        }

        .conseils-mobile-card {
          border: 1px solid #eadfd4;
          border-radius: 12px;
          padding: 14px;
          background: #fff;
          display: grid;
          gap: 14px;
        }

        .conseils-mobile-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .conseils-mobile-card-head > div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .conseils-mobile-card-head strong {
          font-size: 15px;
        }

        .conseils-mobile-card-head span {
          font-size: 11px;
          color: #756a67;
        }

        .conseils-mobile-details {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .conseils-mobile-details > div {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .conseils-mobile-details > div > span:first-child {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #756a67;
          font-weight: 700;
        }

        @media (max-width: 760px) {
          .conseils-topbar {
            align-items: flex-start;
          }

          .conseils-topbar-action {
            width: auto;
          }

          .conseils-home-button {
            width: auto;
            white-space: nowrap;
          }

          .conseils-stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .conseils-stat-card {
            min-width: 0;
          }

          .conseils-classes-section {
            margin-top: 14px;
          }

          .conseils-table-wrap {
            display: none;
          }

          .conseils-mobile-list {
            display: grid;
            gap: 10px;
          }

          .conseils-bottom-grid {
            grid-template-columns: 1fr;
            margin-top: 14px;
          }

          .conseils-mobile-details {
            grid-template-columns: 1fr 1fr;
          }

          .conseils-mobile-details > div:last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 480px) {
          .conseils-stats-grid {
            grid-template-columns: 1fr;
          }

          .conseils-mobile-card {
            padding: 12px;
          }

          .conseils-mobile-card-head {
            align-items: center;
          }

          .conseils-mobile-card-head .btn {
            flex: 0 0 auto;
          }

          .conseils-mobile-details {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </>
  );
}
