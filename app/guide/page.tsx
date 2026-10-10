'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Info,
  Lock,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';

type GuideSection = {
  slug: string;
  title: string;
  summary: string;
  presidentOnly: boolean;
  body: string;
  customized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

type GuideData = {
  canEdit: boolean;
  storageReady: boolean;
  sections: GuideSection[];
};

/* ---------------------------------------------------------
 * Mise en forme simple du texte (sans HTML) :
 * ## titre, - liste, 1. étapes, **gras**, > astuce, ! attention
 * --------------------------------------------------------- */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

function renderBody(body: string): ReactNode[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(<h3 key={i}>{inline(line.slice(3))}</h3>);
      i += 1;
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={i}>
          {items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={i}>
          {items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.startsWith('> ') || line.startsWith('! ')) {
      const warning = line.startsWith('! ');
      blocks.push(
        <div key={i} className={`guide-callout ${warning ? 'guide-callout-warn' : ''}`}>
          {warning ? <AlertTriangle size={16} /> : <Info size={16} />}
          <p>{inline(line.slice(2))}</p>
        </div>
      );
      i += 1;
      continue;
    }

    // Paragraphe : lignes consécutives non vides et non spéciales.
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(## |- |> |! |\d+[.)]\s)/.test(lines[i].trim())
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push(<p key={i}>{inline(paragraph.join(' '))}</p>);
  }

  return blocks;
}

function dateFr(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export default function GuidePage() {
  const [data, setData] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  async function load() {
    setError('');
    try {
      const response = await fetch('/api/guide', { cache: 'no-store' });
      const json = await readJson(response);
      if (!response.ok) {
        throw new Error(json?.error || 'Impossible de charger le guide.');
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le guide.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Prévenir avant de quitter la page en pleine modification.
  useEffect(() => {
    if (!editing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing]);

  function startEdit(section: GuideSection) {
    setEditing(section.slug);
    setDraft(section.body);
    setEditError('');
    setConfirmReset(false);
    setSavedSlug(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft('');
    setEditError('');
    setConfirmReset(false);
  }

  async function save(slug: string) {
    setSaving(true);
    setEditError('');
    try {
      const response = await fetch('/api/guide', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, body: draft }),
      });
      const json = await readJson(response);
      if (!response.ok) {
        throw new Error(json?.error || 'Enregistrement impossible.');
      }
      await load();
      cancelEdit();
      setSavedSlug(slug);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function resetSection(slug: string) {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const response = await fetch(`/api/guide?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      const json = await readJson(response);
      if (!response.ok) {
        throw new Error(json?.error || 'Opération impossible.');
      }
      await load();
      cancelEdit();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Opération impossible.');
    } finally {
      setSaving(false);
    }
  }

  const sections = data?.sections ?? [];

  return (
    <div className="guide">
      <div className="topbar">
        <div>
          <div className="eyebrow">Guide de passation</div>
          <h1>Guide de passation</h1>
          <div className="kicker">
            Tout ce qu’il faut savoir pour faire vivre le GIPE et transmettre le bureau.
          </div>
        </div>

        <div className="topbar-right guide-no-print">
          <button className="btn" type="button" onClick={() => window.print()}>
            <Printer size={14} />
            Imprimer / PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="notice notice-error" style={{ marginBottom: 18 }}>
          <AlertTriangle size={17} />
          <div>{error}</div>
        </div>
      )}

      {data && !data.storageReady && (
        <div className="notice guide-no-print" style={{ marginBottom: 18 }}>
          <Info size={17} />
          <div>
            Le guide s’affiche, mais les modifications ne sont pas encore possibles :
            le fichier <strong>migration_guide_v1.sql</strong> doit être lancé dans Supabase.
          </div>
        </div>
      )}

      {loading ? (
        <p className="kicker">Chargement du guide…</p>
      ) : (
        <>
          <section className="card section-card guide-toc">
            <h2 className="section-title">
              <BookOpen size={17} />
              Sommaire
            </h2>
            <ol>
              {sections.map((section) => (
                <li key={section.slug}>
                  <a href={`#${section.slug}`}>
                    {section.title}
                    {section.presidentOnly && (
                      <Lock size={12} aria-label="Président uniquement" />
                    )}
                  </a>
                  <span>{section.summary}</span>
                </li>
              ))}
            </ol>
          </section>

          {sections.map((section, index) => {
            const isEditing = editing === section.slug;

            return (
              <section
                key={section.slug}
                id={section.slug}
                className="card section-card guide-section"
              >
                <div className="guide-section-head">
                  <div className="guide-number">{index + 1}</div>

                  <div className="guide-head-text">
                    <h2 className="section-title">{section.title}</h2>
                    <div className="guide-meta">
                      {section.presidentOnly && (
                        <span className="badge badge-info">
                          <Lock size={11} />
                          Visible par le Président uniquement
                        </span>
                      )}
                      {section.customized && section.updatedAt && (
                        <span className="guide-updated">
                          Modifié le {dateFr(section.updatedAt)}
                          {section.updatedBy ? ` par ${section.updatedBy}` : ''}
                        </span>
                      )}
                      {savedSlug === section.slug && (
                        <span className="badge badge-ok">Enregistré</span>
                      )}
                    </div>
                  </div>

                  {data?.canEdit && !isEditing && (
                    <button
                      className="btn guide-no-print"
                      type="button"
                      onClick={() => startEdit(section)}
                      disabled={Boolean(editing)}
                    >
                      <Pencil size={14} />
                      Modifier
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="guide-editor">
                    <div className="guide-help">
                      Mise en forme : <code>## Sous-titre</code> · <code>- liste</code> ·{' '}
                      <code>1. étape</code> · <code>**gras**</code> ·{' '}
                      <code>&gt; astuce</code> · <code>! attention</code> · ligne vide =
                      nouveau paragraphe
                    </div>

                    <textarea
                      className="input guide-textarea"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={18}
                    />

                    <div className="guide-preview-label">Aperçu</div>
                    <div className="guide-body guide-preview">{renderBody(draft)}</div>

                    {editError && (
                      <div className="notice notice-error">
                        <AlertTriangle size={16} />
                        <div>{editError}</div>
                      </div>
                    )}

                    <div className="guide-editor-actions">
                      {section.customized && (
                        <button
                          className="btn guide-reset"
                          type="button"
                          onClick={() => resetSection(section.slug)}
                          disabled={saving}
                        >
                          <RotateCcw size={14} />
                          {confirmReset
                            ? 'Confirmer : revenir au texte d’origine'
                            : 'Revenir au texte d’origine'}
                        </button>
                      )}

                      <div className="guide-editor-main">
                        <button
                          className="btn"
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          <X size={14} />
                          Annuler
                        </button>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => save(section.slug)}
                          disabled={saving || !draft.trim()}
                        >
                          <Save size={14} />
                          {saving ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="guide-body">{renderBody(section.body)}</div>
                )}
              </section>
            );
          })}
        </>
      )}

      <style jsx>{`
        .guide {
          max-width: 980px;
        }

        .btn,
        .guide :global(.btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          white-space: nowrap;
        }

        .guide-toc {
          margin-bottom: 18px;
        }

        .guide-toc .section-title,
        .guide-toc :global(.section-title) {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .guide-toc ol {
          margin: 14px 0 0;
          padding-left: 22px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px 28px;
        }

        .guide-toc ol {
          list-style: decimal;
        }

        .guide-toc li::marker {
          color: #8f211c;
        }

        .guide-toc li {
          color: #8f211c;
          font-weight: 700;
          font-size: 14px;
        }

        .guide-toc a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #8f211c;
          text-decoration: none;
        }

        .guide-toc a:hover {
          text-decoration: underline;
        }

        .guide-toc span {
          display: block;
          margin-top: 2px;
          color: #756a67;
          font-size: 12px;
          font-weight: 500;
        }

        .guide-section {
          margin-bottom: 18px;
          scroll-margin-top: 20px;
        }

        .guide-section-head {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
        }

        .guide-number {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          border-radius: 9px;
          background: #fff0d9;
          color: #8f211c;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
        }

        .guide-head-text {
          flex: 1;
          min-width: 0;
        }

        .guide-head-text :global(.section-title) {
          margin-top: 4px;
        }

        .guide-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
        }

        .guide-meta :global(.badge) {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .guide-updated {
          color: #756a67;
          font-size: 12px;
        }

        .guide-body {
          color: #3a2f2c;
          font-size: 14px;
          line-height: 1.65;
        }

        .guide-body :global(h3) {
          margin: 20px 0 6px;
          color: #241c1b;
          font-size: 15px;
          font-weight: 800;
        }

        .guide-body :global(p) {
          margin: 8px 0;
        }

        .guide-body :global(ul),
        .guide-body :global(ol) {
          margin: 6px 0 10px;
          padding-left: 22px;
        }

        .guide-body :global(ul) {
          list-style: disc;
        }

        .guide-body :global(ol) {
          list-style: decimal;
        }

        .guide-body :global(li) {
          margin: 4px 0;
          padding-left: 2px;
        }

        .guide-body :global(li::marker) {
          color: #8f211c;
          font-weight: 700;
        }

        .guide-body :global(strong) {
          color: #241c1b;
        }

        .guide-body :global(.guide-callout) {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin: 12px 0;
          padding: 11px 13px;
          border: 1px solid #eadfd5;
          border-radius: 12px;
          background: #fff7ee;
          color: #5f514b;
        }

        .guide-body :global(.guide-callout svg) {
          flex: 0 0 auto;
          margin-top: 3px;
          color: #a2671c;
        }

        .guide-body :global(.guide-callout p) {
          margin: 0;
        }

        .guide-body :global(.guide-callout-warn) {
          border-color: #efd0cb;
          background: #fff5f3;
        }

        .guide-body :global(.guide-callout-warn svg) {
          color: #8f211c;
        }

        .guide-editor {
          display: grid;
          gap: 10px;
          margin-top: 8px;
        }

        .guide-help {
          color: #756a67;
          font-size: 12px;
          line-height: 1.7;
        }

        .guide-help code {
          padding: 1px 5px;
          border-radius: 5px;
          background: #f6eee6;
          color: #5f514b;
          font-size: 11.5px;
        }

        .guide-textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 280px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 13px;
          line-height: 1.55;
          resize: vertical;
        }

        .guide-preview-label {
          margin-top: 4px;
          color: #756a67;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .guide-preview {
          padding: 4px 16px;
          border: 1px dashed #e3d4c6;
          border-radius: 12px;
          background: #fffdf9;
        }

        .guide-editor-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .guide-editor-main {
          display: flex;
          gap: 10px;
          margin-left: auto;
        }

        .guide-reset {
          color: #8f211c;
        }

        @media (max-width: 760px) {
          .guide-toc ol {
            grid-template-columns: minmax(0, 1fr);
          }

          .guide-section-head {
            flex-wrap: wrap;
          }

          .guide-section-head > :global(.btn) {
            width: 100%;
          }

          .guide-editor-main {
            width: 100%;
          }

          .guide-editor-main :global(.btn),
          .guide-editor-main .btn {
            flex: 1;
          }

          .guide-reset {
            width: 100%;
          }
        }

        @media print {
          :global(.sidebar),
          :global(.mobile-header),
          :global(.mobile-overlay),
          .guide-no-print,
          .guide :global(.guide-no-print),
          .guide-help,
          .guide-textarea,
          .guide-preview-label,
          .guide-editor-actions {
            display: none !important;
          }

          .guide-preview {
            border: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }

          :global(.content) {
            margin: 0 !important;
            width: 100% !important;
            padding: 0 !important;
          }

          :global(body) {
            background: #fff !important;
          }

          .guide {
            max-width: none;
          }

          .guide :global(.card) {
            box-shadow: none !important;
            break-inside: auto;
          }

          .guide-section {
            break-before: auto;
          }

          .guide-body :global(h3),
          .guide-body :global(.guide-callout) {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
