'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  GraduationCap,
  Users,
  CalendarDays,
  LockKeyhole,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

type ClosureResult = {
  success: boolean;
  closedYear: string;
  newYear: string;
  totalAdherents: number;
  adherentsByClass: Array<{
    className: string;
    count: number;
  }>;
  closedAt: string;
};

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

  const [newYearLabel, setNewYearLabel] =
    useState('');

  const [closing, setClosing] =
    useState(false);

  const [closureResult, setClosureResult] =
    useState<ClosureResult | null>(null);

  const [error, setError] =
    useState('');

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
        // Les autres sections restent utilisables
        // même si le chargement échoue.
      }
    }

    loadConfiguration();
  }, []);

  function openClosure() {
    setError('');
    setNewYearLabel('');
    setShowClosure(true);
  }

  function closeClosure() {
    if (closing) return;

    setShowClosure(false);
    setError('');
  }

  async function handleClosure() {
    const label = newYearLabel.trim();

    if (!label) {
      setError(
        'Indique le libellé de la nouvelle année scolaire.'
      );
      return;
    }

    if (
      !/^\d{4}-\d{4}$/.test(label)
    ) {
      setError(
        'Format invalide. Exemple : 2027-2028.'
      );
      return;
    }

    if (
      !window.confirm(
        `Confirmer la clôture de ${schoolYear} et la création de ${label} ?\n\nCette opération créera le bilan annuel et ouvrira la nouvelle année scolaire.`
      )
    ) {
      return;
    }

    setClosing(true);
    setError('');

    try {
      const response = await fetch(
        '/api/annee/cloturer',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newYearLabel: label,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de clôturer l’année scolaire.'
        );
      }

      setClosureResult(
        data.result
      );

      setShowClosure(false);

      setSchoolYear(
        data.result.newYear
      );

      setLastImport(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue.'
      );
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      {/* ================================================== */}
      {/* EN-TÊTE */}
      {/* ================================================== */}

      <div className="topbar">
        <div>
          <div className="eyebrow">
            Configuration
          </div>

          <h1>
            Configuration des conseils
          </h1>

          <div className="kicker">
            Gère séparément les classes, la direction,
            l’année scolaire et le listing du collège.
          </div>
        </div>

        <div className="topbar-right">
          <Link
            className="btn"
            href="/conseils"
          >
            <ArrowLeft size={14} />
            Conseils de classe
          </Link>
        </div>
      </div>

      {/* ================================================== */}
      {/* CLASSES + DIRECTION */}
      {/* ================================================== */}

      <div
        className="page-grid"
        style={{
          gridTemplateColumns:
            '1fr 1fr',
        }}
      >

        {/* CLASSES */}

        <Link
          href="/configuration/classes"
          className="card section-card"
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
            style={{
              marginTop: 18,
            }}
          >
            <span className="btn btn-primary">
              Ouvrir la gestion des classes →
            </span>
          </div>
        </Link>

        {/* DIRECTION */}

        <Link
          href="/configuration/direction"
          className="card section-card"
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

      {/* ================================================== */}
      {/* ANNÉE SCOLAIRE */}
      {/* ================================================== */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems:
              'flex-start',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >

          <div>
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
                maxWidth: 650,
              }}
            >
              L’année active contient les classes,
              élèves et adhésions actuellement utilisés
              par le GIPE.
            </p>
          </div>

          {/* ANNÉE EN COURS */}

          <div
            style={{
              minWidth: 170,
              textAlign: 'right',
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform:
                  'uppercase',
                letterSpacing:
                  '.08em',
                color: '#756a67',
                fontWeight: 700,
                marginBottom: 7,
              }}
            >
              Année en cours
            </div>

            <div
              style={{
                display:
                  'inline-flex',
                alignItems:
                  'center',
                padding:
                  '8px 12px',
                borderRadius: 10,
                background:
                  '#fff1dc',
                color:
                  '#7d201a',
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {schoolYear || '—'}
            </div>
          </div>
        </div>

        {/* BAS DE CARTE */}

        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop:
              '1px solid #e5e7eb',
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems:
              'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >

          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 10,
              color: '#64748b',
              fontSize: 13,
            }}
          >
            <LockKeyhole size={16} />

            <span>
              La clôture conserve l’historique de l’année.
            </span>
          </div>

          <button
            type="button"
            className="btn"
            onClick={openClosure}
            disabled={!schoolYear}
          >
            <LockKeyhole size={14} />
            Clôturer l’année scolaire
          </button>

        </div>
      </div>

      {/* ================================================== */}
      {/* LISTING COLLÈGE */}
      {/* ================================================== */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems:
              'flex-start',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >

          <div>

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
              Import des données du collège
            </h2>

            <p
              className="section-sub"
              style={{
                marginTop: 8,
                maxWidth: 700,
              }}
            >
              Le listing collège devient la référence
              pour les classes, élèves et équipes
              pédagogiques de l’année active.
            </p>

          </div>

        </div>

        {/* DERNIER IMPORT */}

        <div
          style={{
            marginTop: 22,
            paddingTop: 20,
            borderTop:
              '1px solid #e5e7eb',
          }}
        >

          {lastImport ? (
            <>

              <div
                style={{
                  fontSize: 10,
                  textTransform:
                    'uppercase',
                  letterSpacing:
                    '.08em',
                  fontWeight: 700,
                  color: '#756a67',
                }}
              >
                Dernier import
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {lastImport.file_name}
              </div>

              <div
                className="section-sub"
                style={{
                  marginTop: 5,
                }}
              >
                Importé le{' '}
                {new Date(
                  lastImport.imported_at
                ).toLocaleString(
                  'fr-FR'
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  flexWrap:
                    'wrap',
                  marginTop: 16,
                  fontSize: 13,
                }}
              >

                <span>
                  <strong>
                    {lastImport.classes_count}
                  </strong>{' '}
                  classes
                </span>

                <span>
                  <strong>
                    {lastImport.students_count}
                  </strong>{' '}
                  élèves
                </span>

                <span>
                  <strong>
                    {lastImport.teachers_count}
                  </strong>{' '}
                  enseignants
                </span>

                <span>
                  <strong>
                    {lastImport.direction_count}
                  </strong>{' '}
                  direction
                </span>

              </div>

            </>
          ) : (

            <div className="notice">
              <FileSpreadsheet size={17} />

              <div>
                Aucun listing collège n’a encore été
                importé pour cette année scolaire.
              </div>
            </div>

          )}

        </div>

        {/* BOUTON IMPORT */}

        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent:
              'flex-end',
          }}
        >
          <Link
            href="/import-college"
            className="btn btn-primary"
          >
            <FileSpreadsheet size={14} />
            Importer le listing collège →
          </Link>
        </div>

      </div>

      {/* ================================================== */}
      {/* BILAN APRÈS CLÔTURE */}
      {/* ================================================== */}

      {closureResult && (
        <div
          className="card"
          style={{
            marginTop: 20,
            border:
              '1px solid #bbf7d0',
          }}
        >

          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 10,
            }}
          >

            <CheckCircle2 size={20} />

            <div>

              <div
                style={{
                  fontSize: 12,
                  color: '#64748b',
                }}
              >
                Clôture effectuée
              </div>

              <h2
                className="section-title"
                style={{
                  marginTop: 3,
                }}
              >
                Bilan de{' '}
                {closureResult.closedYear}
              </h2>

            </div>

          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
              marginTop: 22,
            }}
          >

            <div
              style={{
                padding: 16,
                border:
                  '1px solid #e5e7eb',
                borderRadius: 12,
              }}
            >

              <div className="stat-label">
                Adhérents
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {closureResult.totalAdherents}
              </div>

            </div>

            <div
              style={{
                padding: 16,
                border:
                  '1px solid #e5e7eb',
                borderRadius: 12,
              }}
            >

              <div className="stat-label">
                Nouvelle année
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 8,
                }}
              >
                {closureResult.newYear}
              </div>

            </div>

          </div>

          <div
            style={{
              marginTop: 24,
            }}
          >

            <div
              className="stat-label"
              style={{
                marginBottom: 12,
              }}
            >
              Répartition des adhérents par classe
            </div>

            {closureResult
              .adherentsByClass
              .length === 0 ? (

              <div className="section-sub">
                Aucun adhérent associé à une classe.
              </div>

            ) : (

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: 10,
                }}
              >

                {closureResult
                  .adherentsByClass
                  .map(
                    (item) => (
                      <div
                        key={
                          item.className
                        }
                        style={{
                          padding:
                            '12px 14px',
                          border:
                            '1px solid #e5e7eb',
                          borderRadius: 10,
                          display: 'flex',
                          justifyContent:
                            'space-between',
                          gap: 10,
                        }}
                      >

                        <span>
                          {item.className}
                        </span>

                        <strong>
                          {item.count}
                        </strong>

                      </div>
                    )
                  )}

              </div>

            )}

          </div>

        </div>
      )}

      {/* ================================================== */}
      {/* MODALE CLÔTURE */}
      {/* ================================================== */}

      {showClosure && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            padding: 20,
            zIndex: 1000,
          }}
        >

          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#fff',
              boxShadow:
                '0 20px 50px rgba(15, 23, 42, 0.20)',
            }}
          >

            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 10,
              }}
            >

              <LockKeyhole size={20} />

              <h2
                className="section-title"
                style={{
                  margin: 0,
                }}
              >
                Clôturer l’année scolaire
              </h2>

            </div>

            <p
              className="section-sub"
              style={{
                marginTop: 16,
                lineHeight: 1.6,
              }}
            >
              Tu es sur le point de clôturer{' '}
              <strong>
                {schoolYear}
              </strong>.
              <br />
              Le bilan annuel sera enregistré et
              l’année actuelle deviendra historique.
            </p>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 10,
                background:
                  '#f8fafc',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Les adhésions, classes et élèves de{' '}
              <strong>
                {schoolYear}
              </strong>{' '}
              ne seront pas supprimés.
              <br />
              Une nouvelle année scolaire sera créée
              sans adhérents ni classes.
            </div>

            <div
              style={{
                marginTop: 22,
              }}
            >

              <label
                htmlFor="new-school-year"
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 7,
                }}
              >
                Nouvelle année scolaire
              </label>

              <input
                id="new-school-year"
                type="text"
                value={newYearLabel}
                onChange={(event) =>
                  setNewYearLabel(
                    event.target.value
                  )
                }
                placeholder="2027-2028"
                className="input"
                autoFocus
              />

            </div>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 10,
                  background:
                    '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'flex-end',
                gap: 10,
                marginTop: 24,
              }}
            >

              <button
                type="button"
                className="btn"
                onClick={
                  closeClosure
                }
                disabled={closing}
              >
                Annuler
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={
                  handleClosure
                }
                disabled={closing}
              >
                {closing
                  ? 'Clôture en cours…'
                  : 'Confirmer la clôture'}
              </button>

            </div>

          </div>

        </div>
      )}

    </>
  );
}
