'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Eye,
  KeyRound,
  Mail,
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

/*
 * Rubriques avec 3 niveaux : Aucun · Voir · Modifier.
 *  - Modifier → on enregistre le code de la rubrique (ex. 'treasury'),
 *    qui donne aussi le droit de voir ;
 *  - Voir     → on enregistre le code « _view » (ex. 'treasury_view') ;
 *  - Aucun    → ni l'un ni l'autre.
 */
const SECTIONS: { code: string; label: string }[] = [
  { code: 'treasury', label: 'Trésorerie' },
  { code: 'members', label: 'Adhérents' },
  { code: 'schooling', label: 'Scolarité' },
  { code: 'agenda', label: 'Agenda' },
  { code: 'website', label: 'Site internet' },
  { code: 'drive', label: 'Docs Drive' },
];

type Level = 'none' | 'view' | 'edit';

const LEVELS: { value: Level; label: string }[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'view', label: 'Voir' },
  { value: 'edit', label: 'Modifier' },
];

function levelOf(codes: string[], section: string): Level {
  if (codes.includes(section)) return 'edit';
  if (codes.includes(`${section}_view`)) return 'view';
  return 'none';
}

function withLevel(codes: string[], section: string, level: Level) {
  const rest = codes.filter(
    (code) => code !== section && code !== `${section}_view`
  );

  if (level === 'edit') return [...rest, section];
  if (level === 'view') return [...rest, `${section}_view`];
  return rest;
}

