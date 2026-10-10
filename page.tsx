import Link from 'next/link';
import {
  AlertTriangle,
  GraduationCap,
  Users,
  HeartHandshake,
} from 'lucide-react';

import { getDashboardSnapshot } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  const realClasses =
    snapshot.classes.filter(
      (c) => c.status === 'active'
    );

  const students =
    realClasses.reduce(
      (sum, c) => sum + c.students,
      0
    );

  return (
    <>
      <div className="topbar">

        <div>

          <div className="eyebrow">
            Année scolaire{' '}
            {snapshot.schoolYear
              ? snapshot.schoolYear.replace('-', '–')
              : '—'}
          </div>

          <h1>
            Tableau de bord
          </h1>

          <div className="kicker">
            Tout ce qui concerne le GIPE,
            depuis un seul endroit.
          </div>

        </div>

        <div className="topbar-right">

          <span className="user-pill">
            {snapshot.role}
          </span>

        </div>

      </div>


      {snapshot.error && (
        <div
          className="notice notice-error"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            marginBottom: 18,
          }}
        >
          <AlertTriangle size={18} />
          <div>
            <strong>Les données n’ont pas pu être chargées.</strong>
            <div>{snapshot.error}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Recharge la page dans quelques instants. Aucun chiffre n’est
              affiché tant que les vraies données ne sont pas disponibles.
            </div>
          </div>
        </div>
      )}

      <div className="page-grid cards-3">

        {/* CLASSES */}

        <div className="card stat">

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
            Situation actuelle de
            l'établissement.
          </div>

        </div>


        {/* ÉLÈVES */}

        <div className="card stat">

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
            Situation actuelle de
            l'établissement.
          </div>

        </div>


        {/* ADHÉRENTS */}

        <div className="card stat">

          <div className="stat-top">

            <div className="stat-label">
              Adhérents
            </div>

            <div className="stat-icon">
              <HeartHandshake size={17} />
            </div>

          </div>

          <div className="stat-value">
            {snapshot.adherents}
          </div>

          <div className="stat-note">
            {snapshot.adherents === 1
              ? 'adhérent cette année.'
              : 'adhérents cette année.'}
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
              Les prochaines réunions et ce qui
              reste à préparer.
            </p>

          </div>

        </div>


        <div className="list">
          {!snapshot.error && realClasses.length === 0 && (
            <div className="list-item">
              <div className="item-main">
                <strong>Importer le listing du collège</strong>
                <span>
                  Aucune classe pour l’année en cours.
                </span>
              </div>
              <Link
                href="/import-college"
                className="badge badge-warn"
                style={{ textDecoration: 'none' }}
              >
                À faire
              </Link>
            </div>
          )}

          {snapshot.upcomingMeetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/instances/${meeting.id}`}
              className="list-item"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="item-main">
                <strong>
                  {meeting.type} – {meeting.subject}
                </strong>
                <span>
                  {meeting.date.split('-').reverse().join('/')}
                  {meeting.time ? ` à ${meeting.time.slice(0, 5)}` : ''}
                </span>
              </div>
              <span className="badge badge-info">
                À préparer
              </span>
            </Link>
          ))}

          {!snapshot.error &&
            realClasses.length > 0 &&
            snapshot.upcomingMeetings.length === 0 && (
              <div className="list-item">
                <div className="item-main">
                  <strong>Aucune réunion à venir</strong>
                  <span>
                    Les prochaines instances apparaîtront ici.
                  </span>
                </div>
              </div>
            )}
        </div>

      </section>


      {snapshot.connected && (
        <div className="footer-note">
          Données chargées depuis Supabase.
        </div>
      )}

    </>
  );
}
