'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import YearClosure from '@/components/YearClosure';
import {
  GraduationCap,
  Users,
  CalendarDays,
  LockKeyhole,
  FileSpreadsheet,
  UserRoundCog,
} from 'lucide-react';

type LastImport = {
  file_name: string;
  imported_at: string;
  classes_count: number;
  students_count: number;
  teachers_count: number;
  direction_count: number;
};

export default function ConfigurationPage() {
  const [schoolYear, setSchoolYear] =
    useState<string | null>(null);

  const [lastImport, setLastImport] =
    useState<LastImport | null>(null);

  const [showClosure, setShowClosure] =
    useState(false);

  /*
   * Clôture de l'année : réservée au Président
   * (et au SUPER ADMIN).
   */
  const [canCloseYear, setCanCloseYear] =
    useState(false);

  useEffect(() => {
    fetch('/api/auth/access', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        setCanCloseYear(
          Boolean(data?.isPresident || data?.isSuperAdmin)
        );
      })
      .catch(() => setCanCloseYear(false));
  }, []);

  useEffect(() => {
    async function loadConfiguration() {
      try {
        const response = await fetch(
          '/api/configuration',
          {
            cache: 'no-store',
          }
        );

        const data = await response.json();

        if (response.ok) {
          setSchoolYear(
            data.schoolYear || null
          );

          setLastImport(
            data.lastImport || null
          );
        }
      } catch {
        // Rien à afficher.
      }
    }

    loadConfiguration();
  }, []);

  return (
    <>
      <div className="topbar configuration-topbar">
        <div>
          <div className="eyebrow">
            Configuration
          </div>

          <h1>
            Configuration du tableau de bord
          </h1>

          <div className="kicker">
            Gère les différents paramètres du tableau de bord.
          </div>
        </div>
      </div>

      {canCloseYear && (
        <YearClosure
          open={showClosure}
          onClose={() => setShowClosure(false)}
          onClosed={(newYear) => {
            setSchoolYear(newYear);
            setLastImport(null);
          }}
        />
      )}

      <div className="configuration-grid">
        <Link
          href="/configuration/classes"
          className="card section-card configuration-card"
          style={{
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div className="stat-top">
            <div className="stat-label">
              Classes
            </div>

            <div className="stat-icon">
              <GraduationCap size={17} />
            </div>
          </div>

          <h2
            className="section-title"
            style={{
              marginTop: 14,
            }}
          >
            Gérer les classes
          </h2>

          <p
            className="section-sub"
            style={{
              marginTop: 8,
            }}
          >
            Consulter les classes actives et modifier
            leurs codes d’accès aux conseils de classe.
          </p>

          <div
            className="configuration-card-action"
            style={{
              marginTop: 18,
            }}
          >
            <span className="btn btn-primary">
              Ouvrir la gestion des classes →
            </span>
          </div>
        </Link>

        <Link
          href="/configuration/direction"
          className="card section-card configuration-card"
          style={{
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div className="stat-top">
            <div className="stat-label">
              Direction
            </div>

            <div className="stat-icon">
              <Users size={17} />
            </div>
          </div>

          <h2
            className="section-title"
            style={{
              marginTop: 14,
            }}
          >
            Gérer la direction
          </h2>

          <p
            className="section-sub"
            style={{
              marginTop: 8,
            }}
          >
            Ajouter, modifier ou supprimer les membres
            de la direction utilisés dans les comptes rendus.
          </p>

          <div
            className="configuration-card-action"
            style={{
              marginTop: 18,
            }}
          >
            <span className="btn btn-primary">
              Ouvrir la gestion de la direction →
            </span>
          </div>
        </Link>


      </div>

      <div className="configuration-grid configuration-grid-second">
        <Link
          href="/configuration/membres-bureau"
          className="card section-card configuration-card configuration-office-card"
          style={{
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div className="stat-top">
            <div className="stat-label">
              Membres du bureau
            </div>

            <div className="stat-icon">
              <UserRoundCog size={17} />
            </div>
          </div>

          <h2
            className="section-title"
            style={{
              marginTop: 14,
            }}
          >
            Gérer les membres du bureau
          </h2>

          <p
            className="section-sub"
            style={{
              marginTop: 8,
            }}
          >
            Gérer les postes, les titulaires, les adresses
            e-mail et les autorisations du bureau.
          </p>

          <div
            className="configuration-card-action"
            style={{
              marginTop: 18,
            }}
          >
            <span className="btn btn-primary">
              Ouvrir la gestion du bureau →
            </span>
          </div>
        </Link>
        {/* LISTING COLLÈGE */}
        <div className="card section-card configuration-card">
          <div className="stat-top">
            <div className="stat-label">
              Listing collège
            </div>

            <div className="stat-icon">
              <FileSpreadsheet size={17} />
            </div>
          </div>

          <h2
            className="section-title"
            style={{
              marginTop: 14,
            }}
          >
            Importer le listing collège
          </h2>

          <p
            className="section-sub"
            style={{
              marginTop: 8,
            }}
          >
            Le listing devient la référence pour les
            classes, élèves et équipes pédagogiques.
          </p>

          <div
            style={{
              marginTop: 20,
              width: '100%',
              height: 86,
              minHeight: 86,
              maxHeight: 86,
              boxSizing: 'border-box',
              padding: '13px 16px',
              border: '1px solid #eee2d7',
              borderRadius: 10,
              background: '#fffaf3',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows:
                '14px 20px 17px',
              rowGap: 3,
            }}
          >
            {lastImport ? (
              <>
                <div
                  style={{
                    minWidth: 0,
                    width: '100%',
                    fontSize: 10,
                    lineHeight: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                    fontWeight: 700,
                    color: '#756a67',
                    overflow: 'hidden',
                  }}
                >
                  Dernier import
                </div>

                <div
                  style={{
                    minWidth: 0,
                    width: '100%',
                    fontSize: 13,
                    lineHeight: '20px',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={lastImport.file_name}
                >
                  {lastImport.file_name}
                </div>

                <div
                  style={{
                    minWidth: 0,
                    width: '100%',
                    fontSize: 11,
                    lineHeight: '17px',
                    color: '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={`${new Date(
                    lastImport.imported_at
                  ).toLocaleString('fr-FR')} · ${
                    lastImport.classes_count
                  } classes · ${
                    lastImport.students_count
                  } élèves · ${
                    lastImport.teachers_count
                  } enseignants`}
                >
                  {new Date(
                    lastImport.imported_at
                  ).toLocaleString('fr-FR')}

                  {' · '}

                  {lastImport.classes_count}
                  {' classes · '}

                  {lastImport.students_count}
                  {' élèves · '}

                  {lastImport.teachers_count}
                  {' enseignants'}
                </div>
              </>
            ) : (
              <div
                style={{
                  gridRow: '1 / span 3',
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  color: '#64748b',
                  fontSize: 12,
                }}
              >
                <FileSpreadsheet size={16} />

                <span>
                  Aucun listing importé pour cette année.
                </span>
              </div>
            )}
          </div>

          <div className="configuration-import-action">
            <Link
              href="/import-college"
              className="btn btn-primary"
            >
              <FileSpreadsheet
                size={14}
              />

              Importer le listing →
            </Link>
          </div>
        </div>

        {/* ANNÉE SCOLAIRE / CLÔTURE */}
        <div className="card section-card configuration-card">
          <div className="stat-top">
            <div className="stat-label">
              Année scolaire
            </div>

            <div className="stat-icon">
              <CalendarDays size={17} />
            </div>
          </div>

          <h2
            className="section-title"
            style={{
              marginTop: 14,
            }}
          >
            Gestion de l’année scolaire
          </h2>

          <p
            className="section-sub"
            style={{
              marginTop: 8,
            }}
          >
            L’année active contient les classes,
            élèves et adhésions actuellement utilisés
            par le GIPE.
          </p>

          <div
            style={{
              marginTop: 20,
              padding: '14px 16px',
              border: '1px solid #eee2d7',
              borderRadius: 10,
              background: '#fffaf3',
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                fontWeight: 700,
                color: '#756a67',
              }}
            >
              Année en cours
            </div>

            <div
              style={{
                fontSize: 25,
                fontWeight: 800,
                marginTop: 5,
                color: '#7d201a',
              }}
            >
              {schoolYear || '—'}
            </div>
          </div>

          <div className="configuration-year-footer">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                color: '#64748b',
                fontSize: 12,
              }}
            >
              <LockKeyhole size={14} />

              <span>
                Historique conservé
              </span>
            </div>

            {canCloseYear ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowClosure(true)}
                disabled={!schoolYear}
              >
                Clôturer l’année
              </button>
            ) : (
              <span
                style={{
                  fontSize: 12,
                  color: '#64748b',
                  fontStyle: 'italic',
                }}
              >
                Clôture réservée au Président
              </span>
            )}
          </div>
        </div>
      </div>


      <style jsx>{`
        .configuration-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1fr);
          gap: 18px;
          min-width: 0;
        }

        .configuration-grid-second {
          margin-top: 18px;
        }

        .configuration-card {
          min-width: 0;
          box-sizing: border-box;
        }

        .configuration-card-action {
          display: flex;
          justify-content: flex-start;
        }

        .configuration-year-footer {
          margin-top: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .configuration-import-action {
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
        }

        .configuration-result-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1fr);
          gap: 14px;
          margin-top: 18px;
        }

        .configuration-class-grid {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(145px, 1fr)
            );
          gap: 10px;
        }

        .configuration-finance-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .configuration-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(
            15,
            23,
            42,
            0.45
          );
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
          box-sizing: border-box;
        }

        .configuration-modal {
          width: 100%;
          max-width: 620px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 18px 20px 20px;
          box-sizing: border-box;
          background: #fff;
          box-shadow:
            0 20px 50px
            rgba(
              15,
              23,
              42,
              0.20
            );
        }

        .configuration-modal-head {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .configuration-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        .configuration-error {
          margin-top: 18px;
          padding: 12px;
          border-radius: 10px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
        }

        .configuration-confirm {
          margin-top: 16px;
          padding: 14px;
          border-radius: 10px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          font-size: 13px;
          line-height: 1.5;
        }

        @media (max-width: 700px) {
          .configuration-grid {
            grid-template-columns:
              minmax(0, 1fr);
            gap: 14px;
          }

          .configuration-grid-second {
            margin-top: 14px;
          }

          .configuration-card-action {
            width: 100%;
          }

          .configuration-card-action .btn {
            width: auto;
            max-width: 100%;
          }

          .configuration-year-footer {
            flex-direction: column;
            align-items: stretch;
          }

          .configuration-year-footer
            .btn {
            width: 100%;
            justify-content: center;
          }

          .configuration-import-action {
            justify-content: flex-start;
          }

          .configuration-import-action .btn {
            width: auto;
            max-width: 100%;
          }

          .configuration-result-grid {
            grid-template-columns:
              minmax(0, 1fr);
            gap: 12px;
          }

          .configuration-finance-grid {
            grid-template-columns:
              minmax(0, 1fr);
            gap: 12px;
          }

          .configuration-modal-overlay {
            align-items: flex-start;
            justify-content: center;
            padding: 12px;
            min-height: 100dvh;
            height: 100dvh;
            overflow: hidden;
          }

          .configuration-modal {
            width: 100%;
            max-width: none;
            max-height:
              calc(100dvh - 24px);
            margin-top: 12px;
            padding: 18px 16px 18px;
            border-radius: 22px;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .configuration-modal-head {
            align-items: flex-start;
          }

          .configuration-modal-actions {
            flex-direction: column-reverse;
            gap: 10px;
          }

          .configuration-modal-actions
            .btn {
            width: 100%;
            justify-content: center;
          }

          .configuration-class-grid {
            grid-template-columns:
              minmax(0, 1fr);
          }
        }

        @media (max-width: 420px) {
          .configuration-card-action
            .btn,
          .configuration-import-action
            .btn {
            white-space: normal;
            text-align: center;
          }
        }
      `}</style>
    </>
  );
}
