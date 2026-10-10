'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  UploadCloud,
  AlertTriangle,
  Database,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

import {
  parseCollegeWorkbook,
  summarizeImport,
  type CollegeImport,
} from '@/lib/college-import';

type PreviousImport = {
  id: string;
  file_name: string;
  imported_at: string;
  classes_count: number;
  students_count: number;
  teachers_count: number;
  direction_count: number;
};

type ApplyResult = {
  ok?: boolean;
  duplicate?: boolean;
  fileName?: string;
  summary?: ReturnType<typeof summarizeImport>;
  error?: string;
  previousImport?: PreviousImport;
};

export default function ImportCollegePage() {
  const [file, setFile] =
    useState<File | null>(null);

  const [parsed, setParsed] =
    useState<CollegeImport | null>(null);

  /*
   * Année de l'import : toujours l'année en cours,
   * lue sur le serveur (non modifiable).
   */
  const [schoolYear, setSchoolYear] =
    useState('');

  useEffect(() => {
    fetch('/api/configuration', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setSchoolYear(data?.schoolYear || ''))
      .catch(() => setSchoolYear(''));
  }, []);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [duplicate, setDuplicate] =
    useState<PreviousImport | null>(null);

  const [loading, setLoading] =
    useState(false);

  const summary = useMemo(
    () =>
      parsed
        ? summarizeImport(parsed)
        : null,
    [parsed]
  );

  async function onFile(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const selected =
      e.target.files?.[0] || null;

    setFile(selected);
    setParsed(null);
    setError('');
    setSuccess('');
    setDuplicate(null);

    if (!selected) {
      return;
    }

    try {
      const result =
        parseCollegeWorkbook(
          await selected.arrayBuffer()
        );

      setParsed(result);
    } catch {
      setError(
        'Impossible de lire ce fichier. Utilise le fichier .xls ou .xlsx transmis par le collège.'
      );
    }
  }

  async function applyImport(
    force = false
  ) {
    if (!file || !parsed) {
      return;
    }

    if (!schoolYear) {
      setError('Année scolaire en cours introuvable. Recharge la page.');
      return;
    }

    if (force) {
      const confirmed =
        window.confirm(
          `Le fichier "${file.name}" a déjà été importé pour ${schoolYear}.\n\nVeux-tu vraiment l'importer à nouveau ?`
        );

      if (!confirmed) {
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData =
        new FormData();

      formData.set(
        'file',
        file
      );

      formData.set(
        'schoolYearLabel',
        schoolYear
      );

      if (force) {
        formData.set(
          'force',
          'true'
        );
      }

      const response =
        await fetch(
          '/api/import/apply',
          {
            method: 'POST',
            body: formData,
          }
        );

      const result =
        (await response.json()) as ApplyResult;

      /*
       * Le serveur a détecté que le même fichier
       * avait déjà été importé.
       */
      if (
        response.status === 409 &&
        result.duplicate &&
        result.previousImport
      ) {
        setDuplicate(
          result.previousImport
        );

        setError(
          'Ce fichier a déjà été importé pour cette année scolaire.'
        );

        return;
      }

      if (
        !response.ok ||
        !result.ok
      ) {
        setError(
          result.error ||
            "L’import n’a pas été appliqué."
        );

        return;
      }

      setDuplicate(null);
      setError('');

      setSuccess(
        `Import appliqué : ${
          result.summary?.classes ??
          parsed.classes.length
        } classes et ${
          result.summary?.students ??
          parsed.totalStudents
        } élèves pour ${schoolYear}.`
      );

    } catch {
      setError(
        'Impossible de contacter le serveur d’import.'
      );
    } finally {
      setLoading(false);
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
            Importer le listing collège
          </h1>

          <div className="kicker">
            Le fichier reçu devient la référence
            pour l’état courant.
          </div>

        </div>

        <div className="topbar-right">

          <Link
            className="btn"
            href="/configuration"
          >
            <ArrowLeft size={14} />
            Configuration
          </Link>

        </div>

      </div>


      {/* ================================================= */}
      {/* SÉLECTION DU FICHIER */}
      {/* ================================================= */}

      <section className="card section-card">

        <div className="upload">

          <FileSpreadsheet
            size={34}
            style={{
              opacity: 0.75,
            }}
          />

          <strong>
            {file?.name ||
              'Dépose le fichier du collège ici'}
          </strong>

          <p>
            Formats acceptés : .xls et .xlsx.
            Le fichier est analysé localement pour
            l’aperçu puis relu côté serveur au moment
            de l’application.
          </p>

          <label className="btn btn-gold">

            <UploadCloud size={14} />

            Choisir le fichier

            <input
              className="hidden"
              type="file"
              accept=".xls,.xlsx"
              onChange={onFile}
            />

          </label>

        </div>

      </section>


      {/* ================================================= */}
      {/* MESSAGE */}
      {/* ================================================= */}

      {(error || success) && (

        <div
          className="card section-card"
          style={{
            marginTop: 18,
          }}
        >

          <div
            className={
              error
                ? 'notice notice-error'
                : 'notice'
            }
          >

            {error ? (
              <AlertTriangle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}

            <div>
              {error || success}
            </div>

          </div>

        </div>

      )}


      {/* ================================================= */}
      {/* DOUBLON */}
      {/* ================================================= */}

      {duplicate && (

        <div
          className="card section-card"
          style={{
            marginTop: 18,
          }}
        >

          <div
            style={{
              padding: 16,
              border:
                '1px solid #f1d7a8',
              borderRadius: 10,
              background:
                '#fffaf3',
            }}
          >

            <div
              style={{
                display: 'flex',
                alignItems:
                  'flex-start',
                gap: 10,
              }}
            >

              <RefreshCw
                size={18}
                style={{
                  marginTop: 2,
                }}
              />

              <div>

                <strong>
                  Ce fichier a déjà été importé.
                </strong>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: '#64748b',
                    lineHeight: 1.6,
                  }}
                >

                  <div>
                    <strong>
                      Fichier :
                    </strong>{' '}
                    {duplicate.file_name}
                  </div>

                  <div>
                    <strong>
                      Importé le :
                    </strong>{' '}
                    {new Date(
                      duplicate.imported_at
                    ).toLocaleString(
                      'fr-FR'
                    )}
                  </div>

                  <div>
                    {duplicate.classes_count}
                    {' classes · '}
                    {duplicate.students_count}
                    {' élèves · '}
                    {duplicate.teachers_count}
                    {' enseignants'}
                  </div>

                </div>

              </div>

            </div>


            <div
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent:
                  'flex-end',
              }}
            >

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  applyImport(true)
                }
                disabled={loading}
              >

                <RefreshCw
                  size={14}
                />

                {loading
                  ? 'Importation…'
                  : 'Importer quand même'}

              </button>

            </div>

          </div>

        </div>

      )}


      {/* ================================================= */}
      {/* ANALYSE */}
      {/* ================================================= */}

      {parsed && (

        <section
          className="page-grid"
          style={{
            marginTop: 18,
          }}
        >

          <div className="card section-card">

            <div className="section-head">

              <div>

                <h2 className="section-title">
                  Import analysé
                </h2>

                <p className="section-sub">
                  Vérifie seulement les anomalies
                  techniques. Il n’y a pas de validation
                  élève par élève.
                </p>

              </div>

              <span className="badge badge-ok">
                <CheckCircle2 size={12} />
                Lecture terminée
              </span>

            </div>


            <div
              className="page-grid cards-4"
              style={{
                gridTemplateColumns:
                  'repeat(4,minmax(0,1fr))',
              }}
            >

              <div className="card stat">

                <div className="stat-label">
                  Classes
                </div>

                <div className="stat-value">
                  {summary?.classes}
                </div>

              </div>


              <div className="card stat">

                <div className="stat-label">
                  Élèves
                </div>

                <div className="stat-value">
                  {summary?.students}
                </div>

              </div>


              <div className="card stat">

                <div className="stat-label">
                  Enseignants
                </div>

                <div className="stat-value">
                  {summary?.teachers}
                </div>

              </div>


              <div className="card stat">

                <div className="stat-label">
                  Direction
                </div>

                <div className="stat-value">
                  {summary?.direction}
                </div>

              </div>

            </div>

          </div>


          {/* ================================================= */}
          {/* APPLICATION */}
          {/* ================================================= */}

          <div className="card section-card">

            <div className="section-head">

              <div>

                <h2 className="section-title">
                  Année scolaire et application
                </h2>

                <p className="section-sub">
                  La classe TEST reste indépendante
                  et permanente.
                </p>

              </div>

              <span className="badge badge-info">
                <Database size={12} />
                Base privée
              </span>

            </div>


            <div
              className="page-grid two-col"
              style={{
                gridTemplateColumns:
                  '1fr 1fr',
              }}
            >

              <label
                className="login-form"
                style={{
                  marginTop: 0,
                }}
              >

                Année scolaire

                <input
                  className="input"
                  value={
                    schoolYear ||
                    'Chargement…'
                  }
                  readOnly
                  disabled
                  title="L’import se fait toujours dans l’année scolaire en cours."
                />

              </label>


              <div className="notice">

                <ShieldCheck size={17} />

                <div>

                  <strong>
                    Import contrôlé
                  </strong>

                  <br />

                  Le serveur vérifie le compte
                  administrateur avant toute modification.

                </div>

              </div>

            </div>


            <div
              className="btn-row"
              style={{
                marginTop: 14,
              }}
            >

              <button
                className="btn btn-primary"
                onClick={() =>
                  applyImport(false)
                }
                disabled={
                  loading ||
                  parsed.classes.length === 0
                }
              >
                {loading
                  ? 'Application…'
                  : 'Appliquer l’import'}
              </button>

            </div>

          </div>


          {/* ================================================= */}
          {/* CLASSES */}
          {/* ================================================= */}

          <div className="card section-card">

            <div className="section-head">

              <div>

                <h2 className="section-title">
                  Classes détectées
                </h2>

                <p className="section-sub">
                  Les onglets « code classe » et
                  « direction » sont utilisés séparément.
                </p>

              </div>

            </div>


            <table className="table">

              <thead>

                <tr>
                  <th>Classe</th>
                  <th>Niveau</th>
                  <th>Élèves</th>
                  <th>Enseignants</th>
                  <th>Code</th>
                </tr>

              </thead>

              <tbody>

                {parsed.classes.map(
                  (c) => (

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
                        {c.students.length}
                      </td>

                      <td>
                        {c.teachers.length}
                      </td>

                      <td>
                        {c.accessCode
                          ? 'Détecté'
                          : 'Aucun code'}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>


          {/* ================================================= */}
          {/* CE QUI A ÉTÉ RECONNU */}
          {/* ================================================= */}

          {parsed.notes?.length > 0 && (
            <div className="card section-card">
              <div className="notice">
                <ShieldCheck size={17} />
                <div>
                  <strong>Ce que l’import a reconnu dans le fichier</strong>
                  {parsed.notes.map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* AVERTISSEMENTS */}
          {/* ================================================= */}

          {(parsed.warnings.length > 0 ||
            parsed.ignoredSheets.length > 0) && (

            <div className="card section-card">

              <div className="notice notice-error">

                <AlertTriangle size={17} />

                <div>

                  <strong>
                    Informations à contrôler
                  </strong>

                  {parsed.warnings.map(
                    (w) => (
                      <div key={w}>
                        {w}
                      </div>
                    )
                  )}

                  {parsed.ignoredSheets.length >
                    0 && (

                    <div
                      style={{
                        marginTop: 6,
                      }}
                    >
                      Onglets non utilisés :{' '}
                      {parsed.ignoredSheets.join(
                        ', '
                      )}
                      .
                    </div>

                  )}

                </div>

              </div>

            </div>

          )}

        </section>

      )}

    </>
  );
}
