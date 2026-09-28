import { GraduationCap, Users, HeartHandshake } from 'lucide-react';
import { getDashboardSnapshot } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();
  const realClasses = snapshot.classes.filter((c) => c.status === 'active');
  const students = realClasses.reduce((sum, c) => sum + c.students, 0);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Année scolaire {snapshot.schoolYear.replace("-", "–")}
          </div>

          <h1>Tableau de bord</h1>

          <div className="kicker">
            Tout ce qui concerne le GIPE, depuis un seul endroit.
          </div>
        </div>

        <div className="topbar-right">
          <span className="user-pill">Administrateur GIPE</span>
        </div>
      </div>

      <div className="page-grid cards-3">

        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">Classes actives</div>

            <div className="stat-icon">
              <GraduationCap size={17} />
            </div>
          </div>

          <div className="stat-value">
            {realClasses.length}
          </div>

          <div className="stat-note">
            Situation actuelle de l'établissement.
          </div>
        </div>


        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">Élèves</div>

            <div className="stat-icon">
              <Users size={17} />
            </div>
          </div>

          <div className="stat-value">
            {students}
          </div>

          <div className="stat-note">
            Situation actuelle de l'établissement.
          </div>
        </div>


        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">Adhérents</div>

            <div className="stat-icon">
              <HeartHandshake size={17} />
            </div>
          </div>

          <div className="stat-value">
            —
          </div>

          <div className="stat-note">
            Gestion des adhésions à venir.
          </div>
        </div>

      </div>


      <section
        className="card section-card"
        style={{ marginTop: 18 }}
      >
        <div className="section-head">

          <div>
            <h2 className="section-title">
              À faire
            </h2>

            <p className="section-sub">
              Les prochains éléments à vérifier ou à préparer.
            </p>
          </div>

        </div>


        <div className="list">

          <div className="list-item">
            <div className="item-main">
              <strong>
                Mettre à jour les listes du collège
              </strong>

              <span>
                Après réception du prochain fichier.
              </span>
            </div>

            <span className="badge badge-warn">
              À faire
            </span>
          </div>


          <div className="list-item">
            <div className="item-main">
              <strong>
                Conseil de classe 3A
              </strong>

              <span>
                Date à confirmer dans le module Conseils.
              </span>
            </div>

            <span className="badge badge-info">
              À préparer
            </span>
          </div>


          <div className="list-item">
            <div className="item-main">
              <strong>
                Classe TEST
              </strong>

              <span>
                Disponible pour les démonstrations.
              </span>
            </div>

            <span className="badge badge-ok">
              OK
            </span>
          </div>

        </div>
      </section>


      <div className="footer-note">
        {snapshot.connected
          ? "Données chargées depuis Supabase."
          : "Mode démonstration : Supabase n'est pas encore connecté ou aucune année active n'est configurée."}
      </div>
    </>
  );
}
