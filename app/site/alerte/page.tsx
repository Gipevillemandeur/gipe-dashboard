'use client';

import { useEffect, useState } from 'react';

type AlertType = 'info' | 'urgent';

interface AlertSettings {
  enabled: boolean;
  message: string;
  type: AlertType;
}

export default function AlertePage() {
  const [settings, setSettings] = useState<AlertSettings>({
    enabled: false,
    message: '',
    type: 'info',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAlert() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch('/api/site/alerte');

        if (!response.ok) {
          throw new Error('Impossible de charger le bandeau d’alerte.');
        }

        const data = await response.json();

        setSettings({
          enabled: Boolean(data.enabled),
          message: data.message ?? '',
          type: data.type === 'urgent' ? 'urgent' : 'info',
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger le bandeau d’alerte.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadAlert();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setMessage('');
      setError('');

      const response = await fetch('/api/site/alerte', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Impossible d’enregistrer le bandeau.'
        );
      }

      setMessage('Bandeau d’alerte enregistré avec succès.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer le bandeau.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#f7f7f7',
          padding: '40px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: '0 auto',
            background: '#fff',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          Chargement du bandeau d’alerte…
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7f7f7',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1000,
          margin: '0 auto',
        }}
      >
        {/* En-tête */}
        <div
          style={{
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              margin: 0,
              color: '#5b0f1b',
            }}
          >
            Bandeau d’alerte
          </h1>

          <p
            style={{
              marginTop: 8,
              color: '#666',
              fontSize: 15,
            }}
          >
            Gérez le message qui apparaît en haut du site public.
          </p>
        </div>

        {/* Carte principale */}
        <section
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          {/* Activation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              paddingBottom: 24,
              borderBottom: '1px solid #eee',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#222',
                }}
              >
                Afficher le bandeau
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 14,
                  color: '#777',
                }}
              >
                Le bandeau sera visible immédiatement sur le site public.
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  enabled: !current.enabled,
                }))
              }
              style={{
                border: 'none',
                cursor: 'pointer',
                borderRadius: 999,
                padding: '8px 18px',
                fontWeight: 700,
                fontSize: 14,
                background: settings.enabled ? '#198754' : '#777',
                color: '#fff',
                minWidth: 110,
              }}
            >
              {settings.enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
            </button>
          </div>

          {/* Type */}
          <div
            style={{
              marginTop: 24,
            }}
          >
            <label
              htmlFor="alert-type"
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 8,
                color: '#222',
              }}
            >
              Type de bandeau
            </label>

            <select
              id="alert-type"
              value={settings.type}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  type:
                    event.target.value === 'urgent'
                      ? 'urgent'
                      : 'info',
                }))
              }
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '11px 12px',
                border: '1px solid #ccc',
                borderRadius: 8,
                fontSize: 15,
                background: '#fff',
              }}
            >
              <option value="info">ℹ️ Information</option>
              <option value="urgent">⚠️ Urgent</option>
            </select>
          </div>

          {/* Message */}
          <div
            style={{
              marginTop: 24,
            }}
          >
            <label
              htmlFor="alert-message"
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 8,
                color: '#222',
              }}
            >
              Message
            </label>

            <textarea
              id="alert-message"
              value={settings.message}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  message: event.target.value,
                }))
              }
              placeholder="Exemple : Les inscriptions au bal de fin d’année sont ouvertes."
              rows={5}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ccc',
                borderRadius: 8,
                fontSize: 15,
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />

            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: '#777',
              }}
            >
              Les liens commençant par http:// ou https:// seront
              automatiquement cliquables sur le site public.
            </div>
          </div>

          {/* Aperçu */}
          <div
            style={{
              marginTop: 28,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 10,
                color: '#222',
              }}
            >
              Aperçu
            </div>

            <div
              style={{
                overflow: 'hidden',
                borderRadius: 8,
                background:
                  settings.type === 'urgent'
                    ? '#dc3545'
                    : '#f4c542',
                color:
                  settings.type === 'urgent'
                    ? '#fff'
                    : '#000',
                padding: '10px 16px',
                fontSize: 15,
                fontWeight: 600,
                minHeight: 22,
              }}
            >
              {settings.type === 'urgent' ? '⚠️ ' : 'ℹ️ '}

              {settings.message.trim() || 'Votre message apparaîtra ici.'}
            </div>
          </div>

          {/* Messages système */}
          {message && (
            <div
              style={{
                marginTop: 20,
                padding: '12px 14px',
                borderRadius: 8,
                background: '#d1e7dd',
                color: '#0f5132',
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 20,
                padding: '12px 14px',
                borderRadius: 8,
                background: '#f8d7da',
                color: '#842029',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {/* Bouton */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 28,
            }}
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: 15,
                background: saving ? '#999' : '#5b0f1b',
                color: '#fff',
              }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
