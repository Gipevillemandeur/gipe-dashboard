import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  Users,
} from 'lucide-react'

export default function ScolaritePage() {
  return (
    <main className="page scol">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <GraduationCap size={16} />
            Scolarité
          </div>

          <h1>Scolarité</h1>

          <p>
            Retrouvez ici les outils liés au suivi des classes et aux
            différentes instances de l&apos;établissement.
          </p>
        </div>
      </section>

      <section className="choices" aria-label="Rubriques de scolarité">
        <Link href="/conseils/classes" className="choice-card">
          <div className="choice-icon">
            <Users size={30} />
          </div>

          <div className="choice-content">
            <h2>Vue des classes</h2>
            <p>
              Consultez les classes, les effectifs et les équipes pédagogiques
              de l&apos;année scolaire active.
            </p>
          </div>

          <ArrowRight className="choice-arrow" size={22} />
        </Link>

        <Link href="/instances" className="choice-card">
          <div className="choice-icon">
            <CalendarDays size={30} />
          </div>

          <div className="choice-content">
            <h2>Instances</h2>
            <p>
              Retrouvez les conseils de classe, conseils de discipline, conseils
              d&apos;administration et leurs différentes échéances.
            </p>
          </div>

          <ArrowRight className="choice-arrow" size={22} />
        </Link>
      </section>

      <style>{`
        .scol.page {
          display: grid;
          gap: 28px;
          padding: 28px;
        }

        .scol .hero {
          padding: 4px 0;
        }

        .scol .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: #756a67;
          font-size: 14px;
          font-weight: 700;
        }

        .scol h1 {
          margin: 0;
          color: #241c1b;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .scol .hero p {
          max-width: 720px;
          margin: 10px 0 0;
          color: #756a67;
          line-height: 1.6;
        }

        .scol .choices {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          max-width: 1100px;
        }

        .scol .choice-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 20px;
          min-height: 190px;
          padding: 28px;
          border: 1px solid #eadfd4;
          border-radius: 20px;
          background: #fff;
          color: inherit;
          text-decoration: none;
          box-shadow: 0 4px 16px rgba(36, 28, 27, 0.04);
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease;
        }

        .scol .choice-card:hover {
          transform: translateY(-2px);
          border-color: #d8cbc0;
          box-shadow: 0 10px 28px rgba(36, 28, 27, 0.08);
        }

        .scol .choice-icon {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: #fff0d9;
          color: #302b27;
        }

        .scol .choice-content {
          min-width: 0;
          padding-right: 26px;
        }

        .scol .choice-content h2 {
          margin: 0;
          color: #241c1b;
          font-size: 22px;
          line-height: 1.2;
        }

        .scol .choice-content p {
          margin: 8px 0 0;
          color: #756a67;
          line-height: 1.55;
        }

        .scol .choice-arrow {
          position: absolute;
          right: 22px;
          top: 50%;
          color: #a39591;
          transform: translateY(-50%);
          transition: transform 0.15s ease, color 0.15s ease;
        }

        .scol .choice-card:hover .choice-arrow {
          color: #5f514b;
          transform: translate(3px, -50%);
        }

        @media (max-width: 760px) {
          .scol.page {
            gap: 20px;
            padding: 18px 14px;
          }

          .scol .choices {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .scol .choice-card {
            min-height: 150px;
            padding: 22px 46px 22px 20px;
            gap: 15px;
            border-radius: 16px;
          }

          .scol .choice-icon {
            width: 52px;
            height: 52px;
            border-radius: 13px;
          }

          .scol .choice-content h2 {
            font-size: 19px;
          }

          .scol .choice-content p {
            font-size: 14px;
          }

          .scol .choice-arrow {
            right: 17px;
          }
        }
      `}</style>
    </main>
  )
}


