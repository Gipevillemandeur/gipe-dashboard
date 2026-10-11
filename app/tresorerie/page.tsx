'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Banknote,
  Building2,
  CreditCard,
  FileCheck2,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';

type Account = 'bank' | 'cash';
type TxType = 'income' | 'expense' | 'transfer';
type View = 'all' | Account;

type Transaction = {
  id: string;
  date: string;
  type: TxType;
  category: string;
  label: string;
  amount: number;
  paymentMethod: string | null;
  note: string | null;
  account: Account;
  transferTo: Account | null;
  createdAt?: string;
  // recette créée automatiquement par une adhésion
  fromMembership?: boolean;
  receipt: { fileId: string; name: string; url: string | null } | null;
};

type FormState = {
  date: string;
  // '' = pas encore choisi : oblige à choisir le type
  type: '' | TxType;
  category: string;
  label: string;
  amount: string;
  paymentMethod: string;
  // '' = pas encore choisi
  account: '' | Account;
  direction: 'cash_to_bank' | 'bank_to_cash';
  note: string;
};

const incomeCategories = ['Adhésions', 'Subvention', 'Don', 'Vente', 'Autre recette'];

const expenseCategories = [
  'Fournitures',
  'Événement',
  'Communication',
  'Frais bancaires',
  'Assurance',
  'Autre dépense',
];

const paymentMethods = [
  { value: 'cheque', label: 'Chèque' },
  { value: 'cash', label: 'Espèces' },
  { value: 'transfer', label: 'Virement' },
  { value: 'online', label: 'Paiement en ligne' },
  { value: 'other', label: 'Autre' },
];

const ACCOUNT_NAMES: Record<Account, string> = { bank: 'Banque', cash: 'Caisse' };

// Date du jour en heure locale (et non en heure UTC).
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function parseAmount(value: string) {
  return Number(String(value).replace(/\s/g, '').replace(',', '.'));
}

const emptyForm: FormState = {
  date: today(),
  type: '',
  category: '',
  label: '',
  amount: '',
  paymentMethod: '',
  account: '',
  direction: 'cash_to_bank',
  note: '',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR');
}

function paymentLabel(value: string | null) {
  return paymentMethods.find((item) => item.value === value)?.label || '—';
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/* Effet d'une opération sur un compte (+ entrée, − sortie, 0 sans rapport). */
function effectOn(item: Transaction, account: Account) {
  if (item.type === 'transfer') {
    if (item.account === account) return -item.amount;
    if (item.transferTo === account) return item.amount;
    return 0;
  }
  if (item.account !== account) return 0;
  return item.type === 'income' ? item.amount : -item.amount;
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/* Envoi direct du fichier vers Google Drive (sans passer par Vercel). */
function putToGoogle(uploadUrl: string, file: File): Promise<{ ok: boolean; fileId: string | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.onload = () => {
      let fileId: string | null = null;
      try {
        fileId = JSON.parse(xhr.responseText)?.id || null;
      } catch {
        fileId = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, fileId });
    };
    xhr.onerror = () => resolve({ ok: false, fileId: null });
    xhr.send(file);
  });
}

