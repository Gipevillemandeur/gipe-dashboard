'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  KeyRound,
  Save,
  ShieldCheck,
  UserRoundCog,
} from 'lucide-react';

type Permission = {
  id: string;
  code: string;
  label: string;
};

type Position = {
  id: string;
  name: string;
  is_default: boolean;
  active: boolean;
  email: string | null;
  permissions: string[];
};

type BureauData = {
  positions: Position[];
  permissions: Permission[];
  superAdminEmail: string | null;
};

export default function MembresBureauPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [superAdminEmail, setSuperAdminEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingSuperAdmin, setSavingSuperAdmin] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        '/api/configuration/membres-bureau',
        {
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger les membres du bureau.'
        );
      }

      setPositions(data.positions || []);
      setPermissions(data.permissions || []);
      setSuperAdminEmail(
        data.superAdminEmail || ''
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les membres du bureau.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updatePositionEmail(
    positionId: string,
    value: string
  ) {
    setPositions((current) =>
      current.map((position) =>
        position.id === positionId
          ? {
              ...position,
              email: value,
            }
          : position
      )
    );
  }

  function togglePermission(
    positionId: string,
    code: string
  ) {
    setPositions((current) =>
      current.map((position) => {
        if (position.id !== positionId) {
          return position;
        }

        const hasPermission =
          position.permissions.includes(code);

        return {
          ...position,
          permissions: hasPermission
            ? position.permissions.filter(
                (item) => item !== code
              )
            : [
                ...position.permissions,
                code,
              ],
        };
      })
    );
  }

  async function savePosition(
    position: Position
  ) {
    setSavingId(position.id);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        '/api/configuration/membres-bureau',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'position',
            positionId: position.id,
            email:
              position.email?.trim() || null,
            permissions:
              position.permissions,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible d’enregistrer le poste.'
        );
      }

      setMessage(
        `Le poste « ${position.name} » a été enregistré.`
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer le poste.'
      );
    } finally {
      setSavingId(null);
    }
  }

  async function saveSuperAdmin() {
    setSavingSuperAdmin(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        '/api/configuration/membres-bureau',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'super-admin',
            email:
              superAdminEmail.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible d’enregistrer le compte SUPER ADMIN.'
        );
      }

      setMessage(
        'Le compte SUPER ADMIN a été enregistré.'
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer le compte SUPER ADMIN.'
      );
    } finally {
      setSavingSuperAdmin(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="topbar">
          <div>
            <div className="eyebrow">
              Configuration · Membres du bureau
            </div>
            <h1>Membres du bureau</h1>
            <div className="kicker">
              Chargement de la configuration…
            </div>
          </div>
        </div>

        <section className="card section-card">
          <p className="kicker">
            Chargement…
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="topbar bureau-topbar">
        <div>
          <div className="eyebrow">
            Configuration · Membres du bureau
          </div>

          <h1>
            Membres du bureau
          </h1>

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

      {(error || message) && (
        <div
          className={`notice ${
            error ? 'notice-error' : ''
          }`}
          style={{
            marginBottom: 18,
          }}
        >
          {error ? (
            <ShieldCheck size={17} />
          ) : (
            <Check size={17} />
          )}

          <div>
            {error || message}
          </div>
        </div>
      )}

      <section className="card section-card bureau-super-admin-card">
        <div className="section-head bureau-card-head">
          <div>
            <h2 className="section-title">
              <KeyRound
                size={18}
                style={{
                  verticalAlign: '-3px',
                  marginRight: 8,
                }}
              />
              Compte SUPER ADMIN
            </h2>

          </div>
        </div>

        <div className="bureau-super-admin-form">
          <div className="bureau-field">
            <label htmlFor="super-admin-email">
              Adresse e-mail
            </label>

            <input
              id="super-admin-email"
              className="input"
              type="email"
              value={superAdminEmail}
              onChange={(event) =>
                setSuperAdminEmail(
                  event.target.value
                )
              }
              placeholder="adresse de récupération de l’association"
            />

          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={saveSuperAdmin}
            disabled={savingSuperAdmin}
          >
            <Save size={14} />
            {savingSuperAdmin
              ? 'Enregistrement…'
              : 'Enregistrer'}
          </button>
        </div>
      </section>

      <section className="bureau-positions">
        <div className="bureau-section-title">
          <h2 className="section-title">
            Postes du bureau
          </h2>
        </div>

        <div className="bureau-grid">
          {positions.map((position) => (
            <article
              className="card section-card bureau-position-card"
              key={position.id}
            >
              <div className="bureau-position-head">
                <div>
                  <div className="stat-label">
                    Poste
                  </div>

                  <h3 className="bureau-position-name">
                    {position.name}
                  </h3>
                </div>

                <div className="bureau-position-icon">
                  <UserRoundCog size={18} />
                </div>
              </div>

              <div className="bureau-field">
                <label
                  htmlFor={`email-${position.id}`}
                >
                  Titulaire / adresse e-mail
                </label>

                <input
                  id={`email-${position.id}`}
                  className="input"
                  type="email"
                  value={position.email || ''}
                  onChange={(event) =>
                    updatePositionEmail(
                      position.id,
                      event.target.value
                    )
                  }
                  placeholder="adresse e-mail"
                />

              </div>

              <div className="bureau-permissions">
                <div className="bureau-permissions-head">
                  <div>
                    <strong>
                      Autorisations
                    </strong>

                    <span>
                      {position.permissions.length}{' '}
                      sélectionnée
                      {position.permissions.length > 1
                        ? 's'
                        : ''}
                    </span>
                  </div>
                </div>

                <div className="bureau-permission-list">
                  {permissions.map((permission) => {
                    const checked =
                      position.permissions.includes(
                        permission.code
                      );

                    return (
                      <label
                        className={`bureau-permission ${
                          checked
                            ? 'bureau-permission-active'
                            : ''
                        }`}
                        key={permission.id}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            togglePermission(
                              position.id,
                              permission.code
                            )
                          }
                        />

                        <span>
                          {permission.label}
                        </span>
                      </label>
                    );
                  })}
                </div>

              </div>

              <div className="bureau-position-footer">
                <span className="bureau-position-status">
                  {position.email
                    ? 'Titulaire renseigné'
                    : 'Aucun titulaire renseigné'}
                </span>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    savePosition(position)
                  }
                  disabled={
                    savingId === position.id
                  }
                >
                  <Save size={14} />

                  {savingId === position.id
                    ? 'Enregistrement…'
                    : 'Enregistrer'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <style jsx>{`
        .bureau-topbar {
          align-items: flex-start;
        }

        .bureau-super-admin-card {
          margin-bottom: 22px;
        }

        .bureau-card-head {
          align-items: flex-start;
        }

        .bureau-super-admin-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: end;
          gap: 16px;
          margin-top: 20px;
        }

        .bureau-field {
          display: grid;
          gap: 7px;
          min-width: 0;
        }

        .bureau-field label {
          font-size: 12px;
          font-weight: 700;
        }

        .bureau-field small {
          color: #64748b;
          font-size: 11px;
          line-height: 1.4;
        }

        .bureau-positions {
          min-width: 0;
        }

        .bureau-section-title {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 14px;
        }

        .bureau-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .bureau-position-card {
          min-width: 0;
          box-sizing: border-box;
        }

        .bureau-position-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 20px;
        }

        .bureau-position-name {
          margin: 5px 0 0;
          font-size: 21px;
          line-height: 1.15;
          font-weight: 800;
          color: #111827;
        }

        .bureau-position-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #fff0d9;
          color: #8f211c;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .bureau-permissions {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid #eee2d7;
        }

        .bureau-permissions-head {
          margin-bottom: 10px;
        }

        .bureau-permissions-head > div {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .bureau-permissions-head span {
          color: #64748b;
          font-size: 11px;
        }

        .bureau-permission-list {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .bureau-permission {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          padding: 9px 10px;
          border: 1px solid #eadfd5;
          border-radius: 9px;
          background: #fffdf9;
          cursor: pointer;
          font-size: 12px;
          line-height: 1.25;
          box-sizing: border-box;
        }

        .bureau-permission-active {
          border-color: #cfa39f;
          background: #fff4f2;
        }

        .bureau-permission input {
          margin: 0;
          accent-color: #8f211c;
          flex-shrink: 0;
        }


        .bureau-position-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #eee2d7;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .bureau-position-status {
          color: #64748b;
          font-size: 11px;
        }

        @media (max-width: 800px) {
          .bureau-grid {
            grid-template-columns:
              minmax(0, 1fr);
          }

          .bureau-super-admin-form {
            grid-template-columns:
              minmax(0, 1fr);
          }
        }

        @media (max-width: 520px) {
          .bureau-permission-list {
            grid-template-columns:
              minmax(0, 1fr);
          }

          .bureau-position-footer {
            flex-direction: column;
            align-items: stretch;
          }

          .bureau-position-footer .btn {
            width: 100%;
            justify-content: center;
          }

          .bureau-position-name {
            font-size: 19px;
          }
        }
      `}</style>
    </>
  );
}
