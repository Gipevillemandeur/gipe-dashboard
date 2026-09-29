'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  CreditCard,
  GraduationCap,
  X,
  Pencil,
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
  councilParticipation:
    | 'no'
    | 'child_class'
    | 'all_classes';
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
  councilParticipation:
    | 'no'
    | 'child_class'
    | 'all_classes';
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

  const [members, setMembers] =
    useState<Member[]>([]);

  const [classes, setClasses] =
    useState<ClassItem[]>([]);

  const [schoolYear, setSchoolYear] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [showForm, setShowForm] =
    useState(false);

  const [editingMember, setEditingMember] =
    useState<Member | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [form, setForm] =
    useState<AdherentForm>(emptyForm);


  async function load() {
    setLoading(true);
    setError('');

    try {
      const [
        membersResponse,
        configResponse,
      ] = await Promise.all([
        fetch('/api/adherents', {
          cache: 'no-store',
        }),

        fetch('/api/configuration', {
          cache: 'no-store',
        }),
      ]);

      const membersData =
        await membersResponse.json();

      const configData =
        await configResponse.json();

      if (!membersResponse.ok) {
        throw new Error(
          membersData.error ||
          'Impossible de charger les adhérents.'
        );
      }

      if (!configResponse.ok) {
        throw new Error(
          configData.error ||
          'Impossible de charger les classes.'
        );
      }

      setMembers(
        membersData.members || []
      );

      setSchoolYear(
        membersData.schoolYear || null
      );

      setClasses(
        (configData.classes || []).map(
          (item: any) => ({
            id: item.id,
            name: item.name,
          })
        )
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


  const filteredMembers =
    useMemo(() => {

      const value =
        search.trim().toLowerCase();

      if (!value) {
        return members;
      }

      return members.filter((member) => {

        const childrenText =
          member.children
            .map(
              (child) =>
                `${child.firstName} ${child.lastName} ${child.className}`
            )
            .join(' ');

        return (
          `${member.firstName} ${member.lastName}`
            .toLowerCase()
            .includes(value) ||

          member.email
            .toLowerCase()
            .includes(value) ||

          member.phone
            .toLowerCase()
            .includes(value) ||

          childrenText
            .toLowerCase()
            .includes(value)
        );
      });

    }, [members, search]);


  const byClass =
    useMemo(() => {

      const counts: Record<string, number> = {};

      for (const member of members) {

        for (const child of member.children) {

          if (!child.className) continue;

          counts[child.className] =
            (counts[child.className] || 0) + 1;
        }
      }

      return Object.entries(counts)
        .map(([name, count]) => ({
          name,
          count,
        }))
        .sort((a, b) =>
          a.name.localeCompare(
            b.name,
            'fr',
            { numeric: true }
          )
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

      children:
        current.children.filter(
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

      children:
        current.children.map(
          (child, i) =>
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
      lastName:
        member.lastName,

      firstName:
        member.firstName,

      address:
        member.address || '',

      phone:
        member.phone || '',

      email:
        member.email || '',

      renewal:
        member.renewal,

      councilParticipation:
        member.councilParticipation,

      boardMember:
        member.boardMember,

      caMember:
        member.caMember,

      paymentReceived:
        member.paymentReceived,

      paymentDate:
        member.paymentDate || '',

      paymentMethod:
        member.paymentMethod || '',

      chequeNumber:
        member.chequeNumber || '',

      amount:
        member.amount !== null &&
        member.amount !== undefined
          ? String(member.amount)
          : '',

      children:
        member.children.map(
          (child) => ({
            id: child.id,
            lastName:
              child.lastName,
            firstName:
              child.firstName,
            classId:
              child.classId || '',
          })
        ),
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

      const isEditing =
        Boolean(editingMember);

      const payload = {
        ...form,

        ...(isEditing
          ? {
              id: editingMember?.id,
            }
          : {}),
      };

      const response =
        await fetch('/api/adherents', {
          method:
            isEditing
              ? 'PUT'
              : 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(payload),
        });

      const data =
        await response.json();

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


  function paymentLabel(
    method: string | null
  ) {

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

      <div className="topbar">

        <div>

          <div className="eyebrow">
            Adhérents
          </div>

          <h1>
            Gestion des adhérents
          </h1>

          <div className="kicker">
            Année scolaire{' '}
            {schoolYear || '—'}
          </div>

        </div>


        <div className="topbar-right">

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
        <div
          className="notice notice-error"
          style={{
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      )}


      {/* VIGNETTE DU HAUT — INCHANGÉE */}

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
            gridTemplateColumns:
              '220px 1fr',
            gap: 24,
            alignItems: 'stretch',
          }}
        >

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '8px 12px',
            }}
          >

            <div className="stat-label">
              ADHÉRENTS
            </div>

            <div
              className="stat-value"
              style={{
                fontSize: 42,
                marginTop: 4,
              }}
            >
              {members.length}
            </div>

            <div className="stat-note">
              adhérent
              {members.length > 1
                ? 's'
                : ''}{' '}
              cette année
            </div>

          </div>


          <div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >

              <GraduationCap size={17} />

              <strong>
                Répartition par classe
              </strong>

            </div>


            {byClass.length === 0 ? (

              <div className="kicker">
                Aucun enfant rattaché à une
                classe pour le moment.
              </div>

            ) : (

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >

                {byClass.map((item) => (

                  <span
                    key={item.name}
                    className="badge badge-info"
                    style={{
                      padding:
                        '7px 10px',
                    }}
                  >
                    {item.name} · {item.count}
                  </span>

                ))}

              </div>
            )}

          </div>

        </div>

      </section>


      {/* LISTE DES ADHÉRENTS */}

      <section className="card section-card">

        <div className="section-head">

          <div>

            <h2 className="section-title">
              Liste des adhérents
            </h2>

            <p className="section-sub">
              {filteredMembers.length}{' '}
              adhérent
              {filteredMembers.length > 1
                ? 's'
                : ''}{' '}
              affiché
              {filteredMembers.length > 1
                ? 's'
                : ''}
            </p>

          </div>


          <div
            style={{
              width: 320,
              maxWidth: '100%',
              position: 'relative',
            }}
          >

            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 11,
                top: 11,
                color: '#756a67',
              }}
            />

            <input
              className="input"
              style={{
                paddingLeft: 34,
              }}
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

          <div
            style={{
              textAlign: 'center',
              padding: '42px 20px',
            }}
          >

            <Users
              size={32}
              style={{
                opacity: .35,
              }}
            />

            <h3
              style={{
                margin:
                  '12px 0 4px',
              }}
            >
              Aucun adhérent
            </h3>

            <p className="section-sub">
              Commence par ajouter le
              premier adhérent de l'année.
            </p>

          </div>

        ) : (

          <div
            style={{
              overflowX: 'auto',
            }}
          >

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
                            openEditMember(member)
                          }
                          style={{
                            border: 'none',
                            background:
                              'transparent',
                            padding: 0,
                            margin: 0,
                            cursor: 'pointer',
                            color: '#241c1b',
                            fontWeight: 700,
                            textAlign: 'left',
                            textDecoration:
                              'underline',
                            textDecorationColor:
                              '#d8c8bd',
                            textUnderlineOffset:
                              '3px',
                          }}
                        >
                          {member.lastName}{' '}
                          {member.firstName}
                        </button>


                        <div
                          style={{
                            fontSize: 10,
                            color:
                              '#756a67',
                            marginTop: 3,
                          }}
                        >
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

                          <div
                            style={{
                              display:
                                'grid',
                              gap: 3,
                            }}
                          >

                            {member.children.map(
                              (child, index) => (

                                <span
                                  key={
                                    child.id ||
                                    index
                                  }
                                  style={{
                                    fontSize:
                                      11,
                                  }}
                                >
                                  {child.lastName}{' '}
                                  {child.firstName}

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

                        {member.renewal
                          ? (
                            <span className="badge badge-ok">
                              Oui
                            </span>
                          )
                          : (
                            <span className="badge badge-warn">
                              Non
                            </span>
                          )}

                      </td>


                      <td>

                        {member.paymentReceived
                          ? (
                            <span className="badge badge-ok">

                              <CreditCard
                                size={11}
                              />

                              {paymentLabel(
                                member.paymentMethod
                              )}

                            </span>
                          )
                          : (
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
        )}

      </section>


      {/* FICHE / FORMULAIRE */}

      {showForm && (

        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(36,28,27,.45)',
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >

          <div
            className="card"
            style={{
              width:
                'min(900px, 100%)',
              maxHeight:
                'calc(100vh - 40px)',
              overflowY: 'auto',
              padding: 24,
            }}
          >

            <div
              className="section-head"
            >

              <div>

                <div className="eyebrow">
                  {editingMember
                    ? 'Fiche adhérent'
                    : 'Nouvelle adhésion'}
                </div>

                <h2
                  className="section-title"
                  style={{
                    marginTop: 4,
                  }}
                >
                  {editingMember
                    ? `${editingMember.lastName} ${editingMember.firstName}`
                    : 'Ajouter un adhérent'}
                </h2>

              </div>


              <button
                className="btn"
                onClick={closeForm}
                disabled={saving}
              >
                <X size={15} />
              </button>

            </div>


            <div
              style={{
                display: 'grid',
                gap: 22,
              }}
            >

              {/* INFORMATIONS */}

              <div>

                <h3 className="section-title">
                  Informations adhérent
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '1fr 1fr',
                    gap: 12,
                    marginTop: 12,
                  }}
                >

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


              {/* ENFANTS */}

              <div>

                <div className="section-head">

                  <div>

                    <h3 className="section-title">
                      Enfant(s)
                    </h3>

                    <p className="section-sub">
                      Une même famille peut
                      avoir plusieurs enfants.
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


                {form.children.map(
                  (child, index) => (

                    <div
                      key={
                        child.id ||
                        `new-${index}`
                      }
                      style={{
                        display:
                          'grid',
                        gridTemplateColumns:
                          '1fr 1fr 180px auto',
                        gap: 8,
                        marginBottom: 8,
                      }}
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
                              key={item.id}
                              value={item.id}
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
                          removeChild(index)
                        }
                      >
                        <X size={14} />
                      </button>

                    </div>

                  )
                )}

              </div>


              {/* PARTICIPATION */}

              <div>

                <h3 className="section-title">
                  Participation à la vie du GIPE
                </h3>


                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                    marginTop: 12,
                  }}
                >

                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Souhaite participer aux
                    conseils de classe ?
                  </label>


                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      flexWrap:
                        'wrap',
                    }}
                  >

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


                  <div
                    style={{
                      display:
                        'flex',
                      gap: 20,
                      flexWrap:
                        'wrap',
                    }}
                  >

                    <label>
                      <input
                        type="checkbox"
                        checked={
                          form.renewal
                        }
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


              {/* PAIEMENT */}

              <div>

                <h3 className="section-title">
                  Cotisation / paiement
                </h3>


                <div
                  style={{
                    display:
                      'grid',
                    gridTemplateColumns:
                      '180px 180px 1fr 1fr',
                    gap: 12,
                    marginTop: 12,
                  }}
                >

                  <label
                    style={{
                      fontSize: 12,
                      display:
                        'grid',
                      gap: 6,
                    }}
                  >

                    <span>
                      Paiement
                    </span>

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


                  <label
                    style={{
                      fontSize: 12,
                      display:
                        'grid',
                      gap: 6,
                    }}
                  >

                    <span>
                      Date
                    </span>

                    <input
                      className="input"
                      type="date"
                      value={
                        form.paymentDate
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          paymentDate:
                            e.target.value,
                        })
                      }
                    />

                  </label>


                  <label
                    style={{
                      fontSize: 12,
                      display:
                        'grid',
                      gap: 6,
                    }}
                  >

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


                  <label
                    style={{
                      fontSize: 12,
                      display:
                        'grid',
                      gap: 6,
                    }}
                  >

                    <span>
                      Montant
                    </span>

                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        form.amount
                      }
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

                  <div
                    style={{
                      marginTop: 12,
                      maxWidth: 280,
                    }}
                  >

                    <label
                      style={{
                        fontSize: 12,
                        display:
                          'grid',
                        gap: 6,
                      }}
                    >

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


              {/* BOUTONS */}

              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'flex-end',
                  gap: 8,
                  borderTop:
                    '1px solid #eadfd4',
                  paddingTop: 18,
                }}
              >

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

    </>
  );
}
