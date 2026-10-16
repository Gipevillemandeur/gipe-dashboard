'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  Check,
  Clock3,
  ExternalLink,
  Heart,
  ImagePlus,
  Link2,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';

import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import { compressImage } from '@/lib/compress-image';
import { takeFacebookDraft } from '@/lib/facebook-draft';
import { useCanEdit } from '@/lib/use-access';

type Status = {
  configured: boolean;
  connected: boolean;
  pageName: string | null;
  pageUrl: string | null;
  facebookUser: string | null;
  updatedAt: string | null;
  canManage: boolean;
  pendingPages: { id: string; name: string }[];
};

type Post = {
  id: string;
  message: string;
  createdAt: string | null;
  scheduledAt: string | null;
  url: string | null;
  picture: string | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
};

const MAX_LENGTH = 5000;

const CALLBACK_MESSAGES: Record<string, { ok?: boolean; text: string }> = {
  connected: { ok: true, text: 'La Page Facebook est reliée au dashboard.' },
  choose: { ok: true, text: 'Tu gères plusieurs Pages : choisis celle du GIPE ci-dessous.' },
  cancelled: { text: 'Connexion à Facebook annulée.' },
  invalid_state: { text: 'La connexion a pris trop de temps ou a été interrompue. Recommence.' },
  forbidden: { text: 'Seul le Président peut relier la Page Facebook.' },
  config_error: { text: 'Les codes de l’application Facebook ne sont pas encore dans Vercel (FACEBOOK_APP_ID et FACEBOOK_APP_SECRET).' },
  token_error: { text: 'Facebook a refusé la connexion. Vérifie l’adresse de retour déclarée dans l’application Meta, puis recommence.' },
  no_page: { text: 'Aucune Page trouvée : pendant la connexion, coche bien la Page du GIPE et accepte toutes les autorisations.' },
  save_error: { text: 'Impossible d’enregistrer la connexion : lance d’abord migration_facebook_v1.sql dans Supabase.' },
  error: { text: 'La connexion à Facebook a échoué. Recommence dans un moment.' },
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultSchedule() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { date: localDate(tomorrow), time: '18:00' };
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${time.replace(':', 'h').replace(/^0(\d)/, '$1')}`;
}

function shortText(value: string, max = 220) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Une erreur est survenue.');
  return data;
}

export default function FacebookPage() {
  const { canEdit, readOnly } = useCanEdit('facebook');

  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState('');
  const [scheduled, setScheduled] = useState<Post[]>([]);
  const [published, setPublished] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');

  const [notice, setNotice] = useState<{ ok?: boolean; text: string } | null>(null);

  // Rédaction
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [mode, setMode] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState(defaultSchedule().date);
  const [scheduleTime, setScheduleTime] = useState(defaultSchedule().time);
  const [draftSource, setDraftSource] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');

  const [toCancel, setToCancel] = useState<Post | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [busy, setBusy] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  async function loadStatus() {
    try {
      const data = await readJson(await fetch('/api/facebook/connection', { cache: 'no-store' }));
      setStatus(data);
      setStatusError('');
      return data as Status;
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Impossible de lire la connexion Facebook.');
      return null;
    }
  }

  async function loadPosts() {
    setPostsLoading(true);
    try {
      const data = await readJson(await fetch('/api/facebook/posts', { cache: 'no-store' }));
      setScheduled(data.scheduled || []);
      setPublished(data.published || []);
      setPostsError('');
    } catch (error) {
      setPostsError(error instanceof Error ? error.message : 'Impossible de lire les publications.');
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => {
    // Message au retour de Facebook (?facebook=…)
    const params = new URLSearchParams(window.location.search);
    const result = params.get('facebook');
    if (result && CALLBACK_MESSAGES[result]) {
      setNotice(CALLBACK_MESSAGES[result]);
      window.history.replaceState(null, '', '/facebook');
    }

    // Brouillon préparé ailleurs (Agenda…)
    const draft = takeFacebookDraft();
    if (draft) {
      setMessage(draft.message.slice(0, MAX_LENGTH));
      setImageUrl(draft.imageUrl || null);
      setDraftSource(draft.source || null);
    }

    void loadStatus().then((data) => {
      if (data?.connected) void loadPosts();
    });
  }, []);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFormError('');
    setPreparingPhoto(true);
    try {
      const ready = await compressImage(file);
      if (ready.size > 4 * 1024 * 1024) {
        throw new Error('Cette photo reste trop lourde, même réduite. Essaie une autre photo.');
      }
      setPhoto(ready);
      setImageUrl(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Impossible de préparer la photo.');
    } finally {
      setPreparingPhoto(false);
    }
  }

  function removePhoto() {
    setPhoto(null);
    setImageUrl(null);
  }

  function resetComposer() {
    setMessage('');
    setPhoto(null);
    setImageUrl(null);
    setMode('now');
    const next = defaultSchedule();
    setScheduleDate(next.date);
    setScheduleTime(next.time);
    setDraftSource(null);
    setFormError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;

    setFormError('');
    setNotice(null);

    if (!message.trim() && !photo && !imageUrl) {
      setFormError('Écris un texte ou ajoute une photo.');
      return;
    }

    let scheduledAt = '';
    if (mode === 'later') {
      const when = new Date(`${scheduleDate}T${scheduleTime || '00:00'}`);
      if (Number.isNaN(when.getTime())) {
        setFormError('Choisis la date et l’heure de publication.');
        return;
      }
      if (when.getTime() < Date.now() + 10 * 60 * 1000) {
        setFormError('Programme la publication au moins 10 minutes après maintenant.');
        return;
      }
      scheduledAt = when.toISOString();
    }

    const form = new FormData();
    form.set('message', message.trim());
    if (photo) form.set('imageFile', photo, photo.name);
    else if (imageUrl) form.set('imageUrl', imageUrl);
    if (scheduledAt) form.set('scheduledAt', scheduledAt);
    if (draftSource) form.set('source', draftSource);

    setSending(true);
    try {
      await readJson(await fetch('/api/facebook/posts', { method: 'POST', body: form }));
      setNotice({
        ok: true,
        text: scheduledAt
          ? `Publication programmée pour le ${formatDateTime(scheduledAt).toLowerCase()}.`
          : 'C’est publié sur la Page Facebook.',
      });
      resetComposer();
      void loadPosts();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Impossible de publier.');
    } finally {
      setSending(false);
    }
  }

  async function cancelScheduled() {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await readJson(
        await fetch(`/api/facebook/posts?id=${encodeURIComponent(toCancel.id)}`, { method: 'DELETE' })
      );
      setNotice({ ok: true, text: 'La publication programmée a été annulée.' });
      setToCancel(null);
      void loadPosts();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Impossible d’annuler.' });
      setToCancel(null);
    } finally {
      setCancelling(false);
    }
  }

  async function connectionAction(body: Record<string, string>) {
    setBusy(true);
    try {
      await readJson(
        await fetch('/api/facebook/connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );
      const data = await loadStatus();
      if (body.action === 'disconnect') {
        setNotice({ ok: true, text: 'La Page Facebook n’est plus reliée au dashboard.' });
        setScheduled([]);
        setPublished([]);
      } else {
        setNotice({ ok: true, text: `La Page « ${data?.pageName || ''} » est reliée au dashboard.` });
        void loadPosts();
      }
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Action impossible.' });
    } finally {
      setBusy(false);
      setConfirmUnlink(false);
    }
  }

  const connected = Boolean(status?.connected);
  const showConnectionCard = Boolean(status && (status.canManage || !connected));
  const previewSrc = photoPreview || imageUrl;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Facebook</div>
          <h1>Page Facebook</h1>
          <div className="kicker">
            {connected && status?.pageName ? (
              <>
                Publications de la Page{' '}
                <a className="fb-page-link" href={status.pageUrl || '#'} target="_blank" rel="noopener noreferrer">
                  {status.pageName}
                  <ExternalLink size={12} />
                </a>
              </>
            ) : (
              'Publier, programmer et suivre les publications de la Page du GIPE.'
            )}
          </div>
        </div>

        {readOnly && (
          <div className="topbar-right">
            <ReadOnlyBadge />
          </div>
        )}
      </div>

      {notice && (
        <div className={`notice ${notice.ok ? 'fb-notice-ok' : 'notice-error'}`} style={{ marginBottom: 18 }}>
          {notice.ok ? <Check size={16} /> : null}
          <div>{notice.text}</div>
          <button type="button" className="fb-notice-close" onClick={() => setNotice(null)} aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
      )}

      {statusError && (
        <div className="notice notice-error" style={{ marginBottom: 18 }}>
          {statusError}
        </div>
      )}

      {!status && !statusError && (
        <section className="card section-card">
          <p className="kicker">Chargement…</p>
        </section>
      )}

      {/* ------------------------- Connexion ------------------------- */}
      {showConnectionCard && status && (
        <section className="card section-card fb-connection">
          <div className="fb-connection-main">
            <div className={`fb-connection-dot ${connected ? 'is-on' : ''}`} />
            <div>
              <strong>
                {connected ? `Page reliée : ${status.pageName}` : 'Aucune Page Facebook reliée'}
              </strong>
              <span>
                {!status.configured
                  ? 'Les codes de l’application Facebook doivent d’abord être ajoutés dans Vercel.'
                  : connected
                    ? `Connectée par ${status.facebookUser || 'le Président'}${
                        status.updatedAt ? ` le ${new Date(status.updatedAt).toLocaleDateString('fr-FR')}` : ''
                      }.`
                    : status.canManage
                      ? 'Clique sur « Connecter Facebook » et connecte-toi avec ton compte administrateur de la Page.'
                      : 'Le Président doit relier la Page du GIPE.'}
              </span>
            </div>
          </div>

          {status.canManage && status.configured && (
            <div className="fb-connection-actions">
              <a className="btn btn-primary" href="/api/facebook/connect">
                <Link2 size={14} />
                {connected ? 'Reconnecter Facebook' : 'Connecter Facebook'}
              </a>
              {connected && (
                <button type="button" className="btn" onClick={() => setConfirmUnlink(true)} disabled={busy}>
                  <Unlink size={14} />
                  Délier
                </button>
              )}
            </div>
          )}

          {status.canManage && status.pendingPages.length > 0 && (
            <div className="fb-choose">
              <strong>Quelle Page veux-tu relier ?</strong>
              <div className="fb-choose-list">
                {status.pendingPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => connectionAction({ action: 'choose', pageId: page.id })}
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ------------------------- Rédaction ------------------------- */}
      {connected && canEdit && (
        <section className="card section-card fb-composer">
          <div className="section-head">
            <div>
              <h2 className="section-title">Nouvelle publication</h2>
              <p className="section-sub">
                {draftSource
                  ? `Texte préparé depuis ${draftSource} : relis-le et modifie-le si besoin.`
                  : 'Un texte et, si tu veux, une photo.'}
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="fb-form">
            <div className="fb-write">
              <textarea
                ref={composer}
                className="input fb-textarea"
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, MAX_LENGTH))}
                placeholder="Écris ta publication…"
                rows={8}
              />
              <div className="fb-counter">
                {message.length} / {MAX_LENGTH}
              </div>
            </div>

            <div className="fb-side">
              <div className="fb-photo">
                {previewSrc ? (
                  <div className="fb-photo-preview">
                    <img src={previewSrc} alt="Photo de la publication" />
                    <button type="button" className="fb-photo-remove" onClick={removePhoto} aria-label="Retirer la photo">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="fb-photo-add"
                    onClick={() => fileInput.current?.click()}
                    disabled={preparingPhoto}
                  >
                    {preparingPhoto ? <Loader2 size={20} className="fb-spin" /> : <ImagePlus size={20} />}
                    <span>{preparingPhoto ? 'Préparation…' : 'Ajouter une photo'}</span>
                  </button>
                )}
                <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
              </div>

              <div className="fb-when" role="radiogroup" aria-label="Quand publier ?">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'now'}
                  className={`fb-when-option ${mode === 'now' ? 'is-active' : ''}`}
                  onClick={() => setMode('now')}
                >
                  <Send size={14} />
                  Maintenant
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'later'}
                  className={`fb-when-option ${mode === 'later' ? 'is-active' : ''}`}
                  onClick={() => setMode('later')}
                >
                  <CalendarClock size={14} />
                  Programmer
                </button>
              </div>

              {mode === 'later' && (
                <div className="fb-schedule">
                  <label>
                    Le
                    <input
                      type="date"
                      className="input"
                      value={scheduleDate}
                      min={localDate(new Date())}
                      onChange={(event) => setScheduleDate(event.target.value)}
                    />
                  </label>
                  <label>
                    à
                    <input
                      type="time"
                      className="input"
                      value={scheduleTime}
                      onChange={(event) => setScheduleTime(event.target.value)}
                    />
                  </label>
                </div>
              )}

              {formError && <div className="fb-form-error">{formError}</div>}

              <div className="fb-submit">
                {(message || previewSrc) && (
                  <button type="button" className="btn" onClick={resetComposer} disabled={sending}>
                    Effacer
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={sending || preparingPhoto}>
                  {sending ? (
                    <Loader2 size={14} className="fb-spin" />
                  ) : mode === 'later' ? (
                    <CalendarClock size={14} />
                  ) : (
                    <Send size={14} />
                  )}
                  {sending ? 'Envoi…' : mode === 'later' ? 'Programmer' : 'Publier sur Facebook'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* ------------------------- Listes ------------------------- */}
      {connected && (
        <>
          {postsError && (
            <div className="notice notice-error" style={{ marginBottom: 18 }}>
              {postsError}
            </div>
          )}

          <section className="card section-card fb-list-card">
            <div className="section-head">
              <div>
                <h2 className="section-title fb-title-icon">
                  <Clock3 size={17} />
                  Programmées
                </h2>
                <p className="section-sub">Publications qui partiront automatiquement.</p>
              </div>
            </div>

            {postsLoading && scheduled.length === 0 ? (
              <p className="kicker">Chargement…</p>
            ) : scheduled.length === 0 ? (
              <p className="kicker">Aucune publication programmée.</p>
            ) : (
              <div className="fb-scheduled">
                {scheduled.map((post) => (
                  <div className="fb-scheduled-row" key={post.id}>
                    {post.picture ? (
                      <img className="fb-thumb" src={post.picture} alt="" />
                    ) : (
                      <div className="fb-thumb fb-thumb-empty">
                        <Clock3 size={16} />
                      </div>
                    )}
                    <div className="fb-scheduled-main">
                      <strong>{formatDateTime(post.scheduledAt)}</strong>
                      <span>{shortText(post.message || '(photo seule)', 160)}</span>
                    </div>
                    {canEdit && (
                      <button type="button" className="btn fb-cancel" onClick={() => setToCancel(post)}>
                        <Trash2 size={14} />
                        Annuler
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card section-card fb-list-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Dernières publications</h2>
                <p className="section-sub">Les 10 dernières publications de la Page.</p>
              </div>
            </div>

            {postsLoading && published.length === 0 ? (
              <p className="kicker">Chargement…</p>
            ) : published.length === 0 ? (
              <p className="kicker">Aucune publication pour le moment.</p>
            ) : (
              <div className="fb-published">
                {published.map((post) => (
                  <article className="fb-post" key={post.id}>
                    {post.picture && <img className="fb-post-image" src={post.picture} alt="" />}
                    <div className="fb-post-body">
                      <div className="fb-post-date">{formatDateTime(post.createdAt)}</div>
                      <p>{shortText(post.message || '(photo seule)')}</p>
                    </div>
                    <div className="fb-post-foot">
                      <span title="Réactions">
                        <Heart size={13} /> {post.reactions ?? '–'}
                      </span>
                      <span title="Commentaires">
                        <MessageCircle size={13} /> {post.comments ?? '–'}
                      </span>
                      <span title="Partages">
                        <Share2 size={13} /> {post.shares ?? 0}
                      </span>
                      {post.url && (
                        <a href={post.url} target="_blank" rel="noopener noreferrer">
                          Voir sur Facebook
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ------------------------- Confirmations ------------------------- */}
      {toCancel && (
        <div className="fb-backdrop" role="dialog" aria-modal="true">
          <div className="card fb-dialog">
            <h2>Annuler cette publication ?</h2>
            <p>
              Prévue le <strong>{formatDateTime(toCancel.scheduledAt).toLowerCase()}</strong>.
              <br />
              Elle sera supprimée et ne partira pas sur Facebook.
            </p>
            <div className="fb-dialog-actions">
              <button type="button" className="btn" onClick={() => setToCancel(null)} disabled={cancelling}>
                Garder
              </button>
              <button type="button" className="btn btn-primary" onClick={cancelScheduled} disabled={cancelling}>
                {cancelling ? 'Annulation…' : 'Oui, annuler'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmUnlink && (
        <div className="fb-backdrop" role="dialog" aria-modal="true">
          <div className="card fb-dialog">
            <h2>Délier la Page Facebook ?</h2>
            <p>
              Le dashboard ne pourra plus publier sur la Page. Rien n’est supprimé sur Facebook :
              les publications (et celles programmées) restent en place.
            </p>
            <div className="fb-dialog-actions">
              <button type="button" className="btn" onClick={() => setConfirmUnlink(false)} disabled={busy}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => connectionAction({ action: 'disconnect' })}
                disabled={busy}
              >
                Délier
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .fb-connection-actions .btn,
        .fb-submit .btn,
        .fb-cancel,
        .fb-dialog-actions .btn,
        .fb-choose-list .btn {
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center;
          gap: 7px !important;
          white-space: nowrap;
        }
        .fb-title-icon {
          display: flex !important;
          flex-direction: row !important;
          align-items: center;
          gap: 8px;
        }
        .fb-page-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #8f211c;
          font-weight: 700;
          text-decoration: none;
        }
        .fb-notice-ok {
          background: #e9f7ef;
          border-color: #b7dfc6;
          color: #176b35;
        }
        .fb-notice-close {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          padding: 2px;
          display: inline-flex;
        }
        .fb-connection {
          margin-bottom: 18px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 14px 20px;
        }
        .fb-connection-main {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          flex: 1 1 320px;
          min-width: 0;
        }
        .fb-connection-main > div:last-child {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .fb-connection-main strong {
          font-size: 15px;
        }
        .fb-connection-main span {
          font-size: 13px;
          color: #756a67;
        }
        .fb-connection-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #d6c8bd;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .fb-connection-dot.is-on {
          background: #22a35a;
          box-shadow: 0 0 0 4px #e3f5ea;
        }
        .fb-connection-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .fb-connection-actions .btn {
          text-decoration: none;
        }
        .fb-choose {
          flex-basis: 100%;
          border-top: 1px solid #eee2d7;
          padding-top: 14px;
          display: grid;
          gap: 10px;
        }
        .fb-choose-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .fb-composer {
          margin-bottom: 18px;
        }
        .fb-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: 18px;
          margin-top: 14px;
        }
        .fb-write {
          display: grid;
          gap: 6px;
          min-width: 0;
        }
        .fb-textarea {
          width: 100%;
          min-height: 230px;
          resize: vertical;
          line-height: 1.5;
          font-size: 14px;
        }
        .fb-counter {
          justify-self: end;
          font-size: 11px;
          color: #8a7c76;
        }
        .fb-side {
          display: grid;
          gap: 12px;
          align-content: start;
          min-width: 0;
        }
        .fb-photo-add {
          width: 100%;
          height: 130px;
          border: 1.5px dashed #d9c9bb;
          border-radius: 12px;
          background: #fffdf9;
          color: #8f211c;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .fb-photo-add:hover {
          background: #fff4f2;
        }
        .fb-photo-preview {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #eadfd5;
          background: #f6f1eb;
        }
        .fb-photo-preview img {
          display: block;
          width: 100%;
          max-height: 220px;
          object-fit: cover;
        }
        .fb-photo-remove {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 0;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .fb-when {
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 3px;
          border-radius: 10px;
          background: #f3ede6;
          gap: 3px;
        }
        .fb-when-option {
          border: 0;
          background: transparent;
          border-radius: 8px;
          padding: 8px 6px;
          font-size: 12.5px;
          font-weight: 700;
          color: #8a7c76;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
        }
        .fb-when-option.is-active {
          background: #fff;
          color: #8f211c;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
        }
        .fb-schedule {
          display: grid;
          grid-template-columns: 1fr 110px;
          gap: 8px;
        }
        .fb-schedule label {
          display: grid;
          gap: 4px;
          font-size: 12px;
          font-weight: 700;
          color: #6b5d57;
        }
        .fb-schedule .input {
          width: 100%;
          min-width: 0;
        }
        .fb-form-error {
          font-size: 13px;
          color: #b91c1c;
          background: #fdecec;
          border: 1px solid #f3c6c6;
          border-radius: 9px;
          padding: 9px 11px;
        }
        .fb-submit {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .fb-submit .btn-primary {
          flex: 1 1 auto;
          justify-content: center;
        }
        .fb-list-card {
          margin-bottom: 18px;
        }
        .fb-scheduled {
          display: grid;
          gap: 8px;
          margin-top: 12px;
        }
        .fb-scheduled-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border: 1px solid #eadfd5;
          border-radius: 11px;
          background: #fffdf9;
          min-width: 0;
        }
        .fb-thumb {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .fb-thumb-empty {
          background: #f3ede6;
          color: #a08f88;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fb-scheduled-main {
          display: grid;
          gap: 3px;
          min-width: 0;
          flex: 1;
        }
        .fb-scheduled-main strong {
          font-size: 13px;
          color: #8f211c;
        }
        .fb-scheduled-main span {
          font-size: 13px;
          color: #4b403d;
          overflow-wrap: anywhere;
          white-space: pre-line;
        }
        .fb-cancel {
          flex-shrink: 0;
          color: #b91c1c;
        }
        .fb-published {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 14px;
          margin-top: 12px;
        }
        .fb-post {
          display: flex;
          flex-direction: column;
          border: 1px solid #eadfd5;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          min-width: 0;
        }
        .fb-post-image {
          width: 100%;
          height: 150px;
          object-fit: cover;
          display: block;
          background: #f6f1eb;
        }
        .fb-post-body {
          padding: 12px 12px 4px;
          flex: 1;
        }
        .fb-post-date {
          font-size: 11px;
          font-weight: 700;
          color: #8a7c76;
          margin-bottom: 6px;
        }
        .fb-post-body p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          white-space: pre-line;
          overflow-wrap: anywhere;
        }
        .fb-post-foot {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          padding: 10px 12px 12px;
          font-size: 12px;
          color: #6b5d57;
        }
        .fb-post-foot span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .fb-post-foot a {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #8f211c;
          font-weight: 700;
          text-decoration: none;
        }
        .fb-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(36, 28, 27, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 60;
        }
        .fb-dialog {
          width: min(440px, 100%);
          padding: 22px;
        }
        .fb-dialog h2 {
          margin: 0 0 10px;
          font-size: 18px;
        }
        .fb-dialog p {
          margin: 0 0 18px;
          font-size: 14px;
          line-height: 1.5;
          color: #4b403d;
        }
        .fb-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .fb-spin {
          animation: fb-spin 1s linear infinite;
        }
        @keyframes fb-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 860px) {
          .fb-form {
            grid-template-columns: minmax(0, 1fr);
          }
          .fb-textarea {
            min-height: 170px;
          }
        }
        @media (max-width: 520px) {
          .fb-scheduled-row {
            flex-wrap: wrap;
          }
          .fb-cancel {
            margin-left: auto;
          }
        }
      `}</style>
    </>
  );
}
