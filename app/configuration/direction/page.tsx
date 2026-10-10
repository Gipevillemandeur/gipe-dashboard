'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

type DirectionMember = {
  id?: string;
  display_name: string;
  role: string | null;
  active: boolean;
};

export default function ConfigurationDirectionPage() {
  const [direction, setDirection] = useState<DirectionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDirection, setSavingDirection] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/configuration', {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossible de charger la configuration.'
        );
      }

      setDirection(data.direction || []);
      setDirty(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de charger la configuration.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /*
   * Prévient avant de quitter la page avec
   * des modifications non enregistrées.
   */
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function updateDirection(
    index: number,
    field: 'display_name' | 'role',
    value: string
  ) {
    setDirty(true);
    setMessage('');
    setDirection((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function addDirection() {
    setDirty(true);
    setMessage('');
    setDirection((current) => [
      ...current,
      {
        display_name: '',
        role: '',
        active: true,
      },
    ]);
  }

  function removeDirection(index: number) {
    setDirty(true);
    setMessage('');
    setDirection((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  async function saveDirection() {
    setSavingDirection(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/configuration', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          members: direction.map((member) => ({
            id: member.id,
            displayName: member.display_name,
            role: member.role || '',
            active: member.active,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible d’enregistrer la direction.'
        );
      }

      setMessage(
        'La composition de la direction a été enregistrée.'
      );

      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible d’enregistrer la direction.'
      );
    } finally {
      setSavingDirection(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Configuration · Direction
          </div>

          <h1>
            Direction du collège
          </h1>

          <div className="kicker">
            Cette liste se gère uniquement ici : l’import du
            fichier du collège n’y touche jamais.
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

      {(message || error) && (
        <div
          className={`notice ${
            error ? 'notice-error' : ''
          }`}
          style={{ marginBottom: 18 }}
        >
          <ShieldCheck size={17} />

          <div>
            {error || message}
          </div>
        </div>
      )}

      <section className="card section-card direction-card">

        <div className="section-head direction-section-head">

          <div className="direction-intro">
            <h2 className="section-title">
              Membres de la direction
            </h2>

            <p className="section-sub">
              Ajoute, modifie ou supprime les personnes
              qui doivent apparaître dans les comptes rendus.
              Elles sont classées automatiquement : principal(e),
              adjoint(e), CPE, puis les autres.
            </p>

            {dirty && (
              <span className="badge badge-warn direction-dirty">
                Modifications non enregistrées
              </span>
            )}
          </div>

          <div className="btn-row direction-actions">

            <button
              className="btn"
              onClick={addDirection}
              type="button"
            >
              <Plus size={14} />
              Ajouter
            </button>

            <button
              className="btn btn-primary"
              onClick={saveDirection}
              disabled={
                savingDirection || loading
              }
              type="button"
            >
              <Save size={14} />

              {savingDirection
                ? 'Enregistrement…'
                : 'Enregistrer'}
            </button>

          </div>

        </div>

        {loading ? (
          <p className="kicker">
            Chargement…
          </p>
        ) : direction.length === 0 ? (
          <p className="kicker">
            Aucun membre de la direction enregistré.
          </p>
        ) : (
          <>
            {/* VERSION PC / TABLETTE */}
            <div className="direction-desktop-table">
              <table className="table">

                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Fonction</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {direction.map(
                    (member, index) => (
                      <tr
                        key={
                          member.id ||
                          `new-${index}`
                        }
                      >

                        <td>
                          <input
                            className="input"
                            value={
                              member.display_name
                            }
                            onChange={(e) =>
                              updateDirection(
                                index,
                                'display_name',
                                e.target.value
                              )
                            }
                            placeholder="Nom Prénom"
                          />
                        </td>

                        <td>
                          <input
                            className="input"
                            value={
                              member.role || ''
                            }
                            onChange={(e) =>
                              updateDirection(
                                index,
                                'role',
                                e.target.value
                              )
                            }
                            placeholder="Principale, principale adjointe…"
                          />
                        </td>

                        <td
                          style={{
                            width: 60,
                          }}
                        >
                          <button
                            className="btn"
                            title="Supprimer"
                            onClick={() =>
                              removeDirection(
                                index
                              )
                            }
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>

                      </tr>
                    )
                  )}
                </tbody>

              </table>
            </div>

            {/* VERSION MOBILE */}
            <div className="direction-mobile-list">

              {direction.map(
                (member, index) => (
                  <div
                    className="direction-mobile-item"
                    key={
                      member.id ||
                      `mobile-${index}`
                    }
                  >

                    <div className="direction-mobile-head">
                      <div className="direction-mobile-number">
                        {index + 1}
                      </div>

                      <div className="direction-mobile-label">
                        Membre de la direction
                      </div>

                      <button
                        className="direction-mobile-delete"
                        title="Supprimer"
                        onClick={() =>
                          removeDirection(
                            index
                          )
                        }
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="direction-mobile-field">
                      <label>
                        Nom
                      </label>

                      <input
                        className="input"
                        value={
                          member.display_name
                        }
                        onChange={(e) =>
                          updateDirection(
                            index,
                            'display_name',
                            e.target.value
                          )
                        }
                        placeholder="Nom Prénom"
                      />
                    </div>

                    <div className="direction-mobile-field">
                      <label>
                        Fonction
                      </label>

                      <input
                        className="input"
                        value={
                          member.role || ''
                        }
                        onChange={(e) =>
                          updateDirection(
                            index,
                            'role',
                            e.target.value
                          )
                        }
                        placeholder="Principale, principale adjointe…"
                      />
                    </div>

                  </div>
                )
              )}

            </div>
          </>
        )}

        <div
          className="notice direction-notice"
        >
          <ShieldCheck size={16} />

          <div>
            <strong>
              Principe retenu
            </strong>

            <br />

            Le fichier du collège met à jour
            les élèves, les classes et les équipes.
            Les codes (Configuration → Gérer les classes)
            et la direction (ici) se gèrent uniquement
            dans le dashboard.
          </div>
        </div>

      </section>

      <style jsx>{`
        .direction-mobile-list {
          display: none;
        }

        /* Icône et texte des boutons sur une seule ligne. */
        .btn,
        .topbar-right :global(.btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          white-space: nowrap;
        }

        .direction-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-shrink: 0;
        }

        .direction-dirty {
          display: inline-flex;
          margin-top: 10px;
        }

        .direction-mobile-item {
          border: 1px solid #eadfd5;
          border-radius: 14px;
          background: #fffaf3;
          padding: 15px;
          box-sizing: border-box;
        }

        .direction-mobile-head {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 15px;
        }

        .direction-mobile-number {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          border-radius: 8px;
          background: #fff0d9;
          color: #8f211c;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }

        .direction-mobile-label {
          flex: 1;
          min-width: 0;
          font-size: 12px;
          font-weight: 700;
          color: #756a67;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .direction-mobile-delete {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          border: 1px solid #eadfd5;
          border-radius: 9px;
          background: #fff;
          color: #7d201a;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .direction-mobile-field {
          display: grid;
          gap: 7px;
          margin-top: 13px;
          min-width: 0;
        }

        .direction-mobile-field label {
          font-size: 12px;
          font-weight: 700;
          color: #756a67;
        }

        .direction-notice {
          margin-top: 16px;
        }

        @media (max-width: 700px) {
          .direction-section-head {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }

          .direction-intro {
            min-width: 0;
          }

          .direction-actions {
            width: 100%;
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            gap: 10px;
          }

          .direction-actions .btn {
            width: 100%;
            justify-content: center;
            box-sizing: border-box;
          }

          .direction-desktop-table {
            display: none;
          }

          .direction-mobile-list {
            display: grid;
            gap: 12px;
            min-width: 0;
          }

          .direction-notice {
            align-items: flex-start;
          }
        }

        @media (max-width: 430px) {
          .direction-actions {
            grid-template-columns:
              minmax(0, 1fr);
          }

          .direction-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
