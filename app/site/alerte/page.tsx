'use client';

import {
  useEffect,
  useState,
} from 'react';

type AlertType = 'info' | 'urgent';

interface AlertSettings {
  enabled: boolean;
  message: string;
  type: AlertType;
}

const smileys = [
  '😊',
  '😃',
  '😄',
  '😁',
  '😂',
  '🤣',
  '😍',
  '🥳',
  '🤩',
  '👍',
  '👏',
  '❤️',
  '🙏',
];

const symbols = [
  '⚠️',
  '🚨',
  '✅',
  '❌',
  '📢',
  '📣',
  '🔔',
  '📅',
  '📌',
  '❗',
  '⭐',
  '💡',
  '🎉',
  '🎊',
  '🎓',
  '📚',
  '🏫',
];

export default function AlertePage() {
  const [settings, setSettings] =
    useState<AlertSettings>({
      enabled: false,
      message: '',
      type: 'info',
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [showSmileys, setShowSmileys] =
    useState(false);

  const [showSymbols, setShowSymbols] =
    useState(false);

  useEffect(() => {
    async function loadAlert() {
      setLoading(true);
      setError('');

      try {
        const response =
          await fetch(
            '/api/site/alerte',
            {
              cache: 'no-store',
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Impossible de charger le bandeau d’alerte.'
          );
        }

        setSettings({
          enabled: Boolean(
            data.enabled
          ),
          message:
            data.message ?? '',
          type:
            data.type === 'urgent'
              ? 'urgent'
              : 'info',
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

    void loadAlert();
  }, []);

  function insertText(
    value: string
  ) {
    setSettings(
      (current) => ({
        ...current,
        message:
          `${current.message}${value}`,
      })
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response =
        await fetch(
          '/api/site/alerte',
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
            'Impossible d’enregistrer le bandeau.'
        );
      }

      setMessage(
        'Bandeau d’alerte enregistré avec succès.'
      );
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
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Site internet
          </div>

          <h1>
            Bandeau d’alerte
          </h1>

          <div className="kicker">
            Chargement…
          </div>
        </div>
      </div>
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
            Bandeau d’alerte
          </h1>

          <div className="kicker">
            Gestion du message affiché
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

      {message && (
        <div
          className="notice"
          style={{
            marginBottom: 18,
            background: '#e9f7ef',
            borderColor: '#b7dfc6',
            color: '#176b35',
          }}
        >
          {message}
        </div>
      )}

      <section
        className="card section-card"
      >
        <div
          className="section-head"
          style={{
            marginBottom: 20,
          }}
        >
          <div>
            <h2 className="section-title">
              Configuration du bandeau
            </h2>

            <p className="section-sub">
              Activez le bandeau et
              définissez le message qui
              sera visible sur le site.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 18,
          }}
        >
          {/* Activation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between',
              gap: 20,
              padding: 14,
              border:
                '1px solid var(--gipe-line)',
              borderRadius: 12,
              background:
                '#fffdf9',
            }}
          >
            <div>
              <strong>
                Afficher le bandeau
              </strong>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color:
                    'var(--gipe-muted)',
                }}
              >
                Le bandeau sera visible
                sur le site public.
              </div>
            </div>

            <button
              className="btn"
              type="button"
              onClick={() =>
                setSettings(
                  (current) => ({
                    ...current,
                    enabled:
                      !current.enabled,
                  })
                )
              }
              style={{
                minWidth: 110,
                fontWeight: 700,
                color:
                  settings.enabled
                    ? '#176b35'
                    : '#777',
                borderColor:
                  settings.enabled
                    ? '#b7dfc6'
                    : 'var(--gipe-line)',
                background:
                  settings.enabled
                    ? '#e9f7ef'
                    : '#fff',
              }}
            >
              {settings.enabled
                ? 'ACTIVÉ'
                : 'DÉSACTIVÉ'}
            </button>
          </div>

          {/* Type */}
          <label
            style={{
              display: 'grid',
              gap: 7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Type de bandeau

            <select
              className="select"
              value={settings.type}
              onChange={(e) =>
                setSettings(
                  (current) => ({
                    ...current,
                    type:
                      e.target.value ===
                      'urgent'
                        ? 'urgent'
                        : 'info',
                  })
                )
              }
            >
              <option value="info">
                ℹ️ Information
              </option>

              <option value="urgent">
                ⚠️ Urgent
              </option>
            </select>
          </label>

          {/* Message */}
          <label
            style={{
              display: 'grid',
              gap: 7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Message

            <textarea
              className="input"
              value={settings.message}
              onChange={(e) =>
                setSettings(
                  (current) => ({
                    ...current,
                    message:
                      e.target.value,
                  })
                )
              }
              rows={6}
              placeholder="Écris ici le message du bandeau..."
              style={{
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
          </label>

          {/* Emojis */}
          <div>
            <div
              className="btn-row"
              style={{
                marginBottom: 8,
              }}
            >
              <button
                className="btn"
                type="button"
                onClick={() =>
                  setShowSmileys(
                    (value) => !value
                  )
                }
              >
                😊 Smileys
              </button>

              <button
                className="btn"
                type="button"
                onClick={() =>
                  setShowSymbols(
                    (value) => !value
                  )
                }
              >
                ⭐ Symboles
              </button>
            </div>

            {showSmileys && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: 10,
                  border:
                    '1px solid var(--gipe-line)',
                  borderRadius: 10,
                  background:
                    '#fffdf9',
                  marginBottom: 8,
                }}
              >
                {smileys.map(
                  (item) => (
                    <button
                      key={item}
                      type="button"
                      className="btn"
                      onClick={() =>
                        insertText(
                          item
                        )
                      }
                      style={{
                        padding:
                          '6px 8px',
                        fontSize: 18,
                      }}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
            )}

            {showSymbols && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: 10,
                  border:
                    '1px solid var(--gipe-line)',
                  borderRadius: 10,
                  background:
                    '#fffdf9',
                }}
              >
                {symbols.map(
                  (item) => (
                    <button
                      key={item}
                      type="button"
                      className="btn"
                      onClick={() =>
                        insertText(
                          item
                        )
                      }
                      style={{
                        padding:
                          '6px 8px',
                        fontSize: 17,
                      }}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Aperçu */}
          <div
            style={{
              border:
                '1px solid var(--gipe-line)',
              borderRadius: 14,
              padding: 14,
              background:
                '#fffdf9',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Aperçu du bandeau
            </div>

            <div
              style={{
                borderRadius: 8,
                padding:
                  '10px 16px',
                background:
                  settings.type ===
                  'urgent'
                    ? '#dc3545'
                    : '#f4c542',
                color:
                  settings.type ===
                  'urgent'
                    ? '#fff'
                    : '#000',
                fontSize: 14,
                fontWeight: 600,
                minHeight: 20,
              }}
            >
              {settings.type ===
              'urgent'
                ? '⚠️ '
                : 'ℹ️ '}

              {settings.message
                .trim() ||
                'Votre message apparaîtra ici.'}
            </div>
          </div>

          {/* Boutons */}
          <div
            className="btn-row"
            style={{
              justifyContent:
                'flex-end',
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
        </div>
      </section>
    </>
  );
}