export default function MembresBureauPage() {
  const [positions, setPositions] =
    useState<Position[]>([]);

  const [permissions, setPermissions] =
    useState<Permission[]>([]);

  const [superAdminEmail, setSuperAdminEmail] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [savingId, setSavingId] =
    useState<string | null>(null);

  const [invitingId, setInvitingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger les membres du bureau.'
        );
      }

      setPositions(
        data.positions || []
      );

      setPermissions(
        data.permissions || []
      );

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
        if (
          position.id !== positionId
        ) {
          return position;
        }

        const hasPermission =
          position.permissions.includes(
            code
          );

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

  function setLevel(
    positionId: string,
    section: string,
    level: Level
  ) {
    setPositions((current) =>
      current.map((position) =>
        position.id === positionId
          ? {
              ...position,
              permissions: withLevel(
                position.permissions,
                section,
                level
              ),
            }
          : position
      )
    );
  }

  /*
   * « Tout en lecture » : met « Voir » partout où il y
   * avait « Aucun » (les « Modifier » sont gardés) et
   * coche le tableau de bord.
   */
  function allRead(positionId: string) {
    setPositions((current) =>
      current.map((position) => {
        if (position.id !== positionId) {
          return position;
        }

        let codes = position.permissions;

        for (const section of sectionsReady) {
          if (levelOf(codes, section.code) === 'none') {
            codes = withLevel(codes, section.code, 'view');
          }
        }

        if (
          hasPermissionRow('dashboard') &&
          !codes.includes('dashboard')
        ) {
          codes = [...codes, 'dashboard'];
        }

        return { ...position, permissions: codes };
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
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            type: 'position',
            positionId:
              position.id,
            email:
              position.email?.trim() ||
              null,
            permissions:
              position.permissions,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible d’enregistrer le poste.'
        );
      }

      setMessage(
        `Les autorisations du poste « ${position.name} » ont été enregistrées.`
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

  async function invitePosition(
    position: Position
  ) {
    if (!position.email?.trim()) {
      setError(
        'Renseigne d’abord une adresse e-mail pour ce poste.'
      );
      setMessage('');
      return;
    }

    setInvitingId(position.id);
    setError('');
    setMessage('');

    try {
      /*
       * Le bouton Inviter enregistre d'abord
       * l'adresse et les autorisations actuelles.
       */
      const saveResponse = await fetch(
        '/api/configuration/membres-bureau',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            type: 'position',
            positionId:
              position.id,
            email:
              position.email.trim(),
            permissions:
              position.permissions,
          }),
        }
      );

      const saveData =
        await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(
          saveData?.error ||
            'Impossible d’enregistrer le titulaire.'
        );
      }

      /*
       * Une fois les données enregistrées,
       * on envoie l'accès.
       *
       * L'API décide automatiquement s'il s'agit
       * d'un nouveau compte ou d'un compte existant.
       */
      const response = await fetch(
        '/api/configuration/membres-bureau',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            positionId:
              position.id,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible d’envoyer l’accès.'
        );
      }

      setMessage(
        `Accès envoyé à ${position.email}.`
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’envoyer l’accès.'
      );
    } finally {
      setInvitingId(null);
    }
  }

  function hasPermissionRow(code: string) {
    return permissions.some(
      (permission) => permission.code === code
    );
  }

  /*
   * Rubriques à 3 niveaux : seulement si le SQL
   * (migration_droits_v1.sql) a créé les codes « _view ».
   */
  const sectionsReady = SECTIONS.filter(
    (section) =>
      hasPermissionRow(section.code) &&
      hasPermissionRow(`${section.code}_view`)
  );

  const sectionCodes = new Set(
    sectionsReady.flatMap((section) => [
      section.code,
      `${section.code}_view`,
    ])
  );

  // Autres autorisations (tableau de bord, configuration…) : cases à cocher.
  const otherPermissions = permissions.filter(
    (permission) =>
      !sectionCodes.has(permission.code) &&
      !permission.code.endsWith('_view')
  );

  const viewCodesMissing =
    !loading &&
    permissions.length > 0 &&
    sectionsReady.length === 0;

  if (loading) {
    return (
      <>
        <div className="topbar">
          <div>
            <div className="eyebrow">
              Configuration · Membres du bureau
            </div>

            <h1>
              Membres du bureau
            </h1>

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
            error
              ? 'notice-error'
              : ''
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

      {viewCodesMissing && (
        <div
          className="notice notice-error"
          style={{ marginBottom: 18 }}
        >
          <ShieldCheck size={17} />
          <div>
            Le choix « Voir / Modifier » n’est pas encore
            installé : lance{' '}
            <strong>migration_droits_v1.sql</strong> dans
            Supabase (SQL Editor), puis recharge la page.
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

        {/*
          * Lecture seule : le SUPER ADMIN se modifie
          * uniquement dans Supabase.
          */}
        <div className="bureau-super-admin-form">
          <div className="bureau-field">
            <label htmlFor="super-admin-email">
              Adresse e-mail
            </label>

            <input
              id="super-admin-email"
              className="input"
              type="email"
              value={superAdminEmail || 'Aucun compte défini'}
              readOnly
              disabled
            />
          </div>
        </div>

        <p className="section-sub bureau-super-admin-note">
          Ce compte a tous les droits et ne peut pas être modifié depuis le dashboard.
        </p>
      </section>

      <section className="bureau-positions">
        <div className="bureau-section-title">
          <h2 className="section-title">
            Postes du bureau
          </h2>
        </div>

        <div className="bureau-grid">
          {positions.map(
            (position) => (
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
                    <UserRoundCog
                      size={18}
                    />
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
                    value={
                      position.email ||
                      ''
                    }
                    onChange={(event) =>
                      updatePositionEmail(
                        position.id,
                        event.target.value
                      )
                    }
                    placeholder="adresse e-mail"
                  />
                </div>

                <button
                  type="button"
                  className="btn bureau-invite-button"
                  onClick={() =>
                    invitePosition(
                      position
                    )
                  }
                  disabled={
                    !position.email?.trim() ||
                    invitingId ===
                      position.id
                  }
                >
                  <Mail size={14} />

                  {invitingId ===
                  position.id
                    ? 'Envoi…'
                    : 'Inviter / Envoyer l’accès'}
                </button>

                <div className="bureau-permissions">
                  <div className="bureau-permissions-head">
                    <div>
                      <strong>
                        Autorisations
                      </strong>

                      {sectionsReady.length > 0 && (
                        <button
                          type="button"
                          className="bureau-all-read"
                          onClick={() =>
                            allRead(position.id)
                          }
                          title="Met « Voir » sur toutes les rubriques encore à « Aucun » (les « Modifier » sont gardés)."
                        >
                          <Eye size={13} />
                          Tout en lecture
                        </button>
                      )}
                    </div>
                  </div>

                  {sectionsReady.length > 0 && (
                    <div className="bureau-levels">
                      {sectionsReady.map((section) => {
                        const level = levelOf(
                          position.permissions,
                          section.code
                        );

                        return (
                          <div
                            className="bureau-level-row"
                            key={section.code}
                          >
                            <span className="bureau-level-label">
                              {section.label}
                            </span>

                            <div
                              className="bureau-level-switch"
                              role="radiogroup"
                              aria-label={`${section.label} : niveau d’accès`}
                            >
                              {LEVELS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={
                                    level ===
                                    option.value
                                  }
                                  className={`bureau-level-option level-${option.value} ${
                                    level ===
                                    option.value
                                      ? 'is-active'
                                      : ''
                                  }`}
                                  onClick={() =>
                                    setLevel(
                                      position.id,
                                      section.code,
                                      option.value
                                    )
                                  }
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="bureau-permission-list">
                    {(sectionsReady.length > 0
                      ? otherPermissions
                      : permissions
                    ).map(
                      (
                        permission
                      ) => {
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
                            key={
                              permission.id
                            }
                          >
                            <input
                              type="checkbox"
                              checked={
                                checked
                              }
                              onChange={() =>
                                togglePermission(
                                  position.id,
                                  permission.code
                                )
                              }
                            />

                            <span>
                              {
                                permission.label
                              }
                            </span>
                          </label>
                        );
                      }
                    )}
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
                      savePosition(
                        position
                      )
                    }
                    disabled={
                      savingId ===
                      position.id ||
                      invitingId ===
                        position.id
                    }
                  >
                    <Save
                      size={14}
                    />

                    {savingId ===
                    position.id
                      ? 'Enregistrement…'
                      : 'Enregistrer'}
                  </button>
                </div>
              </article>
            )
          )}
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

        .bureau-super-admin-note {
          margin-top: 10px;
        }

        .bureau-super-admin-form {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr);
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

        .bureau-invite-button {
          width: 100%;
          justify-content: center;
          margin-top: 14px;
          box-sizing: border-box;
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

        .bureau-all-read {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border: 1px solid #e2d8cc;
          border-radius: 999px;
          background: #fff;
          color: #6b5d57;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .bureau-all-read:hover {
          background: #f6f1eb;
        }

        .bureau-levels {
          display: grid;
          gap: 6px;
          margin-bottom: 10px;
        }

        .bureau-level-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 6px 6px 6px 10px;
          border: 1px solid #eadfd5;
          border-radius: 9px;
          background: #fffdf9;
          min-width: 0;
        }

        .bureau-level-label {
          font-size: 12.5px;
          font-weight: 700;
          color: #241c1b;
          min-width: 0;
        }

        .bureau-level-switch {
          display: inline-flex;
          flex-shrink: 0;
          padding: 2px;
          border-radius: 8px;
          background: #f3ede6;
          gap: 2px;
        }

        .bureau-level-option {
          border: 0;
          background: transparent;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          color: #8a7c76;
          cursor: pointer;
          white-space: nowrap;
        }

        .bureau-level-option:hover {
          color: #241c1b;
        }

        .bureau-level-option.is-active {
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
        }

        .bureau-level-option.level-none.is-active {
          color: #6b5d57;
        }

        .bureau-level-option.level-view.is-active {
          color: #1e4f8a;
          background: #e8f0fb;
        }

        .bureau-level-option.level-edit.is-active {
          color: #fff;
          background: #8f211c;
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
          justify-content: flex-end;
          gap: 12px;
        }

        .bureau-position-status {
          color: #64748b;
          font-size: 11px;
          margin-right: auto;
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
