import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Users,
} from 'lucide-react'

import { getDashboardSnapshot } from '@/lib/dashboard-data'

export default async function ClassesPage() {
  const snapshot = await getDashboardSnapshot()

  const realClasses = snapshot.classes.filter((c) => c.status !== 'demo')
  const totalStudents = realClasses.reduce((sum, c) => sum + c.students, 0)

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <GraduationCap size={16} />
            Scolarité
          </div>

          <h1>Vue des classes</h1>

          <p>
            Consultez les classes, les effectifs et les équipes pédagogiques
            de l&apos;année scolaire active.
          </p>
        </div>

        <div className="hero-actions">
          <Link href="/conseils" className="back-link">
            <ArrowLeft size={16} />
            Scolarité
          </Link>

          <div className="year">
            <span>Année active</span>
            <strong>{snapshot.schoolYear || 'Aucune année active'}</strong>
          </div>
        </div>
      </section>

      <section className="cards">
        <article className="stat-card">
          <div className="stat-icon">
            <BookOpen size={20} />
          </div>
          <div>
            <span>Classes actives</span>
            <strong>{realClasses.length}</strong>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <Users size={20} />
          </div>
          <div>
            <span>Élèves</span>
            <strong>{totalStudents}</strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Classes</h2>
            <p>
              Les classes réelles proviennent du dernier import de
              l&apos;établissement. Sélectionnez une classe pour consulter son
              détail.
            </p>
          </div>
        </div>

        {realClasses.length === 0 ? (
          <div className="empty">
            <GraduationCap size={30} />
            <h3>Aucune classe disponible</h3>
            <p>
              Importez les données de l&apos;établissement pour afficher les
              classes de l&apos;année active.
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Classe</th>
                    <th>Niveau</th>
                    <th>Élèves</th>
                    <th>Équipe</th>
                    <th>Consultation</th>
                  </tr>
                </thead>

                <tbody>
                  {realClasses.map((c) => (
                    <tr key={c.id || c.name}>
                      <td className="class-name">{c.name}</td>
                      <td>{c.level || '—'}</td>
                      <td>{c.students}</td>
                      <td>{c.teachers}</td>
                      <td>
                        {c.id ? (
                          <Link
                            className="consult-link"
                            href={`/conseils/${c.id}`}
                          >
                            <Users size={16} />
                            Consulter
                            <ArrowRight size={15} />
                          </Link>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-list">
              {realClasses.map((c) => (
                <article className="class-card" key={c.id || c.name}>
                  <div className="class-card-top">
                    <div>
                      <h3>{c.name}</h3>
                      <span>{c.level || 'Niveau non renseigné'}</span>
                    </div>
                  </div>

                  <div className="class-card-stats">
                    <div>
                      <span>Élèves</span>
                      <strong>{c.students}</strong>
                    </div>
                    <div>
                      <span>Équipe</span>
                      <strong>{c.teachers}</strong>
                    </div>
                  </div>

                  {c.id && (
                    <Link
                      className="mobile-consult-link"
                      href={`/conseils/${c.id}`}
                    >
                      <Users size={17} />
                      Consulter la classe
                      <ArrowRight size={16} />
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <style>{`
        .page {
          display: grid;
          gap: 24px;
          padding: 28px;
        }

        .hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        h1 {
          margin: 0;
          color: #0f172a;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .hero p {
          margin: 10px 0 0;
          max-width: 700px;
          color: #64748b;
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 44px;
          padding: 0 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fff;
          color: #475569;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
        }

        .back-link:hover {
          background: #f8fafc;
        }

        .year {
          min-width: 190px;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .year span,
        .stat-card span,
        .class-card-stats span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        }

        .year strong {
          display: block;
          margin-top: 4px;
          color: #0f172a;
          font-size: 15px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          max-width: 600px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 94px;
          padding: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .stat-icon {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #f1f5f9;
          color: #334155;
        }

        .stat-card strong {
          display: block;
          margin-top: 4px;
          color: #0f172a;
          font-size: 26px;
          line-height: 1;
        }

        .panel {
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .panel-head {
          padding: 22px 24px;
          border-bottom: 1px solid #e2e8f0;
        }

        .panel-head h2 {
          margin: 0;
          color: #0f172a;
          font-size: 19px;
        }

        .panel-head p {
          margin: 6px 0 0;
          color: #64748b;
          line-height: 1.55;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 680px;
        }

        th,
        td {
          padding: 15px 20px;
          border-bottom: 1px solid #eef2f7;
          text-align: left;
          white-space: nowrap;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        td {
          color: #334155;
          font-size: 14px;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .class-name {
          color: #0f172a;
          font-weight: 700;
        }

        .consult-link,
        .mobile-consult-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #8f211c;
          font-weight: 700;
          text-decoration: none;
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #e4c8c5;
          border-radius: 10px;
          background: #fff;
        }

        .consult-link:hover,
        .mobile-consult-link:hover {
          border-color: #8f211c;
          background: #fff8f7;
          text-decoration: none;
        }

        .muted {
          color: #94a3b8;
        }

        .mobile-list {
          display: none;
        }

        .empty {
          display: grid;
          justify-items: center;
          gap: 8px;
          padding: 48px 24px;
          text-align: center;
          color: #64748b;
        }

        .empty h3 {
          margin: 4px 0 0;
          color: #0f172a;
          font-size: 18px;
        }

        .empty p {
          margin: 0;
          max-width: 520px;
          line-height: 1.5;
        }

        @media (max-width: 900px) {
          .hero {
            flex-direction: column;
          }

          .hero-actions {
            width: 100%;
          }
        }

        @media (max-width: 760px) {
          .page {
            gap: 18px;
            padding: 18px 14px;
          }

          .hero-actions {
            flex-direction: column;
          }

          .back-link,
          .year {
            width: 100%;
          }

          .cards {
            grid-template-columns: 1fr 1fr;
            max-width: none;
            gap: 10px;
          }

          .stat-card {
            min-height: 82px;
            padding: 14px;
            gap: 10px;
          }

          .stat-icon {
            width: 38px;
            height: 38px;
            border-radius: 10px;
          }

          .stat-card strong {
            font-size: 22px;
          }

          .panel {
            border-radius: 15px;
          }

          .panel-head {
            padding: 18px;
          }

          .table-wrap {
            display: none;
          }

          .mobile-list {
            display: grid;
            gap: 10px;
            padding: 12px;
          }

          .class-card {
            padding: 15px;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            background: #fff;
          }

          .class-card h3 {
            margin: 0;
            color: #0f172a;
            font-size: 17px;
          }

          .class-card-top > div > span {
            display: block;
            margin-top: 3px;
            color: #64748b;
            font-size: 13px;
          }

          .class-card-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px solid #eef2f7;
          }

          .class-card-stats strong {
            display: block;
            margin-top: 3px;
            color: #0f172a;
            font-size: 18px;
          }

          .mobile-consult-link {
            width: 100%;
            margin-top: 14px;
            padding: 11px 12px;
            border-radius: 10px;
            background: #fff;
            text-decoration: none;
          }
        }

        @media (max-width: 430px) {
          .cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}
