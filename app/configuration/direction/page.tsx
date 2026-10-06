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

  function updateDirection(
    index: number,
    field: 'display_name' | 'role',
    value: string
  ) {
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
            Cette liste est indépendante du fichier des élèves
            et reste en place lorsqu’un import ne contient pas
            de direction.
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

      <section className="card section-card">
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Membres de la direction
            </h2>

            <p className="section-sub">
              Ajoute, modifie ou supprime les personnes
              qui doivent apparaître dans les comptes rendus.
            </p>
          </div>

          <div className="btn-row">
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
              disabled={savingDirection || loading}
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
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Fonction</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {direction.map((member, index) => (
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

                  <td style={{ width: 60 }}>
                    <button
                      className="btn"
                      title="Supprimer"
                      onClick={() =>
                        removeDirection(index)
                      }
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div
          className="notice"
          style={{ marginTop: 16 }}
        >
          <ShieldCheck size={16} />

          <div>
            <strong>
              Principe retenu
            </strong>

            <br />

            Le fichier du collège met à jour
            les élèves, les classes et les équipes.
            Les codes et la direction sont gérés
            ici dans le dashboard.
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 700px) {
          .topbar {
            gap: 14px;
          }

          .topbar-right {
            width: 100%;
          }

          .topbar-right .btn {
            width: auto;
          }

          .section-head {
            align-items: flex-start;
          }

          .btn-row {
            flex-wrap: wrap;
          }

          .btn-row .btn {
            width: auto;
          }

          .table {
            min-width: 620px;
          }

          .card.section-card {
            overflow-x: auto;
          }
        }

        @media (max-width: 480px) {
          .btn-row {
            width: 100%;
          }

          .btn-row .btn {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