export default function TresoreriePage() {
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [initialBalances, setInitialBalances] = useState<Record<Account, number>>({ bank: 0, cash: 0 });
  const [ready, setReady] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingInitialBalance, setSavingInitialBalance] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('all');
  const [showForm, setShowForm] = useState(false);
  const [showInitialBalanceForm, setShowInitialBalanceForm] = useState(false);
  const [initialInputs, setInitialInputs] = useState({ bank: '0', cash: '0' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [receiptToRemove, setReceiptToRemove] = useState<Transaction | null>(null);
  const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const receiptTargetRef = useRef<Transaction | null>(null);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/tresorerie', { cache: 'no-store' });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data.error || 'Impossible de charger la trésorerie.');
      }

      setSchoolYear(data.schoolYear || null);
      setInitialBalances({
        bank: Number(data.initialBalances?.bank || 0),
        cash: Number(data.initialBalances?.cash || 0),
      });
      setReady(data.ready !== false);
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger la trésorerie.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);

    const expense = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);

    const bank = initialBalances.bank + transactions.reduce((sum, item) => sum + effectOn(item, 'bank'), 0);
    const cash = initialBalances.cash + transactions.reduce((sum, item) => sum + effectOn(item, 'cash'), 0);

    return {
      income: round2(income),
      expense: round2(expense),
      bank: round2(bank),
      cash: round2(cash),
      balance: round2(bank + cash),
      initial: round2(initialBalances.bank + initialBalances.cash),
    };
  }, [transactions, initialBalances]);

  /*
   * Catégories proposées selon le type choisi. Une ancienne
   * catégorie hors liste reste proposée en modification.
   */
  const categories = useMemo(() => {
    const base =
      form.type === 'income' ? incomeCategories : form.type === 'expense' ? expenseCategories : [];

    return form.category && !base.includes(form.category) ? [form.category, ...base] : base;
  }, [form.type, form.category]);

  /* Touche Échap : ferme la fenêtre ouverte. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      if (receiptToRemove) {
        if (!receiptBusyId) setReceiptToRemove(null);
      } else if (transactionToDelete) {
        if (!deletingId) setTransactionToDelete(null);
      } else if (showInitialBalanceForm) {
        closeInitialBalanceForm();
      } else if (showForm) {
        closeForm();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const searched = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return transactions;

    return transactions.filter((item) =>
      [item.label, item.category, item.note || '', paymentLabel(item.paymentMethod)]
        .join(' ')
        .toLowerCase()
        .includes(value)
    );
  }, [transactions, search]);

  /*
   * Journal d'un compte : du plus ancien au plus récent,
   * avec le solde après chaque ligne.
   */
  const journal = useMemo(() => {
    if (view === 'all') return [];

    const ordered = [...transactions]
      .filter((item) => effectOn(item, view) !== 0)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      );

    let balance = initialBalances[view];
    const rows = ordered.map((item) => {
      const delta = effectOn(item, view);
      balance = round2(balance + delta);
      return { item, delta, balance };
    });

    const ids = new Set(searched.map((item) => item.id));
    return rows.filter((row) => ids.has(row.item.id));
  }, [view, transactions, initialBalances, searched]);

  const shownCount = view === 'all' ? searched.length : journal.length;

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, date: today() });
    setFormError('');
    setShowForm(true);
  }

  function openEdit(item: Transaction) {
    setEditingId(item.id);
    setForm({
      date: item.date,
      type: item.type,
      category: item.type === 'transfer' ? '' : item.category,
      label: item.label,
      amount: String(item.amount).replace('.', ','),
      paymentMethod: item.paymentMethod || '',
      account: item.account,
      direction: item.type === 'transfer' && item.account === 'bank' ? 'bank_to_cash' : 'cash_to_bank',
      note: item.note || '',
    });
    setFormError('');
    setShowForm(true);
  }

  function openInitialBalanceForm() {
    setInitialInputs({
      bank: String(initialBalances.bank).replace('.', ','),
      cash: String(initialBalances.cash).replace('.', ','),
    });
    setFormError('');
    setShowInitialBalanceForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, date: today() });
  }

  function closeInitialBalanceForm() {
    if (savingInitialBalance) return;
    setShowInitialBalanceForm(false);
  }

  function setType(type: TxType) {
    setFormError('');
    setForm((current) => ({
      ...current,
      type,
      // On ne vide la catégorie que si le type change vraiment
      category: current.type === type ? current.category : '',
    }));
  }

  /* Le moyen de paiement choisit le compte (modifiable ensuite). */
  function setPaymentMethod(value: string) {
    setForm((current) => ({
      ...current,
      paymentMethod: value,
      account: value === 'cash' ? 'cash' : value ? 'bank' : current.account,
    }));
  }

  async function saveInitialBalance(event: FormEvent) {
    event.preventDefault();

    const bank = parseAmount(initialInputs.bank || '0');
    const cash = parseAmount(initialInputs.cash || '0');

    if (!Number.isFinite(bank) || !Number.isFinite(cash)) {
      setFormError('Un des soldes de départ est invalide.');
      return;
    }

    setSavingInitialBalance(true);
    setFormError('');

    try {
      const response = await fetch('/api/tresorerie', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialBalances: { bank, cash } }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer les soldes de départ.');

      setInitialBalances({ bank: data.initialBalances.bank, cash: data.initialBalances.cash });
      setSavingInitialBalance(false);
      closeInitialBalanceForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Impossible d’enregistrer les soldes de départ.');
    } finally {
      setSavingInitialBalance(false);
    }
  }

  async function confirmDelete() {
    if (!transactionToDelete) return;

    setDeletingId(transactionToDelete.id);
    setFormError('');

    try {
      const response = await fetch('/api/tresorerie', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transactionToDelete.id }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Impossible de supprimer l’opération.');

      setTransactionToDelete(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Impossible de supprimer l’opération.');
    } finally {
      setDeletingId(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    if (!form.type) {
      setFormError('Choisis le type : recette, dépense ou mouvement caisse ↔ banque.');
      return;
    }

    const amount = parseAmount(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Le montant doit être supérieur à 0.');
      return;
    }

    if (form.type !== 'transfer' && !form.account) {
      setFormError('Choisis le compte : banque ou caisse.');
      return;
    }

    const payload =
      form.type === 'transfer'
        ? {
            type: 'transfer',
            date: form.date,
            amount: form.amount,
            account: form.direction === 'cash_to_bank' ? 'cash' : 'bank',
            transferTo: form.direction === 'cash_to_bank' ? 'bank' : 'cash',
            label: form.label,
            note: form.note,
          }
        : {
            type: form.type,
            date: form.date,
            amount: form.amount,
            account: form.account,
            category: form.category,
            label: form.label,
            paymentMethod: form.paymentMethod,
            note: form.note,
          };

    setSaving(true);
    setFormError('');

    try {
      const response = await fetch('/api/tresorerie', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...payload }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer l’opération.');

      setSaving(false);
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Impossible d’enregistrer l’opération.');
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Justificatifs ---------------- */

  function pickReceipt(item: Transaction) {
    receiptTargetRef.current = item;
    setError('');
    setNotice('');
    fileInputRef.current?.click();
  }

  async function uploadReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const item = receiptTargetRef.current;
    event.target.value = '';

    if (!file || !item) return;

    setReceiptBusyId(item.id);
    setError('');
    setNotice('');

    try {
      const prepareResponse = await fetch('/api/tresorerie/justificatif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          transactionId: item.id,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      });

      const prepared = await readJson(prepareResponse);
      if (!prepareResponse.ok || !prepared.uploadUrl) {
        throw new Error(prepared.error || 'Impossible de préparer l’envoi du justificatif.');
      }

      const sent = await putToGoogle(prepared.uploadUrl, file);
      if (!sent.ok) {
        throw new Error('L’envoi du justificatif vers Google Drive a échoué. Vérifie ta connexion et réessaie.');
      }

      const confirmResponse = await fetch('/api/tresorerie/justificatif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          transactionId: item.id,
          fileId: sent.fileId,
          fileName: prepared.fileName,
        }),
      });

      const confirmed = await readJson(confirmResponse);
      if (!confirmResponse.ok) throw new Error(confirmed.error || 'Justificatif non enregistré.');

      setTransactions((current) =>
        current.map((tx) => (tx.id === item.id ? { ...tx, receipt: confirmed.receipt } : tx))
      );
      setNotice(`Justificatif joint à « ${item.label} » et rangé dans le Drive (Justificatifs → ${schoolYear}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Justificatif non envoyé.');
    } finally {
      setReceiptBusyId(null);
      receiptTargetRef.current = null;
    }
  }

  async function confirmRemoveReceipt() {
    const item = receiptToRemove;
    if (!item) return;

    setReceiptBusyId(item.id);
    setFormError('');

    try {
      const response = await fetch('/api/tresorerie/justificatif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', transactionId: item.id }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Impossible de retirer le justificatif.');

      setTransactions((current) => current.map((tx) => (tx.id === item.id ? { ...tx, receipt: null } : tx)));
      setReceiptToRemove(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Impossible de retirer le justificatif.');
    } finally {
      setReceiptBusyId(null);
    }
  }

  /* ---------------- Affichage ---------------- */

  function typeBadge(item: Transaction) {
    const styles =
      item.type === 'income'
        ? { background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0' }
        : item.type === 'expense'
          ? { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }
          : { background: '#eef6ff', color: '#1e4f8a', border: '1px solid #cfe0f5' };

    return (
      <span className="badge" style={styles}>
        {item.type === 'income' ? 'Recette' : item.type === 'expense' ? 'Dépense' : 'Mouvement'}
      </span>
    );
  }

  function accountCell(item: Transaction) {
    if (item.type === 'transfer' && item.transferTo) {
      return (
        <span className="tresorerie-account">
          {ACCOUNT_NAMES[item.account]} → {ACCOUNT_NAMES[item.transferTo]}
        </span>
      );
    }

    return (
      <span className={`tresorerie-account tresorerie-account-${item.account}`}>
        {item.account === 'cash' ? <Banknote size={12} /> : <Building2 size={12} />}
        {ACCOUNT_NAMES[item.account]}
      </span>
    );
  }

  function labelCell(item: Transaction, withCategory = false) {
    return (
      <td>
        <div style={{ fontWeight: 700 }}>
          {item.label}
          {item.fromMembership && (
            <span
              className="tresorerie-auto-badge"
              title="Recette créée automatiquement depuis la page Adhérents"
            >
              Adhésion
            </span>
          )}
        </div>

        {(withCategory || item.note) && (
          <div style={{ fontSize: 10, color: '#756a67', marginTop: 3 }}>
            {[withCategory && item.type !== 'transfer' ? item.category : '', item.note || '']
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </td>
    );
  }

  function actionsCell(item: Transaction) {
    const busy = receiptBusyId === item.id;

    return (
      <td style={{ textAlign: 'right' }}>
        <div className="tresorerie-row-actions">
          {busy ? (
            <span className="btn" aria-label="Envoi en cours">
              <Loader2 size={14} className="tresorerie-spin" />
            </span>
          ) : item.receipt ? (
            <>
              <a
                className="btn tresorerie-receipt-link"
                href={item.receipt.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                title={`Voir le justificatif : ${item.receipt.name}`}
              >
                <FileCheck2 size={14} />
              </a>
              <button
                type="button"
                className="btn"
                title="Retirer le justificatif"
                onClick={() => {
                  setFormError('');
                  setReceiptToRemove(item);
                }}
                disabled={!ready}
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn"
              title="Joindre un justificatif (photo ou PDF)"
              onClick={() => pickReceipt(item)}
              disabled={!ready || !!receiptBusyId}
            >
              <Paperclip size={14} />
            </button>
          )}

          {item.fromMembership ? (
            <span className="tresorerie-auto-hint" title="À modifier depuis la page Adhérents">
              Via Adhérents
            </span>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => openEdit(item)}
                disabled={!!deletingId}
                title="Modifier"
              >
                <Pencil size={14} />
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFormError('');
                  setTransactionToDelete(item);
                }}
                disabled={deletingId === item.id}
                title="Supprimer"
                aria-label={`Supprimer ${item.label}`}
                style={{ color: '#b91c1c' }}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    );
  }

  return (
    <>
      <div className="topbar tresorerie-topbar">
        <div>
          <div className="eyebrow">Trésorerie</div>
          <h1>Gestion de la trésorerie</h1>
          <div className="kicker">Année scolaire {schoolYear || '—'}</div>
        </div>

        <div className="topbar-right">
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={14} />
            Ajouter une opération
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={uploadReceipt}
      />

      {!ready && (
        <div className="notice notice-error" style={{ marginBottom: 18 }}>
          La gestion banque / caisse n’est pas encore installée : lance{' '}
          <strong>migration_tresorerie_v3.sql</strong> dans Supabase.
        </div>
      )}

      {error && (
        <div className="notice notice-error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      {notice && (
        <div className="notice tresorerie-notice-ok" style={{ marginBottom: 18 }}>
          {notice}
        </div>
      )}

      <section className="card tresorerie-summary-card" style={{ padding: 22, marginBottom: 18 }}>
        <div className="tresorerie-summary-grid">
          <div className="tresorerie-stat tresorerie-stat-initial">
            <WalletCards size={18} />
            <div className="stat-label tresorerie-stat-label">SOLDES DE DÉPART</div>
            <div className="tresorerie-stat-value">{formatMoney(totals.initial)}</div>
            <div className="tresorerie-split">
              <span>Banque {formatMoney(initialBalances.bank)}</span>
              <span>Caisse {formatMoney(initialBalances.cash)}</span>
            </div>
            <button type="button" className="btn" onClick={openInitialBalanceForm} style={{ marginTop: 10 }}>
              <Pencil size={13} />
              Modifier
            </button>
          </div>

          <div className="tresorerie-stat">
            <ArrowUpCircle size={18} />
            <div className="stat-label tresorerie-stat-label">RECETTES</div>
            <div className="tresorerie-stat-value">{formatMoney(totals.income)}</div>
          </div>

          <div className="tresorerie-stat">
            <ArrowDownCircle size={18} />
            <div className="stat-label tresorerie-stat-label">DÉPENSES</div>
            <div className="tresorerie-stat-value">{formatMoney(totals.expense)}</div>
          </div>

          <div className="tresorerie-stat tresorerie-stat-balance">
            <WalletCards size={18} />
            <div className="stat-label tresorerie-stat-label">SOLDE ACTUEL</div>
            <div
              className="tresorerie-stat-value"
              style={{ color: totals.balance < 0 ? '#b91c1c' : undefined }}
            >
              {formatMoney(totals.balance)}
            </div>
            <div className="tresorerie-split">
              <span style={{ color: totals.bank < 0 ? '#b91c1c' : undefined }}>
                Banque {formatMoney(totals.bank)}
              </span>
              <span style={{ color: totals.cash < 0 ? '#b91c1c' : undefined }}>
                Caisse {formatMoney(totals.cash)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="card section-card tresorerie-operations-card">
        <div className="tresorerie-tabs" role="tablist">
          <button type="button" className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>
            <CreditCard size={15} />
            Toutes les opérations
          </button>
          <button type="button" className={view === 'bank' ? 'active' : ''} onClick={() => setView('bank')}>
            <Building2 size={15} />
            Compte bancaire
            <span className="tresorerie-tab-amount">{formatMoney(totals.bank)}</span>
          </button>
          <button type="button" className={view === 'cash' ? 'active' : ''} onClick={() => setView('cash')}>
            <Banknote size={15} />
            Journal de caisse
            <span className="tresorerie-tab-amount">{formatMoney(totals.cash)}</span>
          </button>
        </div>

        <div className="section-head tresorerie-section-head">
          <div>
            <h2 className="section-title">
              {view === 'all' ? 'Opérations' : view === 'bank' ? 'Compte bancaire' : 'Journal de caisse'}
            </h2>
            <p className="section-sub">
              {shownCount} opération{shownCount > 1 ? 's' : ''} affichée{shownCount > 1 ? 's' : ''}
              {view !== 'all' && ' · du plus ancien au plus récent, avec le solde après chaque ligne'}
            </p>
          </div>

          <div className="tresorerie-search">
            <input
              className="input"
              placeholder="Rechercher une opération..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="kicker">Chargement de la trésorerie…</p>
        ) : view === 'all' && searched.length === 0 ? (
          <div className="tresorerie-empty">
            <CreditCard size={34} style={{ opacity: 0.35 }} />
            <h3 style={{ margin: '12px 0 4px' }}>Aucune opération</h3>
            <p className="section-sub">Ajoute la première recette ou dépense de l’année.</p>
          </div>
        ) : view === 'all' ? (
          <div className="tresorerie-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Compte</th>
                  <th>Catégorie</th>
                  <th>Libellé</th>
                  <th>Mode</th>
                  <th>Montant</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {searched.map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.date)}</td>
                    <td>{typeBadge(item)}</td>
                    <td>{accountCell(item)}</td>
                    <td>{item.type === 'transfer' ? '—' : item.category}</td>
                    {labelCell(item)}
                    <td>{item.type === 'transfer' ? '—' : paymentLabel(item.paymentMethod)}</td>
                    <td
                      style={{
                        whiteSpace: 'nowrap',
                        fontWeight: 800,
                        color:
                          item.type === 'income' ? '#166534' : item.type === 'expense' ? '#b91c1c' : '#1e4f8a',
                      }}
                    >
                      {item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '⇄ '}
                      {formatMoney(item.amount)}
                    </td>
                    {actionsCell(item)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="tresorerie-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th style={{ textAlign: 'right' }}>Entrée</th>
                  <th style={{ textAlign: 'right' }}>Sortie</th>
                  <th style={{ textAlign: 'right' }}>Solde</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {!search.trim() && (
                  <tr className="tresorerie-journal-start">
                    <td />
                    <td>Solde de départ</td>
                    <td />
                    <td />
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatMoney(initialBalances[view])}</td>
                    <td />
                  </tr>
                )}

                {journal.map(({ item, delta, balance }) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.date)}</td>
                    {labelCell(item, true)}
                    <td style={{ textAlign: 'right', color: '#166534', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {delta > 0 ? formatMoney(delta) : ''}
                    </td>
                    <td style={{ textAlign: 'right', color: '#b91c1c', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {delta < 0 ? formatMoney(-delta) : ''}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        color: balance < 0 ? '#b91c1c' : undefined,
                      }}
                    >
                      {formatMoney(balance)}
                    </td>
                    {actionsCell(item)}
                  </tr>
                ))}

                {journal.length === 0 && (
                  <tr>
                    <td colSpan={6} className="kicker" style={{ padding: 18 }}>
                      Aucune opération sur {view === 'bank' ? 'le compte bancaire' : 'la caisse'}
                      {search.trim() ? ' pour cette recherche' : ' pour le moment'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showInitialBalanceForm && (
        <div className="tresorerie-modal-overlay">
          <div className="card tresorerie-modal tresorerie-initial-modal">
            <div className="tresorerie-modal-head">
              <div>
                <div className="eyebrow">Trésorerie</div>
                <h2 className="section-title tresorerie-modal-title">Soldes de départ</h2>
                <p className="section-sub tresorerie-initial-help">
                  Ce qu’il y avait sur le compte bancaire et dans la caisse au début de l’année scolaire.
                </p>
              </div>

              <button
                type="button"
                className="btn tresorerie-close-button"
                onClick={closeInitialBalanceForm}
                disabled={savingInitialBalance}
                title="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={saveInitialBalance}>
              {(['bank', 'cash'] as Account[]).map((account) => (
                <div key={account} className="tresorerie-initial-balance-field" style={{ marginTop: 12 }}>
                  <label className="form-label" htmlFor={`initial-${account}`}>
                    {account === 'bank' ? 'Compte bancaire' : 'Caisse (espèces)'}
                  </label>

                  <div className="tresorerie-initial-input-wrap">
                    <input
                      id={`initial-${account}`}
                      className="input tresorerie-initial-input"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={initialInputs[account]}
                      onChange={(event) =>
                        setInitialInputs((current) => ({ ...current, [account]: event.target.value }))
                      }
                      autoFocus={account === 'bank'}
                    />
                    <span>€</span>
                  </div>
                </div>
              ))}

              {formError && <div className="notice notice-error tresorerie-form-error">{formError}</div>}

              <div className="tresorerie-modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={closeInitialBalanceForm}
                  disabled={savingInitialBalance}
                >
                  Annuler
                </button>

                <button type="submit" className="btn btn-primary" disabled={savingInitialBalance}>
                  {savingInitialBalance ? 'Enregistrement…' : 'Enregistrer les soldes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="tresorerie-modal-overlay">
          <div className="card tresorerie-modal">
            <div className="tresorerie-modal-head">
              <div>
                <div className="eyebrow">Trésorerie</div>
                <h2 className="section-title tresorerie-modal-title">
                  {editingId ? 'Modifier l’opération' : 'Ajouter une opération'}
                </h2>
              </div>

              <button
                type="button"
                className="btn tresorerie-close-button"
                onClick={closeForm}
                disabled={saving}
                title="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={save}>
              <div className="tresorerie-form-grid">
                <div className="tresorerie-form-field tresorerie-field-full">
                  <label className="form-label">
                    Type <span className="tresorerie-required">*</span>
                  </label>

                  <div className="tresorerie-type-buttons tresorerie-type-buttons-3">
                    <button
                      type="button"
                      className={form.type === 'income' ? 'btn btn-primary' : 'btn'}
                      onClick={() => setType('income')}
                      aria-pressed={form.type === 'income'}
                    >
                      Recette
                    </button>

                    <button
                      type="button"
                      className={form.type === 'expense' ? 'btn btn-primary' : 'btn'}
                      onClick={() => setType('expense')}
                      aria-pressed={form.type === 'expense'}
                    >
                      Dépense
                    </button>

                    <button
                      type="button"
                      className={form.type === 'transfer' ? 'btn btn-primary' : 'btn'}
                      onClick={() => setType('transfer')}
                      aria-pressed={form.type === 'transfer'}
                    >
                      <ArrowLeftRight size={14} />
                      Caisse ↔ banque
                    </button>
                  </div>
                </div>

                <div className="tresorerie-form-field">
                  <label className="form-label" htmlFor="transaction-date">
                    Date
                  </label>
                  <input
                    id="transaction-date"
                    type="date"
                    className="input tresorerie-date-input"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                    required
                  />
                </div>

                <div className="tresorerie-form-field">
                  <label className="form-label" htmlFor="transaction-amount">
                    Montant
                  </label>
                  <input
                    id="transaction-amount"
                    className="input"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    required
                  />
                </div>

                {form.type === 'transfer' ? (
                  <>
                    <div className="tresorerie-form-field tresorerie-field-full">
                      <label className="form-label" htmlFor="transaction-direction">
                        Mouvement
                      </label>
                      <select
                        id="transaction-direction"
                        className="input"
                        value={form.direction}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            direction: event.target.value as FormState['direction'],
                          }))
                        }
                      >
                        <option value="cash_to_bank">Dépôt d’espèces à la banque (caisse → banque)</option>
                        <option value="bank_to_cash">Retrait d’espèces pour la caisse (banque → caisse)</option>
                      </select>
                      <p className="tresorerie-help">
                        Ce n’est ni une recette ni une dépense : l’argent change seulement de place.
                      </p>
                    </div>

                    <div className="tresorerie-form-field tresorerie-field-full">
                      <label className="form-label" htmlFor="transaction-label">
                        Libellé (facultatif)
                      </label>
                      <input
                        id="transaction-label"
                        className="input"
                        placeholder={
                          form.direction === 'cash_to_bank'
                            ? 'Dépôt d’espèces à la banque'
                            : 'Retrait d’espèces pour la caisse'
                        }
                        value={form.label}
                        onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tresorerie-form-field">
                      <label className="form-label" htmlFor="transaction-category">
                        Catégorie
                      </label>
                      <select
                        id="transaction-category"
                        className="input"
                        value={form.category}
                        disabled={!form.type}
                        onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                        required
                      >
                        <option value="">
                          {form.type ? 'Sélectionner une catégorie' : 'Choisis d’abord le type'}
                        </option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="tresorerie-form-field">
                      <label className="form-label" htmlFor="transaction-payment">
                        Mode de paiement
                      </label>
                      <select
                        id="transaction-payment"
                        className="input"
                        value={form.paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                      >
                        <option value="">Non renseigné</option>
                        {paymentMethods.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="tresorerie-form-field tresorerie-field-full">
                      <label className="form-label">
                        Compte <span className="tresorerie-required">*</span>
                      </label>
                      <div className="tresorerie-type-buttons">
                        <button
                          type="button"
                          className={form.account === 'bank' ? 'btn btn-primary' : 'btn'}
                          onClick={() => setForm((current) => ({ ...current, account: 'bank' }))}
                          aria-pressed={form.account === 'bank'}
                        >
                          <Building2 size={14} />
                          Banque
                        </button>
                        <button
                          type="button"
                          className={form.account === 'cash' ? 'btn btn-primary' : 'btn'}
                          onClick={() => setForm((current) => ({ ...current, account: 'cash' }))}
                          aria-pressed={form.account === 'cash'}
                        >
                          <Banknote size={14} />
                          Caisse
                        </button>
                      </div>
                      <p className="tresorerie-help">
                        Choisi automatiquement selon le mode de paiement (espèces → caisse), modifiable.
                      </p>
                    </div>

                    <div className="tresorerie-form-field tresorerie-field-full">
                      <label className="form-label" htmlFor="transaction-label">
                        Libellé
                      </label>
                      <input
                        id="transaction-label"
                        className="input"
                        placeholder="Ex. Vente de gâteaux"
                        value={form.label}
                        onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                        required
                      />
                    </div>
                  </>
                )}

                <div className="tresorerie-form-field tresorerie-field-full">
                  <label className="form-label" htmlFor="transaction-note">
                    Note
                  </label>
                  <input
                    id="transaction-note"
                    className="input"
                    placeholder="Facultatif"
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  />
                </div>
              </div>

              {!editingId && (
                <p className="tresorerie-help" style={{ marginTop: 12 }}>
                  Le justificatif (photo du ticket, facture en PDF) se joint ensuite avec le trombone 📎 sur la
                  ligne de l’opération.
                </p>
              )}

              {formError && <div className="notice notice-error tresorerie-form-error">{formError}</div>}

              <div className="tresorerie-modal-actions">
                <button type="button" className="btn" onClick={closeForm} disabled={saving}>
                  Annuler
                </button>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? 'Enregistrement…'
                    : editingId
                      ? 'Enregistrer les modifications'
                      : 'Ajouter l’opération'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transactionToDelete && (
        <div className="tresorerie-modal-overlay">
          <div className="card tresorerie-modal tresorerie-initial-modal">
            <div className="eyebrow">Trésorerie</div>
            <h2 className="section-title tresorerie-modal-title">Supprimer l’opération ?</h2>

            <div className="tresorerie-delete-summary">
              <strong>{transactionToDelete.label}</strong>
              <span>
                {formatDate(transactionToDelete.date)} ·{' '}
                {transactionToDelete.type === 'income'
                  ? 'Recette'
                  : transactionToDelete.type === 'expense'
                    ? 'Dépense'
                    : 'Mouvement'}{' '}
                · {formatMoney(transactionToDelete.amount)}
              </span>
            </div>

            <p className="section-sub">
              Cette opération sera définitivement supprimée.
              {transactionToDelete.receipt &&
                ' Son justificatif ira dans la corbeille du Google Drive (récupérable 30 jours).'}
            </p>

            {formError && <div className="notice notice-error tresorerie-form-error">{formError}</div>}

            <div className="tresorerie-modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setTransactionToDelete(null)}
                disabled={!!deletingId}
              >
                Annuler
              </button>

              <button
                type="button"
                className="btn tresorerie-danger-button"
                onClick={confirmDelete}
                disabled={!!deletingId}
              >
                <Trash2 size={14} />
                {deletingId ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptToRemove && (
        <div className="tresorerie-modal-overlay">
          <div className="card tresorerie-modal tresorerie-initial-modal">
            <div className="eyebrow">Trésorerie</div>
            <h2 className="section-title tresorerie-modal-title">Retirer le justificatif ?</h2>

            <div className="tresorerie-delete-summary">
              <strong>{receiptToRemove.receipt?.name}</strong>
              <span>
                Opération : {receiptToRemove.label} · {formatMoney(receiptToRemove.amount)}
              </span>
            </div>

            <p className="section-sub">
              Le fichier ira dans la corbeille du Google Drive (récupérable 30 jours). L’opération, elle, ne
              change pas.
            </p>

            {formError && <div className="notice notice-error tresorerie-form-error">{formError}</div>}

            <div className="tresorerie-modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setReceiptToRemove(null)}
                disabled={!!receiptBusyId}
              >
                Annuler
              </button>

              <button
                type="button"
                className="btn tresorerie-danger-button"
                onClick={confirmRemoveReceipt}
                disabled={!!receiptBusyId}
              >
                <X size={14} />
                {receiptBusyId ? 'Retrait…' : 'Retirer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .btn,
        .tresorerie-row-actions :global(.btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        /*
         * Éléments construits par les petites fonctions d'affichage
         * (cellules du tableau) : styles appliqués via le tableau.
         */
        .tresorerie-table-wrap :global(.tresorerie-row-actions) {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: nowrap;
          gap: 6px;
          white-space: nowrap;
        }

        .tresorerie-table-wrap :global(.tresorerie-row-actions .btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-decoration: none;
        }

        .tresorerie-table-wrap :global(.tresorerie-receipt-link) {
          color: #166534;
          border-color: #bbf7d0;
          background: #f0fdf4;
        }

        .tresorerie-table-wrap :global(.tresorerie-account) {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 700;
          color: #5f514b;
        }

        .tresorerie-table-wrap :global(.tresorerie-account svg) {
          display: inline-block;
          flex-shrink: 0;
        }

        .tresorerie-table-wrap :global(.tresorerie-account-cash) {
          color: #8a5a12;
        }

        .tresorerie-table-wrap :global(.tresorerie-auto-badge) {
          display: inline-block;
          margin-left: 7px;
          padding: 2px 7px;
          border-radius: 999px;
          background: #eef6ff;
          border: 1px solid #cfe0f5;
          color: #1e4f8a;
          font-size: 10px;
          font-weight: 700;
          vertical-align: 1px;
        }

        .tresorerie-table-wrap :global(.tresorerie-auto-hint) {
          font-size: 11px;
          color: #756a67;
          white-space: nowrap;
        }

        .tresorerie-notice-ok {
          border-color: #cfe5d7;
          background: #f2f8f4;
          color: #23492f;
        }

        .tresorerie-split {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 12px;
          margin-top: 6px;
          color: #6b5d58;
          font-size: 12px;
          font-weight: 700;
        }

        .tresorerie-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 14px;
          border-bottom: 1px solid #eadfd5;
        }

        .tresorerie-tabs button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 12px;
          border: 0;
          border-bottom: 2px solid transparent;
          background: transparent;
          color: #756a67;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .tresorerie-tabs button.active {
          color: #8f211c;
          border-bottom-color: #8f211c;
        }

        .tresorerie-tab-amount {
          padding: 2px 8px;
          border-radius: 999px;
          background: #fff7ee;
          border: 1px solid #eadfd5;
          color: #5f514b;
          font-size: 11px;
        }

        .tresorerie-account {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 700;
          color: #5f514b;
        }

        .tresorerie-account-cash {
          color: #8a5a12;
        }

        .tresorerie-type-buttons-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .tresorerie-help {
          margin: 6px 0 0;
          color: #756a67;
          font-size: 12px;
          line-height: 1.5;
        }

        .tresorerie-journal-start td {
          background: #fffaf3;
          color: #5f514b;
          font-weight: 700;
        }

        .tresorerie-receipt-link {
          color: #166534;
          text-decoration: none;
        }

        :global(.tresorerie-spin) {
          animation: tresorerie-spin 1s linear infinite;
        }

        @keyframes tresorerie-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 700px) {
          .tresorerie-type-buttons-3 {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .tresorerie-tabs button {
            padding: 8px 8px;
            font-size: 12px;
          }
        }
        .tresorerie-auto-badge {
          display: inline-block;
          margin-left: 7px;
          padding: 2px 7px;
          border-radius: 999px;
          background: #eef6ff;
          border: 1px solid #cfe0f5;
          color: #1e4f8a;
          font-size: 10px;
          font-weight: 700;
          vertical-align: 1px;
        }

        .tresorerie-auto-hint {
          font-size: 11px;
          color: #756a67;
          white-space: nowrap;
        }

        .tresorerie-required {
          color: #b91c1c;
        }

        .tresorerie-form-error {
          margin-top: 16px;
        }

        .tresorerie-delete-summary {
          display: grid;
          gap: 5px;
          margin: 16px 0 12px;
          padding: 13px 14px;
          border: 1px solid #eadfd5;
          border-radius: 10px;
          background: #fafafa;
        }

        .tresorerie-delete-summary span {
          color: #756a67;
          font-size: 13px;
        }

        .tresorerie-danger-button {
          background: #8a2b22 !important;
          border-color: #8a2b22 !important;
          color: #fff !important;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .tresorerie-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          min-width: 0;
        }

        .tresorerie-stat {
          min-width: 0;
          padding: 18px;
          border: 1px solid #eadfd5;
          border-radius: 12px;
          background: #fffaf3;
          text-align: center;
          box-sizing: border-box;
        }

        .tresorerie-stat-initial {
          background: #f8fafc;
        }

        .tresorerie-stat-balance {
          background: #f8fafc;
        }

        .tresorerie-stat-label {
          margin-top: 7px;
        }

        .tresorerie-stat-value {
          margin-top: 5px;
          font-size: 27px;
          font-weight: 800;
          white-space: nowrap;
        }

        .tresorerie-section-head {
          min-width: 0;
        }

        .tresorerie-search {
          width: 320px;
          max-width: 100%;
          min-width: 0;
        }

        .tresorerie-search :global(.input) {
          width: 100%;
          box-sizing: border-box;
        }

        .tresorerie-table-wrap {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .tresorerie-row-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .tresorerie-empty {
          text-align: center;
          padding: 48px 20px;
        }

        .tresorerie-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
          box-sizing: border-box;
        }

        .tresorerie-modal {
          width: 100%;
          max-width: 620px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 20px 22px 22px;
          box-sizing: border-box;
          background: #fff;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.20);
        }

        .tresorerie-initial-modal {
          max-width: 460px;
        }

        .tresorerie-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .tresorerie-modal-title {
          margin-top: 4px;
        }

        .tresorerie-close-button {
          flex: 0 0 auto;
        }

        .tresorerie-initial-help {
          margin-top: 6px;
          max-width: 360px;
        }

        .tresorerie-initial-balance-field {
          margin-top: 22px;
        }

        .tresorerie-initial-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .tresorerie-initial-input {
          padding-right: 42px;
          font-size: 20px;
          font-weight: 700;
        }

        .tresorerie-initial-input-wrap > span {
          position: absolute;
          right: 14px;
          font-weight: 700;
          color: #756a67;
          pointer-events: none;
        }

        .tresorerie-form-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 14px;
          margin-top: 20px;
          min-width: 0;
        }

        .tresorerie-form-field {
          min-width: 0;
        }

        .tresorerie-field-full {
          grid-column: 1 / -1;
        }

        .tresorerie-form-field :global(.input) {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .tresorerie-date-input {
          -webkit-appearance: none;
          appearance: none;
        }

        .tresorerie-type-buttons {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
          min-width: 0;
        }

        .tresorerie-type-buttons .btn {
          min-width: 0;
          white-space: nowrap;
        }

        .tresorerie-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        @media (max-width: 900px) {
          .tresorerie-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .tresorerie-summary-card {
            padding: 16px !important;
          }

          .tresorerie-summary-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
          }

          .tresorerie-stat {
            padding: 16px;
          }

          .tresorerie-stat-value {
            font-size: 25px;
          }

          .tresorerie-section-head {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
          }

          .tresorerie-search {
            width: 100%;
          }

          .tresorerie-empty {
            padding: 42px 16px;
          }

          .tresorerie-modal-overlay {
            padding: 12px;
            align-items: flex-start;
            justify-content: center;
            min-height: 100dvh;
            height: 100dvh;
            overflow: hidden;
          }

          .tresorerie-modal {
            width: 100%;
            max-width: none;
            max-height: calc(100dvh - 24px);
            height: auto;
            margin-top: 12px;
            padding: 20px 18px 18px;
            border-radius: 22px;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .tresorerie-modal-head {
            align-items: flex-start;
          }

          .tresorerie-form-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
            margin-top: 20px;
          }

          .tresorerie-field-full {
            grid-column: auto;
          }

          .tresorerie-type-buttons {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }

          .tresorerie-modal-actions {
            flex-direction: column-reverse;
            gap: 10px;
          }

          .tresorerie-modal-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .tresorerie-table-wrap {
            margin-right: -2px;
          }
        }

        @media (max-width: 420px) {
          .tresorerie-topbar :global(.topbar-right) {
            width: 100%;
          }

          .tresorerie-topbar :global(.topbar-right .btn) {
            width: auto;
          }

          .tresorerie-modal {
            padding-left: 16px;
            padding-right: 16px;
          }

          .tresorerie-type-buttons .btn {
            padding-left: 10px;
            padding-right: 10px;
          }
        }
      `}</style>
    </>
  );
}
