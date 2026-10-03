'use client';

import { useEffect, useState } from 'react';

interface Settings {
  adresse: string;
  email: string;
  rna: string;
  president: string;
  facebook: string;
  instagram: string;
}

const defaultSettings: Settings = {
  adresse: '',
  email: '',
  rna: '',
  president: '',
  facebook: '',
  instagram: '',
};

export default function ParametresPage() {
  const [settings, setSettings] =
    useState<Settings>(defaultSettings);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [success, setSuccess] =
    useState('');

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError('');

      try {
        const response =
          await fetch(
            '/api/site/parametres',
            {
              cache: 'no-store',
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Impossible de charger les paramètres.'
          );
        }

        setSettings({
          adresse: data.adresse ?? '',
          email: data.email ?? '',
          rna: data.rna ?? '',
          president:
            data.president ?? '',
          facebook:
            data.facebook ?? '',
          instagram:
            data.instagram ?? '',
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger les paramètres.'
        );
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, []);

  function updateField(
    field: keyof Settings,
    value: string
  ) {
    setSettings(
      (current) => ({
        ...current,
        [field]: value,
      })
    );

    setSuccess('');
  }

  async function handleSave() {
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const response =
        await fetch(
          '/api/site/parametres',
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(
              settings
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible d’enregistrer les paramètres.'
        );
      }

      setSuccess(
        'Paramètres enregistrés avec succès.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer les paramètres.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="topbar">
          <div>
            <div className="eyebrow">
              Site internet
            </div>

            <h1>
              Paramètres
            </h1>

            <div className="kicker">
              Chargement…
            </div>
          </div>
        </div>

        <section className="card section-card">
          Chargement des paramètres…
        </section>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Site internet
          </div>

          <h1>
            Paramètres
          </h1>

          <div className="kicker">
            Informations générales affichées
            sur le site public.
          </div>
        </div>
      </div>

      {error && (
        <div
          className="notice notice-error"
          style={{
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="notice"
          style={{
            marginBottom: 18,
            background: '#e9f7ef',
            borderColor: '#b7dfc6',
            color: '#176b35',
          }}
        >
          {success}
        </div>
      )}

      <section className="card section-card">
        <div
          className="section-head"
          style={{
            marginBottom: 22,
          }}
        >
          <div>
            <h2 className="section-title">
              Informations générales
            </h2>

            <p className="section-sub">
              Ces informations sont utilisées
              dans différentes parties du site.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(0, 1fr))',
            gap: 18,
          }}
        >
          {/* Adresse */}
          <label
            style={{
              display: 'grid',
              gap: 7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            📍 Adresse

            <input
              className="input"
              type="text"
              value={settings.adresse}
              onChange={(e) =>
                updateField(
                  'adresse',
                  e.target.value
                )
              }
              placeholder="Adresse de l'association"
            />
          </label>

          {/* Email */}
          <label
            style={{
              display: 'grid',
              gap: 7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ✉️ Email

            <input
              className="input"
              type="email"
              value={settings.email}
              onChange={(e) =>
                updateField(
                  'email',
                  e.target.value
                )
              }
              placeholder="contact@exemple.fr"
            />
          </label>

          {/* RNA */}
          <label
            style={{
              display: 'grid',
              gap: 7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            🏷️ Numéro RNA

            <input
              className="input"
              type="text"
              value={settings.rna}
              onChange={(e) =>
                updateField(
                  'rna',
                  e.target.value
                )
              }
              placeholder="WXXXXXXX"
            />
          </label>

          {/* Président */}
          <label
            style={{
              display: 'grid',
              gap: 7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            👤 Président(e)

            <input
              className="input"
              type="text"
              value={settings.president}
              onChange={(e) =>
                updateField(
                  'president',
                  e.target.value
                )
              }
              placeholder="Nom et prénom"
            />
          </label>

          {/* Facebook */}
          <label
            style={{
              display: 'grid',
              gap: 7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Facebook

            <input
              className="input"
              type="url"
              value={settings.facebook}
              onChange={(e) =>
                updateField(
                  'facebook',
                  e.target.value
                )
              }
              placeholder="https://www.facebook.com/..."
            />
          </label>

          {/* Instagram */}
          <label
            style={{
              display: 'grid',
              gap: 7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Instagram

            <input
              className="input"
              type="url"
              value={settings.instagram}
              onChange={(e) =>
                updateField(
                  'instagram',
                  e.target.value
                )
              }
              placeholder="https://www.instagram.com/..."
            />
          </label>
        </div>

        {/* Enregistrer */}
        <div
          className="btn-row"
          style={{
            justifyContent: 'flex-end',
            marginTop: 26,
          }}
        >
          <button
            className="btn btn-primary"
            type="button"
            onClick={() =>
              void handleSave()
            }
            disabled={saving}
          >
            {saving
              ? 'Enregistrement…'
              : 'Enregistrer'}
          </button>
        </div>
      </section>

       <style jsx>{`
        @media (max-width: 760px) {
          section.card > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
