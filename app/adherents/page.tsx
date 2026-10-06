'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  CreditCard,
  GraduationCap,
  X,
} from 'lucide-react';

type Child = {
  id?: string;
  lastName: string;
  firstName: string;
  classId?: string;
  className: string;
};

type Member = {
  id: string;
  lastName: string;
  firstName: string;
  address: string;
  phone: string;
  email: string;
  renewal: boolean;
  councilParticipation: 'no' | 'child_class' | 'all_classes';
  boardMember: boolean;
  caMember: boolean;
  paymentReceived: boolean;
  paymentDate: string | null;
  paymentMethod: string | null;
  chequeNumber: string | null;
  amount: number | null;
  children: Child[];
};

type ClassItem = {
  id: string;
  name: string;
};

type FormChild = {
  id?: string;
  lastName: string;
  firstName: string;
  classId: string;
};

type AdherentForm = {
  lastName: string;
  firstName: string;
  address: string;
  phone: string;
  email: string;
  renewal: boolean;
  councilParticipation: 'no' | 'child_class' | 'all_classes';
  boardMember: boolean;
  caMember: boolean;
  paymentReceived: boolean;
  paymentDate: string;
  paymentMethod: string;
  chequeNumber: string;
  amount: string;
  children: FormChild[];
};

const emptyForm: AdherentForm = {
  lastName: '',
  firstName: '',
  address: '',
  phone: '',
  email: '',
  renewal: false,
  councilParticipation: 'no',
  boardMember: false,
  caMember: false,
  paymentReceived: false,
  paymentDate: '',
  paymentMethod: '',
  chequeNumber: '',
  amount: '',
  children: [],
};

