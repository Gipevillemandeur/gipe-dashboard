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
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/site/parametres', {
          cache: 'no-store',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || 'Impossible de charger les paramètres.'
          );
        }

        setSettings({
          adresse: data.adresse ?? '',
          email: data.email ?? '',
          rna: data.rna ?? '',
          president: data.president ?? '',
          facebook: data.facebook ?? '',
          instagram: data.instagram ?? '',
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

  function updateField(field: keyof Settings, value: string) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
    setSuccess('');
  }

  async function handleSave() {
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const response = await fetch('/api/site/parametres', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Impossible d’enregistrer les paramètres.'
        );
      }

      setSuccess('Paramètres enregistrés avec succès.');
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
            <div className="eyebrow">Site internet</div>
            <h1>Paramètres</h1>
            <div className="kicker">Chargement…</div>
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
          <div className="eyebrow">Site internet</div>
          <h1>Paramètres</h1>
          <div className="kicker">
            Informations générales affichées sur le site public.
          </div>
        </div>
      </div>

      {error && (
        <div
          className="notice notice-error"
          style={{ marginBottom: 18 }}
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

      <section className="card section-card parameters-card">
        <div className="section-head parameters-head">
          <div>
            <h2 className="section-title">Informations générales</h2>
            <p className="section-sub">
              Ces informations sont utilisées dans différentes parties du site.
            </p>
          </div>
        </div>

        <div className="parameters-grid">
          <label className="parameter-field">
            <span>📍 Adresse</span>
            <input
              className="input"
              type="text"
              value={settings.adresse}
              onChange={(e) => updateField('adresse', e.target.value)}
              placeholder="Adresse de l'association"
            />
          </label>

          <label className="parameter-field">
            <span>✉️ Email</span>
            <input
              className="input"
              type="email"
              value={settings.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="contact@exemple.fr"
            />
          </label>

          <label className="parameter-field">
            <span>🏷️ Numéro RNA</span>
            <input
              className="input"
              type="text"
              value={settings.rna}
              onChange={(e) => updateField('rna', e.target.value)}
              placeholder="WXXXXXXX"
            />
          </label>

          <label className="parameter-field">
            <span>👤 Président(e)</span>
            <input
              className="input"
              type="text"
              value={settings.president}
              onChange={(e) => updateField('president', e.target.value)}
              placeholder="Nom et prénom"
            />
          </label>

          <label className="parameter-field">
            <span>Facebook</span>
            <input
              className="input"
              type="url"
              value={settings.facebook}
              onChange={(e) => updateField('facebook', e.target.value)}
              placeholder="https://www.facebook.com/..."
            />
          </label>

          <label className="parameter-field">
            <span>Instagram</span>
            <input
              className="input"
              type="url"
              value={settings.instagram}
              onChange={(e) => updateField('instagram', e.target.value)}
              placeholder="https://www.instagram.com/..."
            />
          </label>
        </div>

        <div className="parameters-actions">
          <button
            className="btn btn-primary parameters-save"
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </section>

      <style jsx>{`
        .parameters-head {
          margin-bottom: 22px;
        }

        .parameters-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .parameter-field {
          display: grid;
          gap: 7px;
          min-width: 0;
          font-size: 12px;
          font-weight: 700;
        }

        .parameter-field span {
          line-height: 1.35;
        }

        .parameter-field .input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .parameters-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 26px;
        }

        .parameters-save {
          min-width: 130px;
        }

        @media (max-width: 760px) {
          .parameters-grid {
            grid-template-columns: 1fr;
            gap: 15px;
          }

          .parameters-head {
            margin-bottom: 18px;
          }

          .parameters-actions {
            justify-content: stretch;
            margin-top: 20px;
          }

          .parameters-save {
            width: 100%;
            min-width: 0;
          }
        }

        @media (max-width: 480px) {
          .parameters-card {
            padding: 18px !important;
          }

          .parameter-field {
            font-size: 12px;
          }
        }
      `}</style>
    </>
  );
}
