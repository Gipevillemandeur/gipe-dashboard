'use client';

/*
 * CLÔTURE DE L'ANNÉE SCOLAIRE (Président uniquement)
 *
 * 1. Aperçu : adhérents (+ évolution), finances, instances.
 * 2. Saisie : bilan moral, perspectives, remarques.
 * 3. Clôture définitive.
 * 4. Archivage Drive étape par étape, avec reprise possible.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FolderUp,
  Loader2,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';

type ClassCount = { className: string; count: number };

type Report = {
  schoolYearId: string;
  schoolYear: string;
  totalAdherents: number;
  adherentsByClass: ClassCount[];
  previousYear: {
    schoolYear: string;
    totalAdherents: number;
    solde: number;
  } | null;
  initialBalance: number;
  totalRecettes: number;
  totalDepenses: number;
  solde: number;
  financialByCategory: {
    category: string;
    recettes: number;
    depenses: number;
  }[];
  meetings: {
    id: string;
    date: string;
    type: string;
    subject: string;
    hasSummary: boolean;
  }[];
};

type Step = {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
};

type ArchiveState = {
  yearId: string;
  schoolYear: string;
  newYear?: string;
  driveFolderUrl: string | null;
  steps: Step[];
  running: boolean;
  finished: boolean;
  texts?: { moralReport: string; perspectives: string; notes: string };
};

function euro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function dateFr(value: string) {
  return value ? value.slice(0, 10).split('-').reverse().join('/') : '';
}

function nextYearLabel(label: string) {
  const match = /^(\d{4})-(\d{4})$/.exec(label);
  return match ? `${Number(match[1]) + 1}-${Number(match[2]) + 1}` : '';
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export default function YearClosure({
  open,
  onClose,
  onClosed,
}: {
  open: boolean;
  onClose: () => void;
  onClosed: (newYear: string) => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [moralReport, setMoralReport] = useState('');
  const [perspectives, setPerspectives] = useState('');
  const [notes, setNotes] = useState('');
  const [newYear, setNewYear] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [closing, setClosing] = useState(false);

  const [archive, setArchive] = useState<ArchiveState | null>(null);
  const [archivePanelOpen, setArchivePanelOpen] = useState(false);
  const runningRef = useRef(false);

  /*
   * Au chargement : y a-t-il un archivage resté incomplet ?
   */
  const loadArchiveState = useCallback(async (yearId?: string) => {
    const response = await fetch(
      `/api/annee/archiver${yearId ? `?yearId=${yearId}` : ''}`,
      { cache: 'no-store' }
    );
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(data?.error || 'Impossible de lire l’archivage.');
    }

    return data as {
      closure: {
        yearId: string;
        schoolYear: string;
        archivedAt: string | null;
        driveFolderUrl: string | null;
      } | null;
      steps: { key: string; label: string }[];
    };
  }, []);

  useEffect(() => {
    loadArchiveState()
      .then((data) => {
        if (data.closure && !data.closure.archivedAt) {
          setArchive({
            yearId: data.closure.yearId,
            schoolYear: data.closure.schoolYear,
            driveFolderUrl: data.closure.driveFolderUrl,
            steps: data.steps.map((s) => ({ ...s, status: 'pending' })),
            running: false,
            finished: false,
          });
        }
      })
      .catch(() => {
        // Pas bloquant : la bannière de reprise n'apparaît simplement pas.
      });
  }, [loadArchiveState]);

  /*
   * Ouverture de la fenêtre : chargement de l'aperçu.
   */
  useEffect(() => {
    if (!open) return;

    setError('');
    setReport(null);
    setConfirmed(false);
    setLoading(true);

    fetch('/api/annee/apercu-cloture', { cache: 'no-store' })
      .then(async (response) => {
        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(
            data?.error || 'Impossible de préparer l’aperçu de clôture.'
          );
        }

        setReport(data.report);
        setNewYear((current) => current || nextYearLabel(data.report.schoolYear));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erreur inconnue.')
      )
      .finally(() => setLoading(false));
  }, [open]);

  function closeModal() {
    if (closing) return;
    onClose();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (open) closeModal();
      else if (archivePanelOpen && !archive?.running) setArchivePanelOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  /*
   * ARCHIVAGE : étapes une par une, reprise à la
   * première étape non terminée.
   */
  async function runArchive(state: ArchiveState) {
    if (runningRef.current) return;
    runningRef.current = true;

    let current: ArchiveState = {
      ...state,
      running: true,
      steps: state.steps.map((s) =>
        s.status === 'error' ? { ...s, status: 'pending', error: undefined } : s
      ),
    };
    setArchive(current);

    const update = (patch: Partial<ArchiveState>) => {
      current = { ...current, ...patch };
      setArchive(current);
    };

    const setStep = (index: number, patch: Partial<Step>) => {
      update({
        steps: current.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      });
    };

    try {
      for (let index = 0; index < current.steps.length; index++) {
        const step = current.steps[index];
        if (step.status === 'done') continue;

        setStep(index, { status: 'running' });

        const response = await fetch('/api/annee/archiver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yearId: current.yearId,
            step: step.key,
            ...(step.key === 'bilan' && current.texts
              ? { texts: current.texts }
              : {}),
          }),
        });
        const data = await readJson(response);

        if (!response.ok) {
          setStep(index, {
            status: 'error',
            error: data?.error || `Erreur (HTTP ${response.status}).`,
          });
          update({ running: false });
          return;
        }

        setStep(index, { status: 'done' });

        if (data?.yearFolderUrl) {
          update({ driveFolderUrl: data.yearFolderUrl });
        }
      }

      const finish = await fetch('/api/annee/archiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearId: current.yearId, step: 'finish' }),
      });

      if (!finish.ok) {
        const data = await readJson(finish);
        throw new Error(data?.error || 'Impossible de terminer l’archivage.');
      }

      update({ running: false, finished: true });
    } catch (err) {
      update({ running: false });
      setError(err instanceof Error ? err.message : 'Archivage interrompu.');
    } finally {
      runningRef.current = false;
    }
  }

  /*
   * CLÔTURE DÉFINITIVE
   */
  async function handleClose() {
    setError('');

    if (!report) return;

    if (!/^\d{4}-\d{4}$/.test(newYear.trim())) {
      setError('Indique la nouvelle année au format 2027-2028.');
      return;
    }

    if (!confirmed) {
      setError('Coche la case de confirmation pour clôturer.');
      return;
    }

    setClosing(true);

    try {
      const texts = { moralReport, perspectives, notes };

      const response = await fetch('/api/annee/cloturer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newYearLabel: newYear.trim(), ...texts }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de clôturer l’année scolaire.');
      }

      const closedYearId: string = data.closedYearId;
      const closedNewYear: string = data.result?.newYear || newYear.trim();

      onClosed(closedNewYear);

      const archiveInfo = await loadArchiveState(closedYearId);

      const state: ArchiveState = {
        yearId: closedYearId,
        schoolYear: report.schoolYear,
        newYear: closedNewYear,
        driveFolderUrl: null,
        steps: archiveInfo.steps.map((s) => ({ ...s, status: 'pending' })),
        running: false,
        finished: false,
        // Textes renvoyés seulement si leur enregistrement a échoué.
        texts: data.textsSaved ? undefined : texts,
      };

      setClosing(false);
      setMoralReport('');
      setPerspectives('');
      setNotes('');
      setConfirmed(false);
      onClose();
      setArchivePanelOpen(true);
      void runArchive(state);
    } catch (err) {
      setClosing(false);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    }
  }

  const doneCount = archive?.steps.filter((s) => s.status === 'done').length || 0;
  const totalCount = archive?.steps.length || 0;
  const hasError = archive?.steps.some((s) => s.status === 'error');

  const evolution =
    report?.previousYear
      ? report.totalAdherents - report.previousYear.totalAdherents
      : null;

  return (
    <>
      {/* Bannière : archivage resté incomplet */}
      {archive && !archive.finished && !archivePanelOpen && (
        <div className="notice yc-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>Archivage Drive incomplet pour {archive.schoolYear}.</strong>
            <span>
              L’année est bien clôturée, mais tous les fichiers n’ont pas été
              envoyés dans le Drive.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setArchivePanelOpen(true);
              void runArchive(archive);
            }}
          >
            <RotateCcw size={14} />
            Reprendre l’archivage
          </button>
        </div>
      )}

      {/* FENÊTRE DE CLÔTURE */}
      {open && (
        <div className="yc-backdrop" role="dialog" aria-modal="true">
          <div className="card yc-modal">
            <div className="yc-head">
              <div>
                <div className="eyebrow">Configuration</div>
                <h2 className="section-title">
                  Clôturer l’année {report?.schoolYear || ''}
                </h2>
              </div>
              <button
                type="button"
                className="btn"
                onClick={closeModal}
                disabled={closing}
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            {loading && (
              <div className="yc-info">
                <Loader2 size={16} className="yc-spin" />
                Préparation de l’aperçu…
              </div>
            )}

            {report && (
              <>
                <h3 className="yc-title">1. Adhésions</h3>
                <div className="yc-metrics">
                  <div className="yc-metric">
                    <span>Adhérents</span>
                    <strong>{report.totalAdherents}</strong>
                  </div>
                  <div className="yc-metric">
                    <span>
                      {report.previousYear
                        ? `Évolution / ${report.previousYear.schoolYear}`
                        : 'Évolution'}
                    </span>
                    <strong
                      className={
                        evolution === null || evolution === 0
                          ? ''
                          : evolution > 0
                            ? 'yc-pos'
                            : 'yc-neg'
                      }
                    >
                      {evolution === null
                        ? 'Première année'
                        : `${evolution > 0 ? '+' : ''}${evolution}`}
                    </strong>
                  </div>
                </div>

                {report.adherentsByClass.length > 0 && (
                  <div className="yc-chips">
                    {report.adherentsByClass.map((c) => (
                      <span key={c.className} className="yc-chip">
                        {c.className} <strong>{c.count}</strong>
                      </span>
                    ))}
                  </div>
                )}

                <h3 className="yc-title">2. Finances</h3>
                <div className="yc-metrics yc-metrics-4">
                  <div className="yc-metric">
                    <span>Solde initial</span>
                    <strong>{euro(report.initialBalance)}</strong>
                  </div>
                  <div className="yc-metric">
                    <span>Recettes</span>
                    <strong className="yc-pos">{euro(report.totalRecettes)}</strong>
                  </div>
                  <div className="yc-metric">
                    <span>Dépenses</span>
                    <strong className="yc-neg">{euro(report.totalDepenses)}</strong>
                  </div>
                  <div className="yc-metric">
                    <span>Solde final</span>
                    <strong className={report.solde < 0 ? 'yc-neg' : ''}>
                      {euro(report.solde)}
                    </strong>
                  </div>
                </div>

                {report.financialByCategory.length > 0 && (
                  <table className="table yc-table">
                    <thead>
                      <tr>
                        <th>Catégorie</th>
                        <th className="yc-right">Recettes</th>
                        <th className="yc-right">Dépenses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.financialByCategory.map((c) => (
                        <tr key={c.category}>
                          <td>{c.category}</td>
                          <td className="yc-right">
                            {c.recettes ? euro(c.recettes) : '–'}
                          </td>
                          <td className="yc-right">
                            {c.depenses ? euro(c.depenses) : '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <h3 className="yc-title">
                  3. Instances de l’année ({report.meetings.length})
                </h3>
                {report.meetings.length === 0 ? (
                  <p className="section-sub">Aucune réunion enregistrée.</p>
                ) : (
                  <ul className="yc-meetings">
                    {report.meetings.map((m) => (
                      <li key={m.id}>
                        <span>{dateFr(m.date)}</span>
                        <span>
                          {m.type} – {m.subject}
                        </span>
                        <span className={m.hasSummary ? 'yc-pos' : 'yc-muted'}>
                          {m.hasSummary ? 'Compte rendu' : 'Sans compte rendu'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <h3 className="yc-title">4. Textes du bilan</h3>
                <p className="section-sub">
                  Ces textes apparaîtront dans le PDF du bilan. Laissés vides,
                  le PDF contiendra des lignes pour écrire à la main.
                </p>

                <label className="yc-label" htmlFor="yc-moral">
                  Bilan moral
                </label>
                <textarea
                  id="yc-moral"
                  className="input yc-textarea"
                  rows={7}
                  value={moralReport}
                  onChange={(e) => setMoralReport(e.target.value)}
                  placeholder="Actions menées, temps forts, participation aux conseils…"
                />

                <label className="yc-label" htmlFor="yc-perspectives">
                  Perspectives
                </label>
                <textarea
                  id="yc-perspectives"
                  className="input yc-textarea"
                  rows={4}
                  value={perspectives}
                  onChange={(e) => setPerspectives(e.target.value)}
                  placeholder="Projets et objectifs pour l’année prochaine…"
                />

                <label className="yc-label" htmlFor="yc-notes">
                  Remarques libres <span className="yc-muted">(facultatif)</span>
                </label>
                <textarea
                  id="yc-notes"
                  className="input yc-textarea"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <a
                  className="btn yc-preview-link"
                  href="/api/annee/bilan-pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={14} />
                  Aperçu du PDF (sans les textes ci-dessus)
                </a>

                <h3 className="yc-title">5. Clôture</h3>
                <div className="yc-new-year">
                  <label className="yc-label" htmlFor="yc-new-year">
                    Nouvelle année scolaire
                  </label>
                  <input
                    id="yc-new-year"
                    className="input"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    placeholder="2027-2028"
                  />
                </div>

                <div className="yc-warning">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Action définitive.</strong> L’année{' '}
                    {report.schoolYear} sera fermée et ne pourra plus être
                    modifiée. La nouvelle année démarrera avec un solde initial
                    de <strong>{euro(report.solde)}</strong>. Le bilan, les
                    listes et les instances seront ensuite archivés dans le
                    Drive.
                  </div>
                </div>

                <label className="yc-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  Je confirme vouloir clôturer l’année {report.schoolYear}.
                </label>
              </>
            )}

            {error && <div className="notice notice-error yc-error">{error}</div>}

            <div className="yc-actions">
              <button
                type="button"
                className="btn"
                onClick={closeModal}
                disabled={closing}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleClose()}
                disabled={!report || !confirmed || closing}
              >
                {closing ? (
                  <>
                    <Loader2 size={14} className="yc-spin" />
                    Clôture en cours…
                  </>
                ) : (
                  'Clôturer définitivement'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FENÊTRE D'ARCHIVAGE */}
      {archivePanelOpen && archive && (
        <div className="yc-backdrop" role="dialog" aria-modal="true">
          <div className="card yc-modal yc-archive">
            <div className="yc-head">
              <div>
                <div className="eyebrow">Clôture {archive.schoolYear}</div>
                <h2 className="section-title">
                  {archive.finished
                    ? 'Clôture terminée'
                    : 'Archivage dans le Drive'}
                </h2>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setArchivePanelOpen(false)}
                disabled={archive.running}
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            {archive.newYear && (
              <div className="yc-success">
                <CheckCircle2 size={18} />
                L’année {archive.schoolYear} est clôturée. L’année{' '}
                {archive.newYear} est maintenant active.
              </div>
            )}

            <div className="yc-progress">
              <div
                className="yc-progress-bar"
                style={{
                  width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="yc-progress-label">
              {doneCount} / {totalCount} étapes
            </div>

            <ul className="yc-steps">
              {archive.steps.map((step) => (
                <li key={step.key} className={`yc-step yc-step-${step.status}`}>
                  {step.status === 'done' && <CheckCircle2 size={16} />}
                  {step.status === 'running' && (
                    <Loader2 size={16} className="yc-spin" />
                  )}
                  {step.status === 'pending' && <Circle size={16} />}
                  {step.status === 'error' && <XCircle size={16} />}
                  <div>
                    <span>{step.label}</span>
                    {step.error && <small>{step.error}</small>}
                  </div>
                </li>
              ))}
            </ul>

            {error && <div className="notice notice-error yc-error">{error}</div>}

            {archive.finished && (
              <div className="yc-reminder">
                <AlertTriangle size={18} />
                <div>
                  <strong>Les listes élèves sont vides.</strong> Importer le
                  fichier du collège en début d’année prochaine
                  (Configuration → Importer le listing collège).
                </div>
              </div>
            )}

            <div className="yc-actions yc-actions-wrap">
              <a
                className="btn"
                href={`/api/annee/bilan-pdf?yearId=${archive.yearId}`}
              >
                <Download size={14} />
                Télécharger le bilan (PDF)
              </a>

              {archive.driveFolderUrl && (
                <a
                  className="btn"
                  href={archive.driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} />
                  Ouvrir le dossier Drive
                </a>
              )}

              {hasError && !archive.running && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setError('');
                    void runArchive(archive);
                  }}
                >
                  <RotateCcw size={14} />
                  Reprendre l’archivage
                </button>
              )}

              {!hasError && !archive.running && !archive.finished && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void runArchive(archive)}
                >
                  <FolderUp size={14} />
                  Lancer l’archivage
                </button>
              )}

              {archive.finished && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setArchivePanelOpen(false)}
                >
                  Terminer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .yc-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
          padding: 14px 16px;
          border: 1px solid #ead9b8;
          border-radius: 12px;
          background: #fffaf0;
          color: #72551e;
        }
        .yc-banner > div {
          flex: 1;
          display: grid;
          gap: 3px;
          font-size: 13px;
        }
        .yc-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px 16px;
          overflow-y: auto;
          background: rgba(15, 23, 42, 0.45);
        }
        .yc-modal {
          width: min(820px, 100%);
          padding: 24px;
          box-sizing: border-box;
          background: #fff;
        }
        .yc-archive {
          width: min(640px, 100%);
          margin-top: 6vh;
        }
        .yc-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
        }
        .yc-head :global(.btn),
        .yc-actions :global(.btn) {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        .yc-title {
          margin: 22px 0 10px;
          font-size: 15px;
          color: #7d201a;
          border-bottom: 1px solid #eadfd5;
          padding-bottom: 6px;
        }
        .yc-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .yc-metrics-4 {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .yc-metric {
          display: grid;
          gap: 4px;
          padding: 12px 14px;
          border: 1px solid #eadfd5;
          border-radius: 10px;
          background: #fffaf3;
        }
        .yc-metric span {
          font-size: 11px;
          color: #756a67;
        }
        .yc-metric strong {
          font-size: 19px;
          white-space: nowrap;
        }
        .yc-pos {
          color: #166534;
        }
        .yc-neg {
          color: #b91c1c;
        }
        .yc-muted {
          color: #94a3b8;
          font-weight: 400;
        }
        .yc-right {
          text-align: right;
        }
        .yc-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }
        .yc-chip {
          padding: 4px 9px;
          border: 1px solid #eadfd5;
          border-radius: 999px;
          font-size: 12px;
          background: #fff;
        }
        .yc-table {
          margin-top: 10px;
          width: 100%;
        }
        .yc-meetings {
          list-style: none;
          margin: 0;
          padding: 0;
          max-height: 190px;
          overflow-y: auto;
          border: 1px solid #eadfd5;
          border-radius: 10px;
        }
        .yc-meetings li {
          display: grid;
          grid-template-columns: 88px minmax(0, 1fr) auto;
          gap: 10px;
          padding: 8px 12px;
          font-size: 13px;
          border-bottom: 1px solid #f1e9e2;
        }
        .yc-meetings li:last-child {
          border-bottom: 0;
        }
        .yc-meetings li span:last-child {
          font-size: 11px;
          white-space: nowrap;
        }
        .yc-label {
          display: block;
          margin: 14px 0 6px;
          font-size: 13px;
          font-weight: 700;
        }
        .yc-textarea {
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
          font-family: inherit;
        }
        .yc-preview-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 14px;
          text-decoration: none;
        }
        .yc-new-year {
          max-width: 240px;
        }
        .yc-warning,
        .yc-reminder {
          display: flex;
          gap: 10px;
          margin-top: 14px;
          padding: 12px 14px;
          border: 1px solid #ead9b8;
          border-radius: 10px;
          background: #fffaf0;
          color: #72551e;
          font-size: 13px;
          line-height: 1.5;
        }
        .yc-warning :global(svg),
        .yc-reminder :global(svg) {
          flex-shrink: 0;
          margin-top: 2px;
        }
        .yc-confirm {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 14px;
          font-size: 14px;
          font-weight: 600;
          color: #8f211c;
          cursor: pointer;
        }
        .yc-confirm input {
          width: 17px;
          height: 17px;
          accent-color: #8f211c;
        }
        .yc-error {
          margin-top: 14px;
        }
        .yc-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }
        .yc-actions-wrap {
          flex-wrap: wrap;
        }
        .yc-actions a {
          text-decoration: none;
        }
        .yc-info,
        .yc-success {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 13px;
        }
        .yc-info {
          background: #f7f2eb;
          color: #6f6663;
        }
        .yc-success {
          background: #f2fbf4;
          border: 1px solid #c9e4d1;
          color: #27643a;
          font-weight: 600;
        }
        .yc-progress {
          height: 8px;
          margin-top: 18px;
          border-radius: 999px;
          background: #f1e9e2;
          overflow: hidden;
        }
        .yc-progress-bar {
          height: 100%;
          background: #8f211c;
          transition: width 0.3s ease;
        }
        .yc-progress-label {
          margin-top: 6px;
          font-size: 12px;
          color: #756a67;
          text-align: right;
        }
        .yc-steps {
          list-style: none;
          margin: 12px 0 0;
          padding: 0;
          max-height: 300px;
          overflow-y: auto;
        }
        .yc-step {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 7px 0;
          font-size: 13px;
          border-bottom: 1px solid #f6efe9;
        }
        .yc-step :global(svg) {
          flex-shrink: 0;
          margin-top: 1px;
        }
        .yc-step > div {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .yc-step small {
          color: #b91c1c;
        }
        .yc-step-pending {
          color: #94a3b8;
        }
        .yc-step-done :global(svg) {
          color: #166534;
        }
        .yc-step-error :global(svg) {
          color: #b91c1c;
        }
        .yc-step-running {
          font-weight: 700;
        }
        :global(.yc-spin) {
          animation: yc-spin 0.8s linear infinite;
        }
        @keyframes -global-yc-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 700px) {
          .yc-modal {
            padding: 16px;
          }
          .yc-metrics-4 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .yc-meetings li {
            grid-template-columns: 1fr;
            gap: 2px;
          }
          .yc-banner {
            flex-direction: column;
            align-items: stretch;
          }
          .yc-actions {
            flex-direction: column-reverse;
          }
        }
      `}</style>
    </>
  );
}