export default function AdherentsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AdherentForm>(emptyForm);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [membersResponse, configResponse] = await Promise.all([
        fetch('/api/adherents', { cache: 'no-store' }),
        fetch('/api/configuration', { cache: 'no-store' }),
      ]);

      const membersData = await membersResponse.json();
      const configData = await configResponse.json();

      if (!membersResponse.ok) {
        throw new Error(
          membersData.error || 'Impossible de charger les adhérents.'
        );
      }

      if (!configResponse.ok) {
        throw new Error(
          configData.error || 'Impossible de charger les classes.'
        );
      }

      setMembers(membersData.members || []);
      setSchoolYear(membersData.schoolYear || null);

      setClasses(
        (configData.classes || []).map((item: any) => ({
          id: item.id,
          name: item.name,
        }))
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de charger les données.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredMembers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return members;

    return members.filter((member) => {
      const childrenText = member.children
        .map(
          (child) =>
            `${child.firstName} ${child.lastName} ${child.className}`
        )
        .join(' ');

      return (
        `${member.firstName} ${member.lastName}`
          .toLowerCase()
          .includes(value) ||
        member.email.toLowerCase().includes(value) ||
        member.phone.toLowerCase().includes(value) ||
        childrenText.toLowerCase().includes(value)
      );
    });
  }, [members, search]);

  const byClass = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const member of members) {
      for (const child of member.children) {
        if (!child.className) continue;

        counts[child.className] =
          (counts[child.className] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', {
          numeric: true,
        })
      );
  }, [members]);

  function addChild() {
    setForm((current) => ({
      ...current,
      children: [
        ...current.children,
        {
          lastName: '',
          firstName: '',
          classId: '',
        },
      ],
    }));
  }

  function removeChild(index: number) {
    setForm((current) => ({
      ...current,
      children: current.children.filter(
        (_, i) => i !== index
      ),
    }));
  }

  function updateChild(
    index: number,
    field: keyof FormChild,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      children: current.children.map((child, i) =>
        i === index
          ? {
              ...child,
              [field]: value,
            }
          : child
      ),
    }));
  }

  function openNewMember() {
    setEditingMember(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function openEditMember(member: Member) {
    setEditingMember(member);

    setForm({
      lastName: member.lastName,
      firstName: member.firstName,
      address: member.address || '',
      phone: member.phone || '',
      email: member.email || '',
      renewal: member.renewal,
      councilParticipation:
        member.councilParticipation,
      boardMember: member.boardMember,
      caMember: member.caMember,
      paymentReceived: member.paymentReceived,
      paymentDate: member.paymentDate || '',
      paymentMethod: member.paymentMethod || '',
      chequeNumber: member.chequeNumber || '',
      amount:
        member.amount !== null &&
        member.amount !== undefined
          ? String(member.amount)
          : '',
      children: member.children.map((child) => ({
        id: child.id,
        lastName: child.lastName,
        firstName: child.firstName,
        classId: child.classId || '',
      })),
    });

    setError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingMember(null);
    setForm(emptyForm);
  }

  async function saveMember() {
    setSaving(true);
    setError('');

    try {
      const isEditing = Boolean(editingMember);

      const payload = {
        ...form,
        ...(isEditing
          ? {
              id: editingMember?.id,
            }
          : {}),
      };

      const response = await fetch(
        '/api/adherents',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible d’enregistrer l’adhérent.'
        );
      }

      setShowForm(false);
      setEditingMember(null);
      setForm(emptyForm);

      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible d’enregistrer l’adhérent.'
      );
    } finally {
      setSaving(false);
    }
  }

  function paymentLabel(method: string | null) {
    switch (method) {
      case 'cheque':
        return 'Chèque';
      case 'cash':
        return 'Espèces';
      case 'transfer':
        return 'Virement';
      case 'online':
        return 'Paiement en ligne';
      case 'other':
        return 'Autre';
      default:
        return '—';
    }
  }

  function councilLabel(
    value: Member['councilParticipation']
  ) {
    switch (value) {
      case 'child_class':
        return 'Classe enfant';
      case 'all_classes':
        return 'Toute classe';
      default:
        return 'Non';
    }
  }

  return (
    <>
      <div className="topbar adherents-topbar">
        <div>
          <div className="eyebrow">Adhérents</div>

          <h1>Gestion des adhérents</h1>

          <div className="kicker">
            Année scolaire {schoolYear || '—'}
          </div>
        </div>

        <div className="topbar-right adherents-topbar-action">
          <button
            className="btn btn-primary"
            onClick={openNewMember}
          >
            <Plus size={14} />
            Ajouter un adhérent
          </button>
        </div>
      </div>

      {error && (
        <div className="notice notice-error adherents-error">
          {error}
        </div>
      )}

      <section className="card adherents-summary">
        <div className="adherents-summary-grid">
          <div className="adherents-stat">
            <div className="stat-label">
              ADHÉRENTS
            </div>

            <div className="stat-value">
              {members.length}
            </div>

            <div className="stat-note">
              adhérent
              {members.length > 1 ? 's' : ''} cette
              année
            </div>
          </div>

          <div>
            <div className="adherents-class-title">
              <GraduationCap size={17} />
              <strong>
                Répartition par classe
              </strong>
            </div>

            {byClass.length === 0 ? (
              <div className="kicker">
                Aucun enfant rattaché à une classe
                pour le moment.
              </div>
            ) : (
              <div className="adherents-class-list">
                {byClass.map((item) => (
                  <span
                    key={item.name}
                    className="badge badge-info adherents-class-badge"
                  >
                    {item.name} · {item.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head adherents-list-head">
          <div>
            <h2 className="section-title">
              Liste des adhérents
            </h2>

            <p className="section-sub">
              {filteredMembers.length} adhérent
              {filteredMembers.length > 1
                ? 's'
                : ''}{' '}
              affiché
              {filteredMembers.length > 1
                ? 's'
                : ''}
            </p>
          </div>

          <div className="adherents-search">
            <Search
              className="adherents-search-icon"
              size={15}
            />

            <input
              className="input"
              placeholder="Rechercher un nom, enfant, classe..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>
        </div>

        {loading ? (
          <p className="kicker">
            Chargement des adhérents…
          </p>
        ) : filteredMembers.length === 0 ? (
          <div className="adherents-empty">
            <Users
              size={32}
              style={{ opacity: 0.35 }}
            />

            <h3>Aucun adhérent</h3>

            <p className="section-sub">
              Commence par ajouter le premier
              adhérent de l'année.
            </p>
          </div>
        ) : (
          <>
            <div className="adherents-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Adhérent</th>
                    <th>Enfant(s)</th>
                    <th>Conseils</th>
                    <th>Renouvellement</th>
                    <th>Paiement</th>
                    <th>Bureau</th>
                    <th>CA</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMembers.map(
                    (member) => (
                      <tr key={member.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              openEditMember(
                                member
                              )
                            }
                            className="adherent-name-button"
                          >
                            {member.lastName}{' '}
                            {member.firstName}
                          </button>

                          <div className="adherent-contact">
                            {member.phone ||
                              member.email ||
                              '—'}
                          </div>
                        </td>

                        <td>
                          {member.children.length ===
                          0 ? (
                            '—'
                          ) : (
                            <div className="adherent-children-list">
                              {member.children.map(
                                (
                                  child,
                                  index
                                ) => (
                                  <span
                                    key={
                                      child.id ||
                                      index
                                    }
                                  >
                                    {
                                      child.lastName
                                    }{' '}
                                    {
                                      child.firstName
                                    }

                                    {child.className
                                      ? ` · ${child.className}`
                                      : ''}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className="badge badge-info">
                            {councilLabel(
                              member.councilParticipation
                            )}
                          </span>
                        </td>

                        <td>
                          {member.renewal ? (
                            <span className="badge badge-ok">
                              Oui
                            </span>
                          ) : (
                            <span className="badge badge-warn">
                              Non
                            </span>
                          )}
                        </td>

                        <td>
                          {member.paymentReceived ? (
                            <span className="badge badge-ok">
                              <CreditCard size={11} />

                              {paymentLabel(
                                member.paymentMethod
                              )}
                            </span>
                          ) : (
                            <span className="badge badge-warn">
                              À payer
                            </span>
                          )}
                        </td>

                        <td>
                          {member.boardMember
                            ? '✓'
                            : '—'}
                        </td>

                        <td>
                          {member.caMember
                            ? '✓'
                            : '—'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="adherents-mobile-list">
              {filteredMembers.map(
                (member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="adherent-mobile-card"
                    onClick={() =>
                      openEditMember(member)
                    }
                  >
                    <div className="adherent-mobile-card-head">
                      <div>
                        <strong>
                          {member.lastName}{' '}
                          {member.firstName}
                        </strong>

                        <span>
                          {member.phone ||
                            member.email ||
                            'Aucun contact'}
                        </span>
                      </div>

                      <span className="adherent-mobile-edit">
                        Modifier
                      </span>
                    </div>

                    <div className="adherent-mobile-children">
                      <span className="adherent-mobile-label">
                        Enfant(s)
                      </span>

                      {member.children.length ===
                      0 ? (
                        <span>—</span>
                      ) : (
                        member.children.map(
                          (child, index) => (
                            <span
                              key={
                                child.id ||
                                index
                              }
                            >
                              {child.lastName}{' '}
                              {child.firstName}

                              {child.className
                                ? ` · ${child.className}`
                                : ''}
                            </span>
                          )
                        )
                      )}
                    </div>

                    <div className="adherent-mobile-badges">
                      <span className="badge badge-info">
                        Conseils :{' '}
                        {councilLabel(
                          member.councilParticipation
                        )}
                      </span>

                      <span
                        className={
                          member.renewal
                            ? 'badge badge-ok'
                            : 'badge badge-warn'
                        }
                      >
                        Renouvellement :{' '}
                        {member.renewal
                          ? 'Oui'
                          : 'Non'}
                      </span>

                      <span
                        className={
                          member.paymentReceived
                            ? 'badge badge-ok'
                            : 'badge badge-warn'
                        }
                      >
                        Paiement :{' '}
                        {member.paymentReceived
                          ? paymentLabel(
                              member.paymentMethod
                            )
                          : 'À payer'}
                      </span>

                      {member.boardMember && (
                        <span className="badge badge-info">
                          Bureau
                        </span>
                      )}

                      {member.caMember && (
                        <span className="badge badge-info">
                          CA
                        </span>
                      )}
                    </div>
                  </button>
                )
              )}
            </div>
          </>
        )}
      </section>

      {showForm && (
        <div className="adherents-modal-backdrop">
          <div className="card adherents-modal">
            <div className="section-head adherents-modal-head">
              <div>
                <div className="eyebrow">
                  {editingMember
                    ? 'Fiche adhérent'
                    : 'Nouvelle adhésion'}
                </div>

                <h2 className="section-title">
                  {editingMember
                    ? `${editingMember.lastName} ${editingMember.firstName}`
                    : 'Ajouter un adhérent'}
                </h2>
              </div>

              <button
                className="btn"
                onClick={closeForm}
                disabled={saving}
                type="button"
              >
                <X size={15} />
              </button>
            </div>

            <div className="adherents-form">
              <div>
                <h3 className="section-title">
                  Informations adhérent
                </h3>

                <div className="adherents-fields-grid">
                  <input
                    className="input"
                    placeholder="Nom *"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        lastName:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Prénom *"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        firstName:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Adresse"
                    value={form.address}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Téléphone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        phone:
                          e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Mail"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email:
                          e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <div className="section-head adherents-subsection-head">
                  <div>
                    <h3 className="section-title">
                      Enfant(s)
                    </h3>

                    <p className="section-sub">
                      Une même famille peut avoir
                      plusieurs enfants.
                    </p>
                  </div>

                  <button
                    className="btn"
                    onClick={addChild}
                    type="button"
                  >
                    <Plus size={14} />
                    Ajouter un enfant
                  </button>
                </div>

                {form.children.length === 0 && (
                  <p className="kicker">
                    Aucun enfant renseigné.
                  </p>
                )}

                <div className="adherents-children-form">
                  {form.children.map(
                    (child, index) => (
                      <div
                        key={
                          child.id ||
                          `new-${index}`
                        }
                        className="adherents-child-row"
                      >
                        <input
                          className="input"
                          placeholder="Nom"
                          value={
                            child.lastName
                          }
                          onChange={(e) =>
                            updateChild(
                              index,
                              'lastName',
                              e.target.value
                            )
                          }
                        />

                        <input
                          className="input"
                          placeholder="Prénom"
                          value={
                            child.firstName
                          }
                          onChange={(e) =>
                            updateChild(
                              index,
                              'firstName',
                              e.target.value
                            )
                          }
                        />

                        <select
                          className="select"
                          value={
                            child.classId
                          }
                          onChange={(e) =>
                            updateChild(
                              index,
                              'classId',
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            Classe
                          </option>

                          {classes.map(
                            (item) => (
                              <option
                                key={
                                  item.id
                                }
                                value={
                                  item.id
                                }
                              >
                                {item.name}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          className="btn"
                          type="button"
                          title="Supprimer"
                          onClick={() =>
                            removeChild(
                              index
                            )
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div>
                <h3 className="section-title">
                  Participation à la vie du GIPE
                </h3>

                <div className="adherents-participation">
                  <label className="adherents-label">
                    Souhaite participer aux conseils
                    de classe ?
                  </label>

                  <div className="adherents-radio-group">
                    <label>
                      <input
                        type="radio"
                        name="council"
                        checked={
                          form.councilParticipation ===
                          'no'
                        }
                        onChange={() =>
                          setForm({
                            ...form,
                            councilParticipation:
                              'no',
                          })
                        }
                      />{' '}
                      Non
                    </label>

                    <label>
                      <input
                        type="radio"
                        name="council"
                        checked={
                          form.councilParticipation ===
                          'child_class'
                        }
                        onChange={() =>
                          setForm({
                            ...form,
                            councilParticipation:
                              'child_class',
                          })
                        }
                      />{' '}
                      Classe de mon enfant
                    </label>

                    <label>
                      <input
                        type="radio"
                        name="council"
                        checked={
                          form.councilParticipation ===
                          'all_classes'
                        }
                        onChange={() =>
                          setForm({
                            ...form,
                            councilParticipation:
                              'all_classes',
                          })
                        }
                      />{' '}
                      Toute classe
                    </label>
                  </div>

                  <div className="adherents-checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.renewal}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            renewal:
                              e.target.checked,
                          })
                        }
                      />{' '}
                      Renouvellement
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={
                          form.boardMember
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            boardMember:
                              e.target.checked,
                          })
                        }
                      />{' '}
                      Membre du bureau
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={
                          form.caMember
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            caMember:
                              e.target.checked,
                          })
                        }
                      />{' '}
                      Membre du CA
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="section-title">
                  Cotisation / paiement
                </h3>

                <div className="adherents-payment-grid">
                  <label className="adherents-field-label">
                    <span>Paiement</span>

                    <select
                      className="select"
                      value={
                        form.paymentReceived
                          ? 'yes'
                          : 'no'
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          paymentReceived:
                            e.target.value ===
                            'yes',
                        })
                      }
                    >
                      <option value="no">
                        Non payé
                      </option>

                      <option value="yes">
                        Payé
                      </option>
                    </select>
                  </label>

                  <label className="adherents-field-label">
                    <span>Date</span>

                    <input
  className={`input adherents-date-input ${
    !form.paymentDate
      ? 'adherents-date-input-empty'
      : ''
  }`}
  type="date"
  value={form.paymentDate}
  onChange={(e) =>
    setForm({
      ...form,
      paymentDate: e.target.value,
    })
  }
/>
                  </label>

                  <label className="adherents-field-label">
                    <span>
                      Mode de paiement
                    </span>

                    <select
                      className="select"
                      value={
                        form.paymentMethod
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          paymentMethod:
                            e.target.value,
                          chequeNumber:
                            e.target.value ===
                            'cheque'
                              ? form.chequeNumber
                              : '',
                        })
                      }
                    >
                      <option value="">
                        Choisir
                      </option>

                      <option value="cheque">
                        Chèque
                      </option>

                      <option value="cash">
                        Espèces
                      </option>

                      <option value="transfer">
                        Virement
                      </option>

                      <option value="online">
                        Paiement en ligne
                      </option>

                      <option value="other">
                        Autre
                      </option>
                    </select>
                  </label>

                  <label className="adherents-field-label">
                    <span>Montant</span>

                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          amount:
                            e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                {form.paymentMethod ===
                  'cheque' && (
                  <div className="adherents-cheque-field">
                    <label className="adherents-field-label">
                      <span>
                        Numéro de chèque
                      </span>

                      <input
                        className="input"
                        value={
                          form.chequeNumber
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            chequeNumber:
                              e.target.value,
                          })
                        }
                        placeholder="N° du chèque"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="adherents-form-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Annuler
                </button>

                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={saveMember}
                  disabled={saving}
                >
                  {saving
                    ? 'Enregistrement…'
                    : editingMember
                      ? 'Enregistrer les modifications'
                      : 'Enregistrer l’adhérent'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .adherents-error {
          margin-bottom: 18px;
        }

        .adherents-summary {
          padding: 22px;
          margin-bottom: 18px;
        }

        .adherents-summary-grid {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 24px;
          align-items: stretch;
        }

        .adherents-stat {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 8px 12px;
        }

        .adherents-class-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .adherents-class-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .adherents-class-badge {
          padding: 7px 10px;
        }

        .adherents-search {
          width: 320px;
          max-width: 100%;
          position: relative;
        }

        .adherents-search-icon {
          position: absolute;
          left: 11px;
          top: 11px;
          color: #756a67;
          pointer-events: none;
        }

        .adherents-search .input {
          padding-left: 34px;
        }

        .adherents-table-wrap {
          overflow-x: auto;
        }

        .adherents-mobile-list {
          display: none;
        }

        .adherent-name-button {
          border: none;
          background: transparent;
          padding: 0;
          margin: 0;
          cursor: pointer;
          color: #241c1b;
          font-weight: 700;
          text-align: left;
          text-decoration: underline;
          text-decoration-color: #d8c8bd;
          text-underline-offset: 3px;
        }

        .adherent-contact {
          font-size: 10px;
          color: #756a67;
          margin-top: 3px;
        }

        .adherent-children-list {
          display: grid;
          gap: 3px;
        }

        .adherent-children-list span {
          font-size: 11px;
        }

        .adherents-empty {
          text-align: center;
          padding: 42px 20px;
        }

        .adherents-empty h3 {
          margin: 12px 0 4px;
        }

        .adherents-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(36, 28, 27, 0.45);
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .adherents-modal {
          width: min(900px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          padding: 24px;
        }

        .adherents-form {
          display: grid;
          gap: 22px;
        }

        .adherents-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }

        .adherents-subsection-head {
          margin-bottom: 10px;
        }

        .adherents-children-form {
          display: grid;
          gap: 8px;
        }

        .adherents-child-row {
          display: grid;
          grid-template-columns: 1fr 1fr 180px auto;
          gap: 8px;
        }

        .adherents-participation {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }

        .adherents-label {
          font-size: 12px;
          font-weight: 700;
        }

        .adherents-radio-group,
        .adherents-checkbox-group {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .adherents-checkbox-group {
          gap: 20px;
        }

        .adherents-payment-grid {
          display: grid;
          grid-template-columns: 180px 180px 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
          min-width: 0;
        }

        .adherents-field-label {
          font-size: 12px;
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .adherents-date-input {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .adherents-cheque-field {
          margin-top: 12px;
          max-width: 280px;
        }

        .adherents-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          border-top: 1px solid #eadfd4;
          padding-top: 18px;
        }

        .adherent-mobile-card {
          width: 100%;
          border: 1px solid #eadfd4;
          background: #fff;
          border-radius: 12px;
          padding: 14px;
          text-align: left;
          color: #241c1b;
          cursor: pointer;
          display: grid;
          gap: 12px;
        }

        .adherent-mobile-card-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .adherent-mobile-card-head > div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .adherent-mobile-card-head strong {
          font-size: 14px;
        }

        .adherent-mobile-card-head span {
          font-size: 10px;
          color: #756a67;
          overflow-wrap: anywhere;
        }

        .adherent-mobile-edit {
          flex: 0 0 auto;
          font-size: 10px !important;
          font-weight: 700;
          color: #756a67 !important;
        }

        .adherent-mobile-children {
          display: grid;
          gap: 3px;
          font-size: 11px;
        }

        .adherent-mobile-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
          color: #756a67;
          margin-bottom: 2px;
        }

        .adherent-mobile-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        @media (max-width: 760px) {
          .adherents-topbar {
            align-items: flex-start;
          }

          .adherents-topbar-action {
            width: auto;
          }

          .adherents-topbar-action .btn {
            width: auto;
            justify-content: center;
            white-space: nowrap;
          }

          .adherents-summary {
            padding: 16px;
          }

          .adherents-summary-grid {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .adherents-stat {
            padding: 0;
          }

          .adherents-list-head {
            display: grid;
            gap: 14px;
          }

          .adherents-search {
            width: 100%;
          }

          .adherents-table-wrap {
            display: none;
          }

          .adherents-mobile-list {
            display: grid;
            gap: 10px;
          }

          .adherents-modal-backdrop {
            padding: 8px;
            place-items: start center;
          }

          .adherents-modal {
            width: 100%;
            max-height: calc(100vh - 16px);
            padding: 18px;
            border-radius: 12px;
          }

          .adherents-modal-head {
            align-items: flex-start;
          }

          .adherents-fields-grid {
            grid-template-columns: 1fr;
          }

          .adherents-subsection-head {
            display: grid;
            gap: 10px;
          }

          .adherents-subsection-head .btn {
            width: 100%;
            justify-content: center;
          }

          .adherents-child-row {
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 10px;
            border: 1px solid #eadfd4;
            border-radius: 10px;
          }

          .adherents-child-row .btn {
            width: 100%;
            justify-content: center;
          }

          .adherents-radio-group,
          .adherents-checkbox-group {
            display: grid;
            gap: 10px;
          }

          .adherents-payment-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .adherents-date-input {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            display: block !important;
            -webkit-appearance: none !important;
            appearance: none !important;
          }

          .adherents-cheque-field {
            max-width: none;
          }

          .adherents-form-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .adherents-form-actions .btn {
            width: 100%;
            justify-content: center;
          }
        }

        @media (min-width: 761px) and (max-width: 1050px) {
          .adherents-payment-grid {
            grid-template-columns: 1fr 1fr;
          }

          .adherents-child-row {
            grid-template-columns: 1fr 1fr 180px auto;
          }
        }

        @media (max-width: 480px) {
          .adherents-summary {
            padding: 14px;
          }

          .adherents-modal {
            padding: 15px;
          }

          .adherent-mobile-card {
            padding: 12px;
          }
        }
      `}</style>
    </>
  );
}
