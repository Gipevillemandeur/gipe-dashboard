import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Gavel,
  GraduationCap,
  Landmark,
} from 'lucide-react'

export default function InstancesPage() {
  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <GraduationCap size={16} />
            Scolarité
          </div>

          <h1>Instances</h1>

          <p>
            Retrouvez les différentes instances de l&apos;établissement et
            accédez à leur calendrier, leur préparation et leurs informations.
          </p>
        </div>

        <Link href="/conseils" className="back-link">
          <ArrowLeft size={16} />
          Scolarité
        </Link>
      </section>

      <section className="choices" aria-label="Instances de l'établissement">
        <Link href="/instances/conseils-de-classe" className="choice-card">
          <div className="choice-icon">
            <GraduationCap size={30} />
          </div>

          <div className="choice-content">
            <h2>Conseils de classe</h2>
            <p>
              Retrouvez les dates des conseils de classe et préparez les
              différentes échéances de l&apos;année scolaire.
            </p>
          </div>

          <ArrowRight className="choice-arrow" size={22} />
        </Link>

        <Link href="/instances/conseils-de-discipline" className="choice-card">
          <div className="choice-icon">
            <Gavel size={30} />
          </div>

          <div className="choice-content">
            <h2>Conseils de discipline</h2>
            <p>
              Centralisez les informations et les échéances liées aux conseils
              de discipline.
            </p>
          </div>

          <ArrowRight className="choice-arrow" size={22} />
        </Link>

        <Link href="/instances/conseil-administration" className="choice-card">
          <div className="choice-icon">
            <Landmark size={30} />
          </div>

          <div className="choice-content">
            <h2>Conseil d&apos;administration</h2>
            <p>
              Retrouvez les dates, les réunions et les informations relatives
              au conseil d&apos;administration.
            </p>
          </div>

          <ArrowRight className="choice-arrow" size={22} />
        </Link>
      </section>

      <style>{`
        .page {
          display: grid;
          gap: 28px;
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
          margin-bottom: 8px;
          color: #64748b;
          font-size: 14px;
          font-weight: 700;
        }

        h1 {
          margin: 0;
          color: #0f172a;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .hero p {
          max-width: 760px;
          margin: 10px 0 0;
          color: #64748b;
          line-height: 1.6;
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

        .choices {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          max-width: 1200px;
        }

        .choice-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-height: 230px;
          padding: 28px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: #fff;
          color: inherit;
          text-decoration: none;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease;
        }

        .choice-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
        }

        .choice-icon {
          display: grid;
          place-items: center;
          width: 58px;
          height: 58px;
          border-radius: 15px;
          background: #f1f5f9;
          color: #334155;
        }

        .choice-content {
          padding-right: 26px;
          margin-top: 20px;
        }

        .choice-content h2 {
          margin: 0;
          color: #0f172a;
          font-size: 20px;
          line-height: 1.25;
        }

        .choice-content p {
          margin: 8px 0 0;
          color: #64748b;
          line-height: 1.55;
        }

        .choice-arrow {
          position: absolute;
          right: 22px;
          bottom: 22px;
          color: #94a3b8;
          transition: transform 0.15s ease, color 0.15s ease;
        }

        .choice-card:hover .choice-arrow {
          color: #475569;
          transform: translateX(3px);
        }

        @media (max-width: 950px) {
          .choices {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .page {
            gap: 20px;
            padding: 18px 14px;
          }

          .hero {
            flex-direction: column;
            gap: 14px;
          }

          .back-link {
            width: 100%;
            justify-content: center;
          }

          .choices {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .choice-card {
            min-height: 175px;
            padding: 22px 46px 22px 20px;
            border-radius: 16px;
          }

          .choice-icon {
            width: 52px;
            height: 52px;
            border-radius: 13px;
          }

          .choice-content {
            margin-top: 16px;
          }

          .choice-content h2 {
            font-size: 19px;
          }

          .choice-content p {
            font-size: 14px;
          }

          .choice-arrow {
            right: 17px;
            bottom: 20px;
          }
        }
      `}</style>
    </main>
  )
}
