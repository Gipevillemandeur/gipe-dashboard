'use client';

import { useEffect, useState } from 'react';

type AlertType = 'info' | 'urgent';

interface AlertSettings {
  enabled: boolean;
  message: string;
  type: AlertType;
}

const smileys = ['😊','😃','😄','😁','😂','🤣','😍','🥳','🤩','👍','👏','❤️','🙏'];
const symbols = ['⚠️','🚨','✅','❌','📢','📣','🔔','📅','📌','❗','⭐','💡','🎉','🎊','🎓','📚','🏫'];

export default function AlertePage() {
  const [settings, setSettings] = useState<AlertSettings>({ enabled: false, message: '', type: 'info' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSmileys, setShowSmileys] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);

  useEffect(() => {
    async function loadAlert() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/site/alerte', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Impossible de charger le bandeau d’alerte.');
        setSettings({ enabled: Boolean(data.enabled), message: data.message ?? '', type: data.type === 'urgent' ? 'urgent' : 'info' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossible de charger le bandeau d’alerte.');
      } finally {
        setLoading(false);
      }
    }
    void loadAlert();
  }, []);

  function insertText(value: string) {
    setSettings(current => ({ ...current, message: `${current.message}${value}` }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/site/alerte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Impossible d’enregistrer le bandeau.');
      setMessage('Bandeau d’alerte enregistré avec succès.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le bandeau.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="topbar">
        <div><div className="eyebrow">Site internet</div><h1>Bandeau d’alerte</h1><div className="kicker">Chargement…</div></div>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">Site internet</div><h1>Bandeau d’alerte</h1><div className="kicker">Gestion du message affiché sur le site public.</div></div>
      </div>

      {error && <div className="notice notice-error alerte-notice">{error}</div>}
      {message && <div className="notice alerte-success">{message}</div>}

      <section className="card section-card alerte-card">
        <div className="section-head alerte-head">
          <div>
            <h2 className="section-title">Configuration du bandeau</h2>
            <p className="section-sub">Activez le bandeau et définissez le message qui sera visible sur le site.</p>
          </div>
        </div>

        <div className="alerte-config-grid">
          <div className="alerte-toggle-row">
            <div className="alerte-toggle-text">
              <strong>Afficher le bandeau</strong>
              <div>Le bandeau sera visible sur le site public.</div>
            </div>
            <button
              className="btn alerte-toggle-button"
              type="button"
              onClick={() => setSettings(current => ({ ...current, enabled: !current.enabled }))}
              style={{
                minWidth: 110,
                fontWeight: 700,
                color: settings.enabled ? '#176b35' : '#777',
                borderColor: settings.enabled ? '#b7dfc6' : 'var(--gipe-line)',
                background: settings.enabled ? '#e9f7ef' : '#fff',
              }}
            >
              {settings.enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
            </button>
          </div>

          <label className="alerte-field">
            Type de bandeau
            <select className="select" value={settings.type} onChange={e => setSettings(current => ({ ...current, type: e.target.value === 'urgent' ? 'urgent' : 'info' }))}>
              <option value="info">ℹ️ Information</option>
              <option value="urgent">⚠️ Urgent</option>
            </select>
          </label>

          <label className="alerte-field">
            Message
            <textarea className="input alerte-message-input" value={settings.message} onChange={e => setSettings(current => ({ ...current, message: e.target.value }))} rows={6} placeholder="Écris ici le message du bandeau..." />
          </label>

          <div>
            <div className="btn-row alerte-emoji-actions">
              <button className="btn" type="button" onClick={() => setShowSmileys(value => !value)}>😊 Smileys</button>
              <button className="btn" type="button" onClick={() => setShowSymbols(value => !value)}>⭐ Symboles</button>
            </div>

            {showSmileys && (
              <div className="alerte-emoji-panel">
                {smileys.map(item => <button key={item} type="button" className="btn alerte-emoji-button" onClick={() => insertText(item)}>{item}</button>)}
              </div>
            )}

            {showSymbols && (
              <div className="alerte-emoji-panel">
                {symbols.map(item => <button key={item} type="button" className="btn alerte-emoji-button" onClick={() => insertText(item)}>{item}</button>)}
              </div>
            )}
          </div>

          <div className="alerte-preview">
            <div className="alerte-preview-title">Aperçu du bandeau</div>
            <div className={`alerte-preview-banner ${settings.type === 'urgent' ? 'urgent' : 'info'}`}>
              {settings.type === 'urgent' ? '⚠️ ' : 'ℹ️ '}{settings.message.trim() || 'Votre message apparaîtra ici.'}
            </div>
          </div>

          <div className="btn-row alerte-save-row">
            <button className="btn btn-primary" type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .alerte-card { min-width: 0; }
        .alerte-notice, .alerte-success { margin-bottom: 18px; }
        .alerte-success { background: #e9f7ef; border-color: #b7dfc6; color: #176b35; }
        .alerte-config-grid { display: grid; gap: 18px; min-width: 0; }
        .alerte-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px; border: 1px solid var(--gipe-line); border-radius: 12px; background: #fffdf9; }
        .alerte-toggle-text { min-width: 0; }
        .alerte-toggle-text > div { margin-top: 4px; font-size: 12px; color: var(--gipe-muted); }
        .alerte-field { display: grid; gap: 7px; font-size: 12px; font-weight: 700; min-width: 0; }
        .alerte-message-input { resize: vertical; line-height: 1.5; box-sizing: border-box; width: 100%; min-width: 0; }
        .alerte-emoji-actions { margin-bottom: 8px; }
        .alerte-emoji-panel { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px; border: 1px solid var(--gipe-line); border-radius: 10px; background: #fffdf9; margin-bottom: 8px; }
        .alerte-emoji-button { padding: 6px 8px; font-size: 18px; }
        .alerte-preview { border: 1px solid var(--gipe-line); border-radius: 14px; padding: 14px; background: #fffdf9; min-width: 0; }
        .alerte-preview-title { font-size: 12px; font-weight: 700; margin-bottom: 10px; }
        .alerte-preview-banner { border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; min-height: 20px; overflow-wrap: anywhere; }
        .alerte-preview-banner.info { background: #f4c542; color: #000; }
        .alerte-preview-banner.urgent { background: #dc3545; color: #fff; }
        .alerte-save-row { justify-content: flex-end; }

        @media (max-width: 700px) {
          .alerte-card { width: 100%; box-sizing: border-box; }
          .alerte-head { align-items: stretch !important; flex-direction: column !important; }
          .alerte-toggle-row { flex-direction: column; align-items: stretch; gap: 12px; }
          .alerte-toggle-button { width: 100%; justify-content: center; }
          .alerte-emoji-actions { width: 100%; flex-direction: row; }
          .alerte-emoji-actions .btn { flex: 1 1 0; justify-content: center; min-width: 0; }
          .alerte-emoji-panel { max-width: 100%; box-sizing: border-box; }
          .alerte-save-row { width: 100%; }
          .alerte-save-row .btn { width: 100%; justify-content: center; }
        }

        @media (max-width: 480px) {
          .alerte-card { padding: 16px !important; }
          .alerte-emoji-button { min-width: 42px; justify-content: center; }
          .alerte-preview { padding: 12px; }
          .alerte-preview-banner { padding: 10px 12px; }
        }
      `}</style>
    </>
  );
}
