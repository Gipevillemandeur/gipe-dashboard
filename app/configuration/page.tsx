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

type ClosurePreview = {
  schoolYear: string;
  totalAdherents: number;
  adherentsByClass: Array<{
    className: string;
    count: number;
  }>;
  totalRecettes: number | null;
  totalDepenses: number | null;
  solde: number | null;
  canClose: boolean;
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

  const [closurePreview, setClosurePreview] =
    useState<ClosurePreview | null>(null);

  const [loadingPreview, setLoadingPreview] =
    useState(false);

  const [confirmClosure, setConfirmClosure] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {

    async function loadConfiguration() {

      try {

        const response =
          await fetch(
            '/api/configuration',
            {
              cache: 'no-store',
            }
          );

        const data =
          await response.json();

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


  async function openClosure() {

    setError('');
    setClosurePreview(null);
    setConfirmClosure(false);
    setNewYearLabel('');
    setLoadingPreview(true);
    setShowClosure(true);

    try {

      const response =
        await fetch(
          '/api/annee/apercu-cloture',
          {
            method: 'GET',
            cache: 'no-store',
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data?.error ||
            'Impossible de préparer l’aperçu de clôture.'
        );

      }

      setClosurePreview(data);

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue.'
      );

    } finally {

      setLoadingPreview(false);

    }

  }


  function closeClosure() {

    if (closing) return;

    setShowClosure(false);
    setClosurePreview(null);
    setConfirmClosure(false);
    setError('');

  }


  async function handleClosure() {

    const label =
      newYearLabel.trim();

    if (!label) {

      setError(
        'Indique le libellé de la nouvelle année scolaire.'
      );

      return;
    }

    if (
      !/^\d{4}-\d{4}$/.test(
        label
      )
    ) {

      setError(
        'Format invalide. Exemple : 2027-2028.'
      );

      return;
    }

    if (!closurePreview) {

      setError(
        'L’aperçu de clôture n’est pas disponible.'
      );

      return;
    }

    if (!confirmClosure) {

      setConfirmClosure(true);
      setError('');

      return;
    }

    if (!window.confirm(
      `Dernière confirmation : clôturer ${closurePreview.schoolYear} et créer ${label} ?`
    )) {

      return;

    }

    setClosing(true);
    setError('');

    try {

      const response =
        await fetch(
          '/api/annee/cloturer',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              newYearLabel:
                label,
            }),
          }
        );

      const data =
        await response.json();

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
      setClosurePreview(null);
      setConfirmClosure(false);

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

      {/* ================================================= */}
      {/* EN-TÊTE */}
      {/* ================================================= */}

      <div className="topbar">

        <div>

          <div className="eyebrow">
            Configuration
          </div>

          <h1>
            Configuration des conseils
          </h1>

          <div className="kicker">
            Gère les classes, la direction,
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


      {/* ================================================= */}
      {/* LIGNE 1 : CLASSES + DIRECTION */}
      {/* ================================================= */}

      <div
        className="page-grid"
        style={{
          gridTemplateColumns:
            '1fr 1fr',
        }}
      >

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


      {/* ================================================= */}
      {/* LIGNE 2 : ANNÉE + LISTING */}
      {/* ================================================= */}

      <div
        className="page-grid"
        style={{
          gridTemplateColumns:
            '1fr 1fr',
          marginTop: 18,
        }}
      >

        {/* ================= ANNÉE ================= */}

        <div
          className="card section-card"
        >

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
              padding:
                '14px 16px',
              border:
                '1px solid #eee2d7',
              borderRadius: 10,
              background:
                '#fffaf3',
            }}
          >

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


          <div
            style={{
              marginTop: 18,
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              gap: 12,
            }}
          >

            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
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


            <button
  type="button"
  className="btn btn-primary"
  onClick={
    openClosure
  }
              disabled={
                !schoolYear
              }
            >
              Clôturer l’année
            </button>

          </div>

        </div>


        {/* ================= LISTING ================= */}

        <div
          className="card section-card"
        >

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
    gridTemplateRows: '14px 20px 17px',
    rowGap: 3,
  }}
