'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';

type Transaction = {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  label: string;
  amount: number;
  paymentMethod: string | null;
  note: string | null;
};

type FormState = {
  date: string;
  type: 'income' | 'expense';
  category: string;
  label: string;
  amount: string;
  paymentMethod: string;
  note: string;
};

const incomeCategories = [
  'Adhésions',
  'Subvention',
  'Don',
  'Vente',
  'Autre recette',
];

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: FormState = {
  date: today(),
  type: 'income',
  category: '',
  label: '',
  amount: '',
  paymentMethod: '',
  note: '',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR');
}

function paymentLabel(value: string | null) {
  return (
    paymentMethods.find((item) => item.value === value)?.label || '—'
  );
}

export default function TresoreriePage() {
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/tresorerie', {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossible de charger la trésorerie.'
        );
      }

      setSchoolYear(data.schoolYear || null);
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger la trésorerie.'
      );
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

    return {
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      balance: Math.round((income - expense) * 100) / 100,
    };
  }, [transactions]);

  const categories =
    form.type === 'income'
      ? incomeCategories
      : expenseCategories;

  const filteredTransactions = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return transactions;

    return transactions.filter((item) =>
      [
        item.label,
        item.category,
        item.note || '',
        paymentLabel(item.paymentMethod),
      ]
        .join(' ')
        .toLowerCase()
        .includes(value)
    );
  }, [transactions, search]);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, date: today() });
    setError('');
    setShowForm(true);
  }

  function openEdit(item: Transaction) {
    setEditingId(item.id);
    setForm({
      date: item.date,
      type: item.type,
      category: item.category,
      label: item.label,
      amount: String(item.amount).replace('.', ','),
      paymentMethod: item.paymentMethod || '',
      note: item.note || '',
    });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, date: today() });
  }

  function setType(type: FormState['type']) {
    setForm((current) => ({
      ...current,
      type,
      category: '',
    }));
  }

  async function deleteTransaction(item: Transaction) {
    if (deletingId) return;

    const confirmed = window.confirm(
      `Supprimer l’opération « ${item.label} » de ${formatMoney(item.amount)} ?\n\nCette opération sera définitivement supprimée.`
    );

    if (!confirmed) return;

    setDeletingId(item.id);
    setError('');

    try {
      const response = await fetch('/api/tresorerie', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: item.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossible de supprimer l’opération.'
        );
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer l’opération.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/tresorerie', {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossible d’enregistrer l’opération.'
        );
      }

      closeForm();
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer l’opération.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Trésorerie</div>
          <h1>Gestion de la trésorerie</h1>
          <div className="kicker">
            Année scolaire {schoolYear || '—'}
          </div>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="btn btn-primary"
            onClick={openNew}
          >
            <Plus size={14} />
            Ajouter une opération
          </button>
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

      <section
        className="card"
        style={{
          padding: 22,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
          }}
        >
          <div
            style={{
              padding: 18,
              border: '1px solid #eadfd5',
              borderRadius: 12,
              background: '#fffaf3',
              textAlign: 'center',
            }}
          >
            <ArrowUpCircle size={18} />
            <div className="stat-label" style={{ marginTop: 7 }}>
              RECETTES
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 27,
                fontWeight: 800,
              }}
            >
              {formatMoney(totals.income)}
            </div>
          </div>

          <div
            style={{
              padding: 18,
              border: '1px solid #eadfd5',
              borderRadius: 12,
              background: '#fffaf3',
              textAlign: 'center',
            }}
          >
            <ArrowDownCircle size={18} />
            <div className="stat-label" style={{ marginTop: 7 }}>
              DÉPENSES
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 27,
                fontWeight: 800,
              }}
            >
              {formatMoney(totals.expense)}
            </div>
          </div>

          <div
            style={{
              padding: 18,
              border: '1px solid #eadfd5',
              borderRadius: 12,
              background: '#f8fafc',
              textAlign: 'center',
            }}
          >
            <WalletCards size={18} />
            <div className="stat-label" style={{ marginTop: 7 }}>
              SOLDE
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 27,
                fontWeight: 800,
                color:
                  totals.balance < 0
                    ? '#b91c1c'
                    : undefined,
              }}
            >
              {formatMoney(totals.balance)}
            </div>
          </div>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Opérations</h2>
            <p className="section-sub">
              {filteredTransactions.length} opération
              {filteredTransactions.length > 1 ? 's' : ''} affichée
              {filteredTransactions.length > 1 ? 's' : ''}
            </p>
          </div>

          <div
            style={{
              width: 320,
              maxWidth: '100%',
            }}
          >
            <input
              className="input"
              placeholder="Rechercher une opération..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="kicker">
            Chargement de la trésorerie…
          </p>
        ) : filteredTransactions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 20px',
            }}
          >
            <CreditCard
              size={34}
              style={{ opacity: 0.35 }}
            />
            <h3 style={{ margin: '12px 0 4px' }}>
              Aucune opération
            </h3>
            <p className="section-sub">
              Ajoute la première recette ou dépense de l’année.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Catégorie</th>
                  <th>Libellé</th>
                  <th>Mode</th>
                  <th>Montant</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(item.date)}
                    </td>

                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            item.type === 'income'
                              ? '#ecfdf5'
                              : '#fef2f2',
                          color:
                            item.type === 'income'
                              ? '#166534'
                              : '#b91c1c',
                          border:
                            item.type === 'income'
                              ? '1px solid #bbf7d0'
                              : '1px solid #fecaca',
                        }}
                      >
                        {item.type === 'income'
                          ? 'Recette'
                          : 'Dépense'}
                      </span>
                    </td>

                    <td>{item.category}</td>

                    <td>
                      <div style={{ fontWeight: 700 }}>
                        {item.label}
                      </div>
                      {item.note && (
                        <div
                          style={{
                            fontSize: 10,
                            color: '#756a67',
                            marginTop: 3,
                          }}
                        >
                          {item.note}
                        </div>
                      )}
                    </td>

                    <td>
                      {paymentLabel(item.paymentMethod)}
                    </td>

                    <td
                      style={{
                        whiteSpace: 'nowrap',
                        fontWeight: 800,
                        color:
                          item.type === 'income'
                            ? '#166534'
                            : '#b91c1c',
                      }}
                    >
                      {item.type === 'income' ? '+' : '-'}
                      {formatMoney(item.amount)}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
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
                          onClick={() => void deleteTransaction(item)}
                          disabled={deletingId === item.id}
                          title="Supprimer"
                          aria-label={`Supprimer ${item.label}`}
                          style={{
                            color: '#b91c1c',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px 22px 22px',
              boxSizing: 'border-box',
              background: '#fff',
              boxShadow:
                '0 20px 50px rgba(15, 23, 42, 0.20)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div className="eyebrow">Trésorerie</div>
                <h2
                  className="section-title"
                  style={{ marginTop: 4 }}
                >
                  {editingId
                    ? 'Modifier l’opération'
                    : 'Ajouter une opération'}
                </h2>
              </div>

              <button
                type="button"
                className="btn"
                onClick={closeForm}
                disabled={saving}
                title="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={save}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                  marginTop: 20,
                }}
              >
                <div>
                  <label
                    className="form-label"
                    htmlFor="transaction-date"
                  >
                    Date
                  </label>
                  <input
                    id="transaction-date"
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <label className="form-label">
                    Type
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      className={
                        form.type === 'income'
                          ? 'btn btn-primary'
                          : 'btn'
                      }
                      onClick={() => setType('income')}
                    >
                      Recette
                    </button>

                    <button
                      type="button"
                      className={
                        form.type === 'expense'
                          ? 'btn btn-primary'
                          : 'btn'
                      }
                      onClick={() => setType('expense')}
                    >
                      Dépense
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    className="form-label"
                    htmlFor="transaction-category"
                  >
                    Catégorie
                  </label>
                  <select
                    id="transaction-category"
                    className="input"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">
                      Sélectionner une catégorie
                    </option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="form-label"
                    htmlFor="transaction-amount"
                  >
                    Montant
                  </label>
                  <input
                    id="transaction-amount"
                    className="input"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label
                    className="form-label"
                    htmlFor="transaction-label"
                  >
                    Libellé
                  </label>
                  <input
                    id="transaction-label"
                    className="input"
                    placeholder="Ex. Cotisation famille Martin"
                    value={form.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <label
                    className="form-label"
                    htmlFor="transaction-payment"
                  >
                    Mode de paiement
                  </label>
                  <select
                    id="transaction-payment"
                    className="input"
                    value={form.paymentMethod}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentMethod: event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      Non renseigné
                    </option>
                    {paymentMethods.map((method) => (
                      <option
                        key={method.value}
                        value={method.value}
                      >
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="form-label"
                    htmlFor="transaction-note"
                  >
                    Note
                  </label>
                  <input
                    id="transaction-note"
                    className="input"
                    placeholder="Facultatif"
                    value={form.note}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 24,
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
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
    </>
  );
}
