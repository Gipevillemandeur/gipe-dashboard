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
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}

function excerpt(value: string | null) {
  const text = value || '';
  return text.length <= 140 ? text : `${text.slice(0, 140)}…`;
}

export default function SiteAgendaPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadEvents() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/site/agenda', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de charger l’agenda.');
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

  const filteredEvents = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return events;

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
    setDate(item.date ? item.date.slice(0, 10) : today());
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const formData = new FormData();
      formData.set('title', title);
      formData.set('description', description);
      formData.set('date', date);
      formData.set('time', time);
      formData.set('location', location);
      formData.set('category', category);

      if (imageFile) {
        formData.set('imageFile', imageFile);
      }

      let response: Response;

      if (editingId !== null) {
        formData.set('id', String(editingId));
        formData.set('keepImage', imageFile ? 'false' : 'true');

        response = await fetch('/api/site/agenda', {
          method: 'PUT',
          body: formData,
        });
      } else {
        response = await fetch('/api/site/agenda', {
          method: 'POST',
          body: formData,
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Impossible d’enregistrer l’événement.'
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

  async function deleteEvent(item: EventItem) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Supprimer l’événement « ${item.title || 'Sans titre'} » ?\n\nCette action est irréversible.`
    );

    if (!confirmed) return;

    setDeletingId(item.id);
    setError('');

    try {
      const response = await fetch('/api/site/agenda', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: String(item.id) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Impossible de supprimer l’événement.'
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
      <div className="topbar agenda-topbar">
        <div>
          <div className="eyebrow">Site internet</div>
          <h1>Agenda</h1>
          <div className="kicker">
            Gestion des événements publiés sur gipevillemandeur.com.
          </div>
        </div>

        <div className="topbar-right">
          <button className="btn btn-primary" type="button" onClick={openNew}>
            <Plus size={15} />
            Nouvel événement
          </button>
        </div>
      </div>

      {error && (
        <div className="notice notice-error agenda-error">
          {error}
        </div>
      )}

      <section className="card section-card agenda-card">
        <div className="section-head agenda-section-head">
          <div>
            <h2 className="section-title">Événements</h2>
            <p className="section-sub">
              {events.length} événement{events.length > 1 ? 's' : ''}{' '}
              actuellement enregistré{events.length > 1 ? 's' : ''}.
            </p>
          </div>

          <div className="agenda-search">
            <div className="agenda-search-wrap">
              <Search size={15} />
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un événement..."
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="list-item">
            <div className="item-main">
              <strong>Chargement…</strong>
              <span>Récupération de l’agenda.</span>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="list-item">
            <div className="item-main">
              <strong>Aucun événement trouvé.</strong>
              <span>
                {search
                  ? 'Essaie une autre recherche.'
                  : 'Aucun événement n’est encore enregistré.'}
              </span>
            </div>
          </div>
        ) : (
          <div className="list">
            {filteredEvents.map((item) => (
              <div
                className="list-item agenda-list-item"
                key={String(item.id)}
              >
                <div className="agenda-event-main">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title || 'Événement'}
                      className="agenda-event-image"
                    />
                  ) : (
                    <div className="agenda-event-placeholder">
                      <CalendarDays size={25} />
                    </div>
                  )}

                  <div className="item-main agenda-event-text">
                    <strong>{item.title || 'Sans titre'}</strong>

                    <span>
                      {formatDate(item.date)}
                      {item.time ? ` · ${item.time}` : ''}
                      {item.location ? ` · ${item.location}` : ''}
                    </span>

                    {item.category && (
                      <span>Catégorie : {item.category}</span>
                    )}

                    {item.description && (
                      <span className="agenda-excerpt">
                        {excerpt(item.description)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="agenda-item-actions">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil size={14} />
                    Modifier
                  </button>

                  <button
                    className="btn"
                    type="button"
                    onClick={() => void deleteEvent(item)}
                    disabled={deletingId === item.id}
                  >
                    <Trash2 size={14} />
                    {deletingId === item.id ? 'Suppression…' : 'Supprimer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="agenda-modal-backdrop" role="dialog" aria-modal="true">
          <div className="card agenda-modal-card">
            <div className="section-head agenda-modal-head">
              <div>
                <div className="eyebrow">Site internet</div>
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

            <form onSubmit={submit} className="agenda-form">
              <div>
                <label className="label">Titre</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Titre de l’événement"
                />
              </div>

              <div className="agenda-two-columns">
                <div className="agenda-form-field">
                  <label className="label">Date</label>
                  <input
                    className="input agenda-native-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="agenda-form-field">
                  <label className="label">Heure</label>
                  <input
                    className="input agenda-native-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="agenda-two-columns agenda-location-category-grid">
                <div className="agenda-form-field">
                  <label className="label">Lieu</label>

                  <div className="agenda-location-wrap">
                    <input
                      className="input agenda-location-input"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Lieu de l’événement"
                    />
                  </div>
                </div>

                <div className="agenda-form-field">
                  <label className="label">Catégorie</label>

                  <input
                    className="input"
                    list="agenda-categories"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex. Réunion, Sortie, GIPE..."
                  />

                  <datalist id="agenda-categories">
                    {Array.from(
                      new Set(
                        events
                          .map((item) => (item.category || '').trim())
                          .filter(Boolean)
                      )
                    )
                      .sort((a, b) => a.localeCompare(b, 'fr'))
                      .map((item) => (
                        <option key={item} value={item} />
                      ))}
                  </datalist>

                  <div className="agenda-help">
                    Tu peux choisir une catégorie existante ou en saisir une
                    nouvelle.
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={7}
                  placeholder="Description de l’événement..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div>
                <label className="label">Image</label>

                {currentImage && (
                  <div className="agenda-current-image">
                    <img
                      src={currentImage}
                      alt="Image actuelle"
                    />
                  </div>
                )}

                <div className="agenda-file-row">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setImageFile(e.target.files?.[0] || null)
                    }
                  />
                  <span>Image de 8 Mo maximum.</span>
                </div>

                {imageFile && (
                  <div className="agenda-file-name">
                    Nouvelle image : <strong>{imageFile.name}</strong>
                  </div>
                )}
              </div>

              {error && (
                <div className="notice notice-error agenda-form-error">
                  {error}
                </div>
              )}

              <div className="agenda-form-actions">
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

      <style jsx>{`
        .agenda-card {
          min-width: 0;
        }

        .agenda-search {
          width: 280px;
          max-width: 100%;
        }

        .agenda-search-wrap {
          position: relative;
        }

        .agenda-search-wrap > svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gipe-muted);
          pointer-events: none;
        }

        .agenda-search-wrap .input {
          padding-left: 34px;
          z-index: 1;
        }

        .agenda-list-item {
          align-items: flex-start !important;
          gap: 18px;
        }

        .agenda-event-main {
          display: flex;
          gap: 14px;
          min-width: 0;
          flex: 1;
        }

        .agenda-event-image,
        .agenda-event-placeholder {
          width: 74px;
          height: 74px;
          flex: 0 0 74px;
          border-radius: 10px;
          box-sizing: border-box;
        }

        .agenda-event-image {
          object-fit: cover;
          border: 1px solid var(--gipe-line);
        }

        .agenda-event-placeholder {
          border: 1px solid var(--gipe-line);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gipe-muted);
        }

        .agenda-event-text {
          min-width: 0;
        }

        .agenda-excerpt {
          margin-top: 4px;
        }

        .agenda-item-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .agenda-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
          overflow-y: auto;
          background: rgba(15, 23, 42, 0.45);
        }

        .agenda-modal-card {
          width: min(760px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          box-sizing: border-box;
          padding: 24px;
        }

        .agenda-form {
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        .agenda-form-field {
          min-width: 0;
        }

        .agenda-two-columns {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          min-width: 0;
        }

        .agenda-two-columns > div {
          min-width: 0;
        }

        .agenda-native-date,
        .agenda-native-time {
          width: 0;
          min-width: 100%;
          max-width: 100%;
          min-inline-size: 100%;
          inline-size: 0;
          height: 42px !important;
          min-height: 42px !important;
          max-height: 42px !important;
          box-sizing: border-box;
          display: block;
          font: inherit;
          line-height: normal !important;
          -webkit-appearance: none;
          appearance: none;
        }

        .agenda-location-category-grid > .agenda-form-field {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .agenda-location-category-grid > .agenda-form-field > .label {
          display: block;
          height: 19px;
          line-height: 19px;
          margin: 0 0 7px;
          flex: 0 0 19px;
        }

        .agenda-location-wrap {
          position: relative;
          width: 100%;
          height: 42px;
          min-height: 42px;
          min-width: 0;
        }

        .agenda-location-wrap > svg {
          display: none !important;
        }

        .agenda-location-wrap .input {
          position: absolute;
          z-index: 1;
          inset: 0;
          width: 100%;
          height: 42px;
          box-sizing: border-box;
          padding-left: 34px;
        }

        .agenda-location-input {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%232b2321' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: 10px center !important;
          background-size: 18px 18px !important;
          padding-left: 34px !important;
        }

        .agenda-location-category-grid > .agenda-form-field > .input {
          width: 100%;
          height: 42px;
          min-height: 42px;
          max-height: 42px;
          box-sizing: border-box;
          flex: 0 0 42px;
        }

        .agenda-help {
          margin-top: 6px;
          font-size: 12px;
          color: var(--gipe-muted);
        }

        .agenda-current-image {
          margin-bottom: 12px;
        }

        .agenda-current-image img {
          width: 180px;
          height: 120px;
          max-width: 100%;
          object-fit: cover;
          border-radius: 10px;
          border: 1px solid var(--gipe-line);
        }

        .agenda-file-row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .agenda-file-row input[type='file'] {
          max-width: 100%;
          box-sizing: border-box;
        }

        .agenda-file-row span,
        .agenda-file-name {
          color: var(--gipe-muted);
          font-size: 13px;
        }

        .agenda-file-name {
          margin-top: 8px;
        }

        .agenda-form-error {
          margin-top: 2px;
        }

        .agenda-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 8px;
        }

        @media (max-width: 700px) {
          .agenda-section-head {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .agenda-search {
            width: 100%;
          }

          .agenda-list-item {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px;
          }

          .agenda-event-main {
            width: 100%;
          }

          .agenda-item-actions {
            width: 100%;
          }

          .agenda-item-actions .btn {
            flex: 1 1 0;
            justify-content: center;
          }

          .agenda-modal-backdrop {
            align-items: flex-start;
            padding: 10px;
          }

          .agenda-modal-card {
            width: 100%;
            max-width: 100%;
            max-height: calc(100vh - 20px);
            margin: 0 auto;
            padding: 16px;
            border-radius: 14px;
          }

          .agenda-modal-head {
            align-items: flex-start !important;
            gap: 12px;
          }

          .agenda-modal-head .btn {
            flex-shrink: 0;
          }

          .agenda-two-columns {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
          }

          .agenda-location-category-grid > .agenda-form-field > .label {
            height: 19px !important;
            line-height: 19px !important;
            margin-bottom: 7px !important;
          }

          .agenda-location-category-grid > .agenda-form-field > .input,
          .agenda-location-wrap,
          .agenda-location-wrap .input {
            height: 42px !important;
            min-height: 42px !important;
            max-height: 42px !important;
            box-sizing: border-box !important;
          }

          .agenda-form-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .agenda-form-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .agenda-native-date,
          .agenda-native-time {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            min-inline-size: 100% !important;
            inline-size: 100% !important;
            height: 42px !important;
            min-height: 42px !important;
            line-height: normal !important;
            box-sizing: border-box !important;
            display: block !important;
            -webkit-appearance: none !important;
            appearance: none !important;
          }
        }

        @media (max-width: 480px) {
          .agenda-event-main {
            gap: 10px;
          }

          .agenda-event-image,
          .agenda-event-placeholder {
            width: 58px;
            height: 58px;
            flex-basis: 58px;
          }

          .agenda-modal-card {
            padding: 14px;
          }

          .agenda-modal-card .section-title {
            font-size: 19px;
          }
        }
      `}</style>
    </>
  );
}



