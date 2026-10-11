import Link from 'next/link';
import {
  AlertTriangle,
  GraduationCap,
  Users,
  HeartHandshake,
} from 'lucide-react';

import { getDashboardSnapshot } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

/*
 * « aujourd’hui à 14:32 », « hier à 09:05 », « le 08/10 à 18:00 »
 * (heure de Paris).
 */
function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const day = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);

  if (day(date) === day(now)) return `Aujourd’hui à ${time}`;
  if (day(date) === day(yesterday)) return `Hier à ${time}`;

  const short = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);

  return `Le ${short} à ${time}`;
}

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
              Événements à venir
            </h2>

            <p className="section-sub">
              Les prochaines réunions et les dates
              de l’agenda.
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

          {snapshot.upcomingEvents.map((event) => (
            <Link
              key={event.id}
              href={event.href}
              className="list-item"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="item-main">
                <strong>{event.title}</strong>
                <span>
                  {event.date.split('-').reverse().join('/')}
                  {event.time ? ` à ${event.time.slice(0, 5)}` : ''}
                </span>
              </div>
              <span className="badge badge-info">
                {event.kind === 'meeting' ? 'Réunion' : 'Agenda'}
              </span>
            </Link>
          ))}

          {!snapshot.error &&
            snapshot.upcomingEvents.length === 0 && (
              <div className="list-item">
                <div className="item-main">
                  <strong>Aucun événement à venir</strong>
                  <span>
                    Les prochaines réunions et dates de l’agenda apparaîtront ici.
                  </span>
                </div>
              </div>
            )}
        </div>

      </section>


      <section
        className="card section-card"
        style={{ marginTop: 18 }}
      >
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Dernières modifications
            </h2>
            <p className="section-sub">
              Ce qui a été fait récemment dans le dashboard, et par qui.
            </p>
          </div>
        </div>

        <div className="list">
          {snapshot.recentActivity.length === 0 ? (
            <div className="list-item">
              <div className="item-main">
                <strong>Aucune modification récente</strong>
                <span>
                  Les prochaines actions du bureau apparaîtront ici.
                </span>
              </div>
            </div>
          ) : (
            snapshot.recentActivity.map((item) => (
              <div key={item.id} className="list-item">
                <div className="item-main">
                  <strong>
                    {item.who} {item.summary}
                  </strong>
                  <span>{formatWhen(item.at)}</span>
                </div>
                <span className="badge badge-info">{item.area}</span>
              </div>
            ))
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