>
  {lastImport ? (
    <>
      {/* TITRE */}
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

      {/* NOM DU FICHIER */}
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

      {/* INFORMATIONS */}
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


          <div
            style={{
              marginTop: 18,
              display: 'flex',
              justifyContent:
                'flex-end',
            }}
          >

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

      </div>


      {/* ================================================= */}
      {/* BILAN APRÈS CLÔTURE */}
      {/* ================================================= */}

      {closureResult && (

        <div
          className="card section-card"
          style={{
            marginTop: 18,
            border:
              '1px solid #bbf7d0',
          }}
        >

          <div className="section-head">

            <div>

              <div className="stat-label">
                Clôture effectuée
              </div>

              <h2
                className="section-title"
                style={{
                  marginTop: 5,
                }}
              >
                Bilan de{' '}
                {closureResult.closedYear}
              </h2>

            </div>

            <CheckCircle2
              size={20}
            />

          </div>


          <div
            className="page-grid"
            style={{
              gridTemplateColumns:
                '1fr 1fr',
              marginTop: 18,
            }}
          >

            <div className="card stat">

              <div className="stat-label">
                Adhérents
              </div>

              <div className="stat-value">
                {
                  closureResult.totalAdherents
                }
              </div>

            </div>


            <div className="card stat">

              <div className="stat-label">
                Nouvelle année
              </div>

              <div className="stat-value">
                {
                  closureResult.newYear
                }
              </div>

            </div>

          </div>

          <div
            style={{
              marginTop: 20,
            }}
          >

            <div
              className="stat-label"
              style={{
                marginBottom: 10,
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
                    'repeat(auto-fit, minmax(145px, 1fr))',
                  gap: 10,
                }}
              >

                {closureResult
                  .adherentsByClass
                  .map((item) => (

                    <div
                      key={item.className}
                      style={{
                        minHeight: 48,
                        padding: '8px 14px',
                        border: '1px solid #eadfd5',
                        borderRadius: 10,
                        background: '#fffaf3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: 1.2,
                          textAlign: 'center',
                        }}
                      >
                        {item.className}
                      </span>

                      <span
                        style={{
                          minWidth: 28,
                          height: 28,
                          padding: '0 8px',
                          borderRadius: 8,
                          background: '#8f241d',
                          color: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                          lineHeight: 1,
                          boxSizing: 'border-box',
                        }}
                      >
                        {item.count}
                      </span>
                    </div>

                  ))}

              </div>

            )}

          </div>

        </div>

      )}


      {/* ================================================= */}
      {/* MODALE CLÔTURE */}
      {/* ================================================= */}

      {showClosure && (

        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }}
        >

          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '18px 20px 20px',
              boxSizing: 'border-box',
              background: '#fff',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.20)',
            }}
          >

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >

              <LockKeyhole size={20} />

              <h2
                className="section-title"
                style={{ margin: 0 }}
              >
                Clôturer l’année scolaire
              </h2>

            </div>

            {loadingPreview ? (

              <div
                style={{
                  padding: '40px 10px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: 13,
                }}
              >
                Préparation de l’aperçu de clôture…
              </div>

            ) : error ? (

              <>

                <div
                  style={{
                    marginTop: 18,
                    padding: 12,
                    borderRadius: 10,
                    background: '#fef2f2',
                    color: '#b91c1c',
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: 22,
                  }}
                >

                  <button
                    type="button"
                    className="btn"
                    onClick={closeClosure}
                  >
                    Fermer
                  </button>

                </div>

              </>

            ) : closurePreview ? (

              <>

                <p
                  className="section-sub"
                  style={{
                    marginTop: 16,
                    lineHeight: 1.6,
                  }}
                >
                  Voici l’aperçu du bilan qui sera enregistré lors de la clôture.
                </p>

                <div
                  style={{
                    marginTop: 18,
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: '#fffaf3',
                    border: '1px solid #eee2d7',
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
                    Année à clôturer
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 24,
                      fontWeight: 800,
                      color: '#7d201a',
                    }}
                  >
                    {closurePreview.schoolYear}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    padding: 16,
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div className="stat-label">
                    Total des adhérents
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 30,
                      fontWeight: 800,
                    }}
                  >
                    {closurePreview.totalAdherents}
                  </div>

                  <div
                    className="section-sub"
                    style={{
                      marginTop: 5,
                      fontSize: 12,
                    }}
                  >
                    Un adhérent compte une seule fois, quel que soit le nombre de ses enfants.
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>

                  <div
                    className="stat-label"
                    style={{ marginBottom: 10 }}
                  >
                    Répartition des adhérents par classe
                  </div>

                  {closurePreview.adherentsByClass.length === 0 ? (

                    <div
                      className="section-sub"
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: '#f8fafc',
                        textAlign: 'center',
                      }}
                    >
                      Aucun adhérent associé à une classe.
                    </div>

                  ) : (

                    <>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(145px, 1fr))',
                          gap: 10,
                        }}
                      >

                        {closurePreview.adherentsByClass.map((item) => (

                          <div
                            key={item.className}
                            style={{
                              minHeight: 48,
                              padding: '8px 14px',
                              border: '1px solid #eadfd5',
                              borderRadius: 10,
                              background: '#fffaf3',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 10,
                              boxSizing: 'border-box',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                lineHeight: 1.2,
                                textAlign: 'center',
                              }}
                            >
                              {item.className}
                            </span>

                            <span
                              style={{
                                minWidth: 28,
                                height: 28,
                                padding: '0 8px',
                                borderRadius: 8,
                                background: '#8f241d',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 800,
                                lineHeight: 1,
                                boxSizing: 'border-box',
                              }}
                            >
                              {item.count}
                            </span>
                          </div>

                        ))}

                      </div>

                      <div
                        style={{
                          marginTop: 9,
                          padding: '0 6px',
                          fontSize: 11,
                          lineHeight: 1.45,
                          color: '#64748b',
                          textAlign: 'center',
                        }}
                      >
                        Un même adhérent peut apparaître dans plusieurs classes s’il a plusieurs enfants.
                      </div>

                    </>

                  )}

                </div>

                <div
                  style={{
                    marginTop: 20,
                    padding: 14,
                    borderRadius: 10,
                    background: '#f8fafc',
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    Bilan financier
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div className="stat-label">Recettes</div>
                      <strong>—</strong>
                    </div>
                    <div>
                      <div className="stat-label">Dépenses</div>
                      <strong>—</strong>
                    </div>
                    <div>
                      <div className="stat-label">Solde</div>
                      <strong>—</strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 9,
                      color: '#64748b',
                    }}
                  >
                    La trésorerie sera intégrée ultérieurement.
                  </div>
                </div>

                <div style={{ marginTop: 22 }}>

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
                      setNewYearLabel(event.target.value)
                    }
                    placeholder="2027-2028"
                    className="input"
                    autoFocus
                    disabled={closing}
                  />

                </div>

                {confirmClosure && (

                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 10,
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#9a3412',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Dernière vérification</strong>
                    <br />
                    Tu vas clôturer <strong>{closurePreview.schoolYear}</strong> et créer l’année <strong>{newYearLabel || '—'}</strong>.
                    <br /><br />
                    Le bilan sera enregistré et l’ancienne année passera dans l’historique.
                  </div>

                )}

                {error && (

                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 10,
                      background: '#fef2f2',
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
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 24,
                  }}
                >
                  <button
                    type="button"
                    className="btn"
                    onClick={closeClosure}
                    disabled={closing}
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleClosure}
                    disabled={closing}
                  >
                    {closing
                      ? 'Clôture en cours…'
                      : confirmClosure
                        ? 'Clôturer définitivement'
                        : 'Continuer vers la confirmation'}
                  </button>
                </div>

              </>

            ) : null}

          </div>

        </div>

      )}

    </>
  );
}
