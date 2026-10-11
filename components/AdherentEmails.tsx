'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RECEIPT_FIELDS,
  fillTemplate,
  receiptValues,
  type ReceiptTemplate,
} from '@/lib/email';
import {
  AlertTriangle,
  Pencil,
  RotateCcw,
  Save,
  CheckCircle2,
  History,
  Loader2,
  Mail,
  Receipt,
  Send,
  X,
} from 'lucide-react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type MemberLite = {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  councilParticipation: 'no' | 'child_class' | 'all_classes';
  boardMember: boolean;
  caMember: boolean;
  paymentReceived: boolean;
  amount: number | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  children: { classId?: string; className: string; firstName: string; lastName: string }[];
};

type ClassLite = { id: string; name: string };

type HistoryItem = {
  id: string;
  createdAt: string;
  createdBy: string | null;
  kind: 'receipt' | 'message';
  audience: string | null;
  subject: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
};

type EmailState = {
  ready: boolean;
  configured: boolean;
  quota: { limit: number; sentToday: number; remaining: number };
  receipts: Record<string, string>;
  history: HistoryItem[];
  receiptTemplate?: ReceiptTemplate & {
    customized: boolean;
    updatedAt?: string;
    updatedBy?: string | null;
  };
};

type AudienceType = 'all' | 'ca' | 'bureau' | 'volunteers' | 'class';

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Tous les adhérents',
  ca: 'Membres du CA',
  bureau: 'Membres du bureau',
  volunteers: 'Volontaires des conseils',
  class: 'Parents d’une classe',
  receipt: 'Reçus d’adhésion',
};

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function dateTimeFr(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function uniqueEmails(members: MemberLite[]) {
  return new Set(
    members
      .map((m) => m.email.trim().toLowerCase())
      .filter((email) => EMAIL_PATTERN.test(email))
  ).size;
}

export default function AdherentEmails({
  members,
  classes,
  schoolYear,
  onClose,
}: {
  members: MemberLite[];
  classes: ClassLite[];
  schoolYear: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'message' | 'receipts' | 'history'>('message');
  const [state, setState] = useState<EmailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Message
  const [audience, setAudience] = useState<AudienceType>('all');
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Reçus
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  async function load() {
    try {
      const response = await fetch('/api/adherents/emails', { cache: 'no-store' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.error || 'Chargement impossible.');
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const audienceMembers = useMemo(() => {
    switch (audience) {
      case 'ca':
        return members.filter((m) => m.caMember || m.boardMember);
      case 'bureau':
        return members.filter((m) => m.boardMember);
      case 'volunteers':
        return members.filter((m) => m.councilParticipation !== 'no');
      case 'class':
        return classId
          ? members.filter((m) => m.children.some((c) => c.classId === classId))
          : [];
      default:
        return members;
    }
  }, [members, audience, classId]);

  const audienceCount = uniqueEmails(audienceMembers);
  const withoutEmail = audienceMembers.filter(
    (m) => !EMAIL_PATTERN.test(m.email.trim())
  ).length;

  const receiptCandidates = useMemo(
    () =>
      members
        .filter((m) => m.paymentReceived && EMAIL_PATTERN.test(m.email.trim()))
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr')
        ),
    [members]
  );

  const paidWithoutEmail = members.filter(
    (m) => m.paymentReceived && !EMAIL_PATTERN.test(m.email.trim())
  ).length;

  const remaining = state?.quota.remaining ?? 0;
  const disabled = !state?.ready || !state?.configured || busy;

  function resultMessage(data: any, label: string) {
    const parts = [`${data.sent} ${label} envoyé${data.sent > 1 ? 's' : ''}`];
    if (data.pending > 0) {
      parts.push(
        `${data.pending} en attente (quota du jour atteint) : reprends l’envoi demain depuis l’onglet Historique`
      );
    }
    if (data.failed > 0 && data.firstError) {
      parts.push(`erreur : ${data.firstError}`);
    }
    return parts.join(' · ');
  }

  async function post(payload: object) {
    const response = await fetch('/api/adherents/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data?.error || 'Envoi impossible.');
    return data;
  }

  async function sendTest() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await post({ action: 'test', subject, body });
      setNotice(`Test envoyé à ${data.sentTo}. Vérifie ta boîte (et les indésirables).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await post({
        action: 'send',
        kind: 'message',
        audience: audience === 'class' ? { type: 'class', classId } : { type: audience },
        subject,
        body,
      });
      setNotice(resultMessage(data, 'message'));
      setConfirming(false);
      if (data.sent > 0 && data.pending === 0) {
        setSubject('');
        setBody('');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  async function sendReceipts() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await post({
        action: 'send',
        kind: 'receipt',
        membershipIds: [...selected],
      });
      setNotice(resultMessage(data, 'reçu'));
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function resume(messageId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await post({ action: 'resume', messageId });
      setNotice(resultMessage(data, 'e-mail'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const neverSent = receiptCandidates.filter((m) => !state?.receipts[m.id]);

  // Aperçu du reçu : premier adhérent coché (sinon le premier de la liste).
  const previewMember =
    receiptCandidates.find((m) => selected.has(m.id)) || receiptCandidates[0] || null;

  const previewValues = previewMember
    ? receiptValues({
        firstName: previewMember.firstName,
        lastName: previewMember.lastName,
        schoolYear: schoolYear || '',
        amount: previewMember.amount,
        paymentDate: previewMember.paymentDate,
        paymentMethod: previewMember.paymentMethod,
        children: previewMember.children,
      })
    : null;

  function startEditTemplate() {
    setTplSubject(state?.receiptTemplate?.subject || '');
    setTplBody(state?.receiptTemplate?.body || '');
    setConfirmReset(false);
    setEditingTemplate(true);
  }

  function insertField(key: string) {
    const token = `{${key}}`;
    const area = bodyRef.current;

    if (!area) {
      setTplBody((current) => current + token);
      return;
    }

    const start = area.selectionStart ?? tplBody.length;
    const end = area.selectionEnd ?? tplBody.length;
    const next = tplBody.slice(0, start) + token + tplBody.slice(end);
    setTplBody(next);

    requestAnimationFrame(() => {
      area.focus();
      area.selectionStart = area.selectionEnd = start + token.length;
    });
  }

  async function saveTemplate() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await post({ action: 'save-template', subject: tplSubject, body: tplBody });
      setNotice('Le texte du reçu a été enregistré. Il servira pour les prochains envois.');
      setEditingTemplate(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function resetTemplate() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await post({ action: 'reset-template' });
      setNotice('Le texte d’origine du reçu est rétabli.');
      setEditingTemplate(false);
      setConfirmReset(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opération impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="ae-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="card ae-modal" role="dialog" aria-modal="true" aria-labelledby="ae-title">
        <div className="ae-head">
          <div>
            <div className="eyebrow">Adhérents</div>
            <h2 id="ae-title" className="section-title">
              E-mails aux adhérents
            </h2>
          </div>

          <button type="button" className="btn ae-close" onClick={onClose} disabled={busy} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {state && (
          <div className="ae-quota">
            Aujourd’hui : <strong>{state.quota.sentToday}</strong> / {state.quota.limit} e-mails envoyés
            {' '}· il en reste <strong>{state.quota.remaining}</strong> (remise à zéro chaque nuit)
          </div>
        )}

        {loading && (
          <div className="ae-info">
            <Loader2 size={16} className="ae-spin" /> Chargement…
          </div>
        )}

        {state && !state.ready && (
          <div className="notice notice-error ae-notice">
            <AlertTriangle size={16} />
            <div>
              Les e-mails ne sont pas encore installés : lance{' '}
              <strong>migration_emails_v1.sql</strong> dans Supabase.
            </div>
          </div>
        )}

        {state && state.ready && !state.configured && (
          <div className="notice notice-error ae-notice">
            <AlertTriangle size={16} />
            <div>
              L’envoi d’e-mails n’est pas configuré : la clé <strong>RESEND_API_KEY</strong> est
              absente sur Vercel.
            </div>
          </div>
        )}

        {error && (
          <div className="notice notice-error ae-notice">
            <AlertTriangle size={16} />
            <div>{error}</div>
          </div>
        )}

        {notice && (
          <div className="notice ae-notice ae-success">
            <CheckCircle2 size={16} />
            <div>{notice}</div>
          </div>
        )}

        <div className="ae-tabs" role="tablist">
          <button type="button" className={tab === 'message' ? 'active' : ''} onClick={() => setTab('message')}>
            <Mail size={15} /> Message
          </button>
          <button type="button" className={tab === 'receipts' ? 'active' : ''} onClick={() => setTab('receipts')}>
            <Receipt size={15} /> Reçus
          </button>
          <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            <History size={15} /> Historique
          </button>
        </div>

        {tab === 'message' && (
          <div className="ae-body">
            <label className="ae-label">Destinataires</label>
            <div className="ae-audiences">
              {(['all', 'ca', 'bureau', 'volunteers', 'class'] as AudienceType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`ae-audience ${audience === type ? 'active' : ''}`}
                  onClick={() => {
                    setAudience(type);
                    setConfirming(false);
                  }}
                >
                  {AUDIENCE_LABELS[type]}
                </button>
              ))}
            </div>

            {audience === 'class' && (
              <select
                className="input ae-select"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setConfirming(false);
                }}
              >
                <option value="">Choisir une classe…</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            )}

            <div className="ae-count">
              <strong>{audienceCount}</strong> destinataire{audienceCount > 1 ? 's' : ''}
              {withoutEmail > 0 && ` · ${withoutEmail} sans adresse e-mail (ne recevront rien)`}
            </div>

            <label className="ae-label" htmlFor="ae-subject">Sujet</label>
            <input
              id="ae-subject"
              className="input"
              value={subject}
              maxLength={150}
              onChange={(e) => {
                setSubject(e.target.value);
                setConfirming(false);
              }}
              placeholder="Ex. Conseils de classe du 1er trimestre"
            />

            <label className="ae-label" htmlFor="ae-body">Message</label>
            <textarea
              id="ae-body"
              className="input ae-textarea"
              rows={9}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setConfirming(false);
              }}
              placeholder="Écris ton message ici…"
            />
            <p className="ae-help">
              « Bonjour Prénom, » est ajouté automatiquement au début, et l’en-tête du GIPE autour.
              Les réponses arrivent sur contact@gipevillemandeur.com. Chaque parent reçoit son
              propre e-mail : personne ne voit l’adresse des autres.
            </p>

            {audienceCount > remaining && audienceCount > 0 && (
              <div className="notice ae-notice">
                <AlertTriangle size={16} />
                <div>
                  Quota du jour : {remaining} e-mail{remaining > 1 ? 's' : ''} partiront aujourd’hui,
                  les {audienceCount - remaining} autres pourront être envoyés demain depuis
                  l’onglet Historique.
                </div>
              </div>
            )}

            <div className="ae-actions">
              <button
                type="button"
                className="btn"
                onClick={sendTest}
                disabled={disabled || !subject.trim() || !body.trim()}
              >
                M’envoyer un test
              </button>

              {!confirming ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setConfirming(true)}
                  disabled={disabled || !subject.trim() || !body.trim() || audienceCount === 0}
                >
                  <Send size={14} />
                  Envoyer à {audienceCount} destinataire{audienceCount > 1 ? 's' : ''}
                </button>
              ) : (
                <div className="ae-confirm">
                  <span>Confirmer l’envoi à {audienceCount} personne{audienceCount > 1 ? 's' : ''} ?</span>
                  <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>
                    Annuler
                  </button>
                  <button type="button" className="btn btn-primary" onClick={sendMessage} disabled={busy}>
                    {busy ? <Loader2 size={14} className="ae-spin" /> : <Send size={14} />}
                    Oui, envoyer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'receipts' && (
          <div className="ae-body">
            <div className="ae-template">
              <div className="ae-template-head">
                <div>
                  <strong>Texte du reçu</strong>
                  <span>
                    {state?.receiptTemplate?.customized
                      ? `Modifié${state.receiptTemplate.updatedBy ? ` par ${state.receiptTemplate.updatedBy}` : ''}${state.receiptTemplate.updatedAt ? ` le ${dateTimeFr(state.receiptTemplate.updatedAt)}` : ''}`
                      : 'Texte d’origine'}
                  </span>
                </div>
                {!editingTemplate && (
                  <button
                    type="button"
                    className="btn"
                    onClick={startEditTemplate}
                    disabled={!state?.ready || busy}
                  >
                    <Pencil size={14} />
                    Modifier le texte
                  </button>
                )}
              </div>

              {editingTemplate ? (
                <div className="ae-template-editor">
                  <label className="ae-label" htmlFor="ae-tpl-subject">Sujet</label>
                  <input
                    id="ae-tpl-subject"
                    className="input"
                    value={tplSubject}
                    maxLength={200}
                    onChange={(e) => setTplSubject(e.target.value)}
                  />

                  <label className="ae-label" htmlFor="ae-tpl-body">Texte</label>
                  <div className="ae-fields">
                    <span>Insérer :</span>
                    {RECEIPT_FIELDS.map((field) => (
                      <button
                        key={field.key}
                        type="button"
                        className="ae-field"
                        title={`Insère {${field.key}}`}
                        onClick={() => insertField(field.key)}
                      >
                        + {field.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="ae-tpl-body"
                    ref={bodyRef}
                    className="input ae-textarea"
                    rows={12}
                    value={tplBody}
                    onChange={(e) => setTplBody(e.target.value)}
                  />
                  <p className="ae-help">
                    Clique sur un bouton « + » pour insérer une information : elle apparaît entre
                    accolades, par exemple {'{prenom}'}, et sera remplacée pour chaque adhérent
                    (regarde l’aperçu en dessous). Ligne vide = nouveau paragraphe.
                  </p>

                  {previewValues && (
                    <div className="ae-preview">
                      <div className="ae-preview-label">
                        Aperçu pour {previewMember?.firstName} {previewMember?.lastName}
                      </div>
                      <div className="ae-preview-subject">
                        {fillTemplate(tplSubject, previewValues)}
                      </div>
                      <div className="ae-preview-body">{fillTemplate(tplBody, previewValues)}</div>
                    </div>
                  )}

                  <div className="ae-actions">
                    {state?.receiptTemplate?.customized && (
                      <button type="button" className="btn ae-reset" onClick={resetTemplate} disabled={busy}>
                        <RotateCcw size={14} />
                        {confirmReset ? 'Confirmer : texte d’origine' : 'Revenir au texte d’origine'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditingTemplate(false)}
                      disabled={busy}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={saveTemplate}
                      disabled={busy || !tplSubject.trim() || !tplBody.trim()}
                    >
                      <Save size={14} />
                      Enregistrer le texte
                    </button>
                  </div>
                </div>
              ) : (
                previewValues &&
                state?.receiptTemplate && (
                  <details className="ae-preview-toggle">
                    <summary>Voir le reçu tel qu’il sera envoyé</summary>
                    <div className="ae-preview">
                      <div className="ae-preview-label">
                        Exemple pour {previewMember?.firstName} {previewMember?.lastName}
                      </div>
                      <div className="ae-preview-subject">
                        {fillTemplate(state.receiptTemplate.subject, previewValues)}
                      </div>
                      <div className="ae-preview-body">
                        {fillTemplate(state.receiptTemplate.body, previewValues)}
                      </div>
                    </div>
                  </details>
                )
              )}
            </div>

            <p className="ae-help">
              Le reçu remercie l’adhérent et rappelle le montant, la date de paiement et ses enfants.
              Coche les adhérents à qui l’envoyer : rien ne part sans ton clic.
              {paidWithoutEmail > 0 &&
                ` ${paidWithoutEmail} adhérent${paidWithoutEmail > 1 ? 's' : ''} sans adresse e-mail n’apparai${paidWithoutEmail > 1 ? 'ssent' : 't'} pas ici.`}
            </p>

            <div className="ae-actions ae-actions-left">
              <button
                type="button"
                className="btn"
                onClick={() => setSelected(new Set(neverSent.map((m) => m.id)))}
                disabled={neverSent.length === 0}
              >
                Cocher les « jamais envoyé » ({neverSent.length})
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
              >
                Tout décocher
              </button>
            </div>

            <div className="ae-list">
              {receiptCandidates.length === 0 ? (
                <p className="kicker">Aucun adhérent payé avec une adresse e-mail.</p>
              ) : (
                receiptCandidates.map((m) => {
                  const sentAt = state?.receipts[m.id];
                  return (
                    <label key={m.id} className={`ae-row ${selected.has(m.id) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggle(m.id)}
                      />
                      <span className="ae-row-name">
                        {m.lastName} {m.firstName}
                        <small>{m.email}</small>
                      </span>
                      <span className={`badge ${sentAt ? 'badge-ok' : 'badge-warn'}`}>
                        {sentAt ? `Reçu envoyé le ${dateTimeFr(sentAt)}` : 'Jamais envoyé'}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="ae-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={sendReceipts}
                disabled={disabled || selected.size === 0}
              >
                {busy ? <Loader2 size={14} className="ae-spin" /> : <Send size={14} />}
                Envoyer {selected.size} reçu{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="ae-body">
            {!state || state.history.length === 0 ? (
              <p className="kicker">Aucun envoi pour le moment cette année.</p>
            ) : (
              <div className="ae-list">
                {state.history.map((item) => (
                  <div key={item.id} className="ae-history">
                    <div className="ae-history-main">
                      <strong>{item.subject}</strong>
                      <span>
                        {dateTimeFr(item.createdAt)} · {AUDIENCE_LABELS[item.audience || ''] || item.audience}
                        {item.createdBy ? ` · par ${item.createdBy}` : ''}
                      </span>
                    </div>
                    <div className="ae-history-side">
                      <span className={`badge ${item.pending === 0 ? 'badge-ok' : 'badge-warn'}`}>
                        {item.sent} / {item.total} envoyé{item.sent > 1 ? 's' : ''}
                      </span>
                      {item.pending > 0 && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => resume(item.id)}
                          disabled={disabled || remaining === 0}
                        >
                          Reprendre l’envoi ({item.pending})
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .ae-backdrop {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(36, 28, 27, 0.42);
        }

        .ae-modal {
          width: min(760px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          padding: 22px;
          box-sizing: border-box;
        }

        .ae-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 10px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .ae-quota {
          margin-bottom: 12px;
          padding: 8px 12px;
          border-radius: 10px;
          background: #fff7ee;
          border: 1px solid #eadfd5;
          color: #5f514b;
          font-size: 13px;
        }

        .ae-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #756a67;
          font-size: 13px;
        }

        .ae-notice {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .ae-success {
          border-color: #cfe5d7;
          background: #f2f8f4;
          color: #23492f;
        }

        .ae-tabs {
          display: flex;
          gap: 6px;
          margin: 4px 0 14px;
          border-bottom: 1px solid #eadfd5;
        }

        .ae-tabs button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 12px;
          border: 0;
          border-bottom: 2px solid transparent;
          background: transparent;
          color: #756a67;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .ae-tabs button.active {
          color: #8f211c;
          border-bottom-color: #8f211c;
        }

        .ae-body {
          display: grid;
          gap: 10px;
        }

        .ae-label {
          margin-top: 4px;
          color: #5f514b;
          font-size: 12px;
          font-weight: 800;
        }

        .ae-audiences {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ae-audience {
          padding: 8px 12px;
          border: 1px solid #eadfd5;
          border-radius: 999px;
          background: #fff;
          color: #5f514b;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .ae-audience.active {
          border-color: #8f211c;
          background: #fff1f0;
          color: #8f211c;
        }

        .ae-select {
          max-width: 260px;
        }

        .ae-count {
          color: #5f514b;
          font-size: 13px;
        }

        .ae-textarea {
          min-height: 180px;
          resize: vertical;
          font: inherit;
          line-height: 1.5;
        }

        .ae-help {
          margin: 0;
          color: #756a67;
          font-size: 12.5px;
          line-height: 1.55;
        }

        .ae-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
        }

        .ae-actions-left {
          justify-content: flex-start;
          margin-top: 0;
        }

        .ae-confirm {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid #efcac6;
          border-radius: 10px;
          background: #fff5f3;
          color: #8f211c;
          font-size: 13px;
          font-weight: 700;
        }

        .ae-template {
          display: grid;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid #eadfd5;
          border-radius: 12px;
          background: #fffdf9;
        }

        .ae-template-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .ae-template-head div {
          display: flex;
          flex-direction: column;
        }

        .ae-template-head strong {
          color: #241c1b;
          font-size: 14px;
        }

        .ae-template-head span {
          color: #756a67;
          font-size: 12px;
        }

        .ae-template-editor {
          display: grid;
          gap: 8px;
        }

        .ae-fields {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          color: #756a67;
          font-size: 12px;
        }

        .ae-field {
          padding: 3px 8px;
          border: 1px solid #e3d4c6;
          border-radius: 6px;
          background: #f6eee6;
          color: #5f514b;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .ae-field:hover {
          border-color: #8f211c;
          color: #8f211c;
        }

        .ae-preview-toggle summary {
          color: #8f211c;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .ae-preview {
          margin-top: 6px;
          padding: 12px 14px;
          border: 1px dashed #e3d4c6;
          border-radius: 10px;
          background: #fff;
        }

        .ae-preview-label {
          color: #756a67;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ae-preview-subject {
          margin: 6px 0 8px;
          color: #241c1b;
          font-weight: 800;
          font-size: 14px;
        }

        .ae-preview-body {
          color: #3a2f2c;
          font-size: 13.5px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .ae-reset {
          margin-right: auto;
          color: #8f211c;
        }

        .ae-list {
          display: grid;
          gap: 6px;
          max-height: 46vh;
          overflow-y: auto;
        }

        .ae-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border: 1px solid #eadfd5;
          border-radius: 10px;
          background: #fff;
          cursor: pointer;
        }

        .ae-row.checked {
          border-color: #d9a39d;
          background: #fff8f7;
        }

        .ae-row-name {
          display: flex;
          flex-direction: column;
          min-width: 0;
          color: #241c1b;
          font-size: 13px;
          font-weight: 700;
        }

        .ae-row-name small {
          color: #756a67;
          font-weight: 500;
          overflow-wrap: anywhere;
        }

        .ae-history {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border: 1px solid #eadfd5;
          border-radius: 10px;
          background: #fff;
        }

        .ae-history-main {
          display: flex;
          flex-direction: column;
          min-width: 0;
          font-size: 13px;
        }

        .ae-history-main span {
          color: #756a67;
          font-size: 12px;
        }

        .ae-history-side {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
        }

        :global(.ae-spin) {
          animation: ae-spin 1s linear infinite;
        }

        @keyframes ae-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 700px) {
          .ae-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .ae-modal {
            max-height: 94vh;
            border-radius: 18px 18px 0 0;
            padding: 18px;
          }

          .ae-row {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .ae-row :global(.badge) {
            grid-column: 2;
            justify-self: start;
          }

          .ae-history {
            flex-direction: column;
            align-items: flex-start;
          }

          .ae-history-side {
            justify-content: flex-start;
          }

          .ae-actions .btn,
          .ae-confirm {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
