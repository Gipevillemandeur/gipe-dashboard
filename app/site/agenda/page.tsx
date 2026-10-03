'use client';

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  CalendarDays,
  ImagePlus,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

type EventItem = {
  id: string | number;
  title: string | null;
  description: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  image_url: string | null;
  category: string | null;
};

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return '—';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('fr-FR');
}

function excerpt(value: string | null) {
  const text = value || '';

  if (text.length <= 140) {
    return text;
  }

  return `${text.slice(0, 140)}…`;
}

export default function SiteAgendaPage() {
  const [events, setEvents] =
    useState<EventItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | number | null>(null);

  const [error, setError] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | number | null>(null);

  const [title, setTitle] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [date, setDate] =
    useState(today());

  const [time, setTime] =
    useState('');

  const [location, setLocation] =
    useState('');

  const [category, setCategory] =
    useState('');

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [currentImage, setCurrentImage] =
    useState<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  async function loadEvents() {
    setLoading(true);
    setError('');

    try {
      const response =
        await fetch(
          '/api/site/agenda',
          {
            cache: 'no-store',
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger l’agenda.'
        );
      }

      setEvents(data.events || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger l’agenda.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  const filteredEvents =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return events;
      }

      return events.filter((item) =>
        [
          item.title || '',
          item.description || '',
          item.location || '',
          item.category || '',
          item.date || '',
          item.time || '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(value)
      );
    }, [events, search]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDate(today());
    setTime('');
    setLocation('');
    setCategory('');
    setImageFile(null);
    setCurrentImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function openNew() {
    resetForm();
    setError('');
    setShowForm(true);
  }

  function openEdit(item: EventItem) {
    setEditingId(item.id);
    setTitle(item.title || '');
    setDescription(item.description || '');
    setDate(
      item.date
        ? item.date.slice(0, 10)
        : today()
    );
    setTime(item.time || '');
    setLocation(item.location || '');
    setCategory(item.category || '');
    setImageFile(null);
    setCurrentImage(item.image_url || null);
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    resetForm();
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError('');

    try {
      const formData =
        new FormData();

      formData.set('title', title);
      formData.set(
        'description',
        description
      );
      formData.set('date', date);
      formData.set('time', time);
      formData.set(
        'location',
        location
      );
      formData.set(
        'category',
        category
      );

      if (imageFile) {
        formData.set(
          'imageFile',
          imageFile
        );
      }

      let response: Response;

      if (editingId !== null) {
        formData.set(
          'id',
          String(editingId)
        );

        formData.set(
          'keepImage',
          imageFile
            ? 'false'
            : 'true'
        );

        response =
          await fetch(
            '/api/site/agenda',
            {
              method: 'PUT',
              body: formData,
            }
          );
      } else {
        response =
          await fetch(
            '/api/site/agenda',
            {
              method: 'POST',
              body: formData,
            }
          );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible d’enregistrer l’événement.'
        );
      }

      await loadEvents();

      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer l’événement.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(
    item: EventItem
  ) {
    if (deletingId !== null) return;

    const confirmed =
      window.confirm(
        `Supprimer l’événement « ${
          item.title || 'Sans titre'
        } » ?\n\nCette action est irréversible.`
      );

    if (!confirmed) return;

    setDeletingId(item.id);
    setError('');

    try {
      const response =
        await fetch(
          '/api/site/agenda',
          {
            method: 'DELETE',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              id: String(item.id),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de supprimer l’événement.'
        );
      }

      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer l’événement.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Site internet
          </div>

          <h1>Agenda</h1>

          <div className="kicker">
            Gestion des événements publiés
            sur gipevillemandeur.com.
          </div>
        </div>

        <div className="topbar-right">
          <button
            className="btn btn-primary"
            type="button"
            onClick={openNew}
          >
            <Plus size={15} />
            Nouvel événement
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

      <section className="card section-card">
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Événements
            </h2>

            <p className="section-sub">
              {events.length}{' '}
              événement
              {events.length > 1
                ? 's'
                : ''}{' '}
              actuellement enregistré
              {events.length > 1
                ? 's'
                : ''}.
            </p>
          </div>

          <div
            style={{
              width: 280,
              maxWidth: '100%',
            }}
          >
            <div
              style={{
                position: 'relative',
              }}
            >
              <Search
                size={15}
                style={{
                  position:
                    'absolute',
                  left: 11,
                  top: '50%',
                  transform:
                    'translateY(-50%)',
                  color:
                    'var(--gipe-muted)',
                }}
              />

              <input
                className="input"
                style={{
                  paddingLeft: 34,
                }}
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Rechercher un événement..."
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="list-item">
            <div className="item-main">
              <strong>
                Chargement…
              </strong>

              <span>
                Récupération de l’agenda.
              </span>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="list-item">
            <div className="item-main">
              <strong>
                Aucun événement trouvé.
              </strong>

              <span>
                {search
                  ? 'Essaie une autre recherche.'
                  : 'Aucun événement n’est encore enregistré.'}
              </span>
            </div>
          </div>
        ) : (
          <div className="list">
            {filteredEvents.map(
              (item) => (
                <div
                  className="list-item"
                  key={String(item.id)}
                  style={{
                    alignItems:
                      'flex-start',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 14,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={
                          item.image_url
                        }
                        alt={
                          item.title ||
                          'Événement'
                        }
                        style={{
                          width: 74,
                          height: 74,
                          objectFit:
                            'cover',
                          borderRadius: 10,
                          border:
                            '1px solid var(--gipe-line)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 74,
                          height: 74,
                          borderRadius: 10,
                          border:
                            '1px solid var(--gipe-line)',
                          display: 'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          color:
                            'var(--gipe-muted)',
                          flexShrink: 0,
                        }}
                      >
                        <CalendarDays
                          size={25}
                        />
                      </div>
                    )}

                    <div
                      className="item-main"
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <strong>
                        {item.title ||
                          'Sans titre'}
                      </strong>

                      <span>
                        {formatDate(
                          item.date
                        )}

                        {item.time
                          ? ` · ${item.time}`
                          : ''}

                        {item.location
                          ? ` · ${item.location}`
                          : ''}
                      </span>

                      {item.category && (
                        <span>
                          Catégorie :{' '}
                          {item.category}
                        </span>
                      )}

                      {item.description && (
                        <span
                          style={{
                            marginTop: 4,
                          }}
                        >
                          {excerpt(
                            item.description
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        openEdit(item)
                      }
                    >
                      <Pencil size={14} />
                      Modifier
                    </button>

                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        deleteEvent(item)
                      }
                      disabled={
                        deletingId ===
                        item.id
                      }
                    >
                      <Trash2 size={14} />
                      {deletingId ===
                      item.id
                        ? 'Suppression…'
                        : 'Supprimer'}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(15, 23, 42, 0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
  className="card"
  style={{
    width: 'min(760px, 100%)',
    maxHeight:
      'calc(100vh - 40px)',
    overflowY: 'auto',
    padding: 24,
  }}
>
            <div
              className="section-head"
              style={{
                marginBottom: 20,
              }}
            >
              <div>
                <div className="eyebrow">
                  Site internet
                </div>

                <h2 className="section-title">
                  {editingId !== null
                    ? 'Modifier l’événement'
                    : 'Nouvel événement'}
                </h2>
              </div>

              <button
                className="btn"
                type="button"
                onClick={closeForm}
                disabled={saving}
              >
                <X size={15} />
                Fermer
              </button>
            </div>

            <form onSubmit={submit}>
              <div
                style={{
                  display: 'grid',
                  gap: 16,
                }}
              >
                <div>
                  <label className="label">
                    Titre
                  </label>

                  <input
                    className="input"
                    value={title}
                    onChange={(e) =>
                      setTitle(
                        e.target.value
                      )
                    }
                    required
                    maxLength={200}
                    placeholder="Titre de l’événement"
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(2, minmax(0, 1fr))',
                    gap: 16,
                  }}
                >
                  <div>
                    <label className="label">
                      Date
                    </label>

                    <input
                      className="input"
                      type="date"
                      value={date}
                      onChange={(e) =>
                        setDate(
                          e.target.value
                        )
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      Heure
                    </label>

                    <input
                      className="input"
                      type="time"
                      value={time}
                      onChange={(e) =>
                        setTime(
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(2, minmax(0, 1fr))',
                    gap: 16,
                  }}
                >
                  <div>
                    <label className="label">
                      Lieu
                    </label>

                    <div
                      style={{
                        position:
                          'relative',
                      }}
                    >
                      <MapPin
                        size={15}
                        style={{
                          position:
                            'absolute',
                          left: 11,
                          top: '50%',
                          transform:
                            'translateY(-50%)',
                          color:
                            'var(--gipe-muted)',
                        }}
                      />

                      <input
                        className="input"
                        style={{
                          paddingLeft: 34,
                        }}
                        value={location}
                        onChange={(e) =>
                          setLocation(
                            e.target.value
                          )
                        }
                        placeholder="Lieu de l’événement"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">
                      Catégorie
                    </label>

                    <input
                      className="input"
                      value={category}
                      onChange={(e) =>
                        setCategory(
                          e.target.value
                        )
                      }
                      placeholder="Ex. Réunion, Sortie, GIPE..."
                    />
                  </div>
                </div>

                <div>
                  <label className="label">
                    Description
                  </label>

                  <textarea
                    className="input"
                    value={description}
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                    rows={7}
                    placeholder="Description de l’événement..."
                    style={{
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div>
                  <label className="label">
                    Image
                  </label>

                  {currentImage && (
                    <div
                      style={{
                        marginBottom: 12,
                      }}
                    >
                      <img
                        src={currentImage}
                        alt="Image actuelle"
                        style={{
                          width: 180,
                          height: 120,
                          objectFit:
                            'cover',
                          borderRadius: 10,
                          border:
                            '1px solid var(--gipe-line)',
                        }}
                      />
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems:
                        'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setImageFile(
                          e.target.files?.[0] ||
                            null
                        )
                      }
                    />

                    <span
                      style={{
                        color:
                          'var(--gipe-muted)',
                        fontSize: 13,
                      }}
                    >
                      Image de 8 Mo maximum.
                    </span>
                  </div>

                  {imageFile && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                      }}
                    >
                      Nouvelle image :{' '}
                      <strong>
                        {imageFile.name}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div
                  className="notice notice-error"
                  style={{
                    marginTop: 18,
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'flex-end',
                  gap: 10,
                  marginTop: 24,
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
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Enregistrement…'
                    : editingId !== null
                      ? 'Enregistrer les modifications'
                      : 'Publier l’événement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
