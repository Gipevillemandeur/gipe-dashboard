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
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';

type EventItem = {
  id: string;
  school_year_id: string;
  title: string | null;
  description: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  image_url: string | null;
  category: string | null;
  published_on_site: boolean;
  site_event_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const INSTANCE_TYPES = [
  'Réunion GIPE',
  'Conseil de classe',
  'Conseil de discipline',
  "Conseil d'administration",
  'Autre',
];

function today() {
  return new Date().toISOString().slice(0, 10);
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

  return text.length <= 140
    ? text
    : `${text.slice(0, 140)}…`;
}

export default function AgendaPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);
  const [publishingId, setPublishingId] =
    useState<string | null>(null);

  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [showPublishModal, setShowPublishModal] =
    useState(false);
  const [eventToPublish, setEventToPublish] =
    useState<EventItem | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] =
    useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [location, setLocation] =
    useState('');
  const [category, setCategory] =
    useState('');

  const [createAsInstance, setCreateAsInstance] =
    useState(false);
  const [instanceType, setInstanceType] =
    useState('');
  const [instanceSubject, setInstanceSubject] =
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
      const response = await fetch(
        '/api/agenda',
        {
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Impossible de charger l'agenda."
        );
      }

      setEvents(data.events || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger l'agenda."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
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
        item.event_date || '',
        item.start_time || '',
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

    setCreateAsInstance(false);
    setInstanceType('');
    setInstanceSubject('');

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
    if (item.published_on_site) {
      return;
    }

    setEditingId(item.id);
    setTitle(item.title || '');
    setDescription(
      item.description || ''
    );
    setDate(
      item.event_date
        ? item.event_date.slice(0, 10)
        : today()
    );
    setTime(item.start_time || '');
    setLocation(item.location || '');
    setCategory(item.category || '');

    setCreateAsInstance(false);
    setInstanceType('');
    setInstanceSubject('');

    setImageFile(null);
    setCurrentImage(
      item.image_url || null
    );
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    resetForm();
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError('');

    /*
     * La création dans Instances concerne uniquement
     * les nouveaux événements.
     */
    if (
      editingId === null &&
      createAsInstance
    ) {
      if (!instanceType) {
        setError(
          "Le type d'instance est obligatoire."
        );
        return;
      }

      if (!instanceSubject.trim()) {
        setError(
          "L'objet de la réunion est obligatoire."
        );
        return;
      }

      if (!time) {
        setError(
          "L'heure est obligatoire pour créer une réunion dans les Instances."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const formData = new FormData();

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
          editingId
        );

        formData.set(
          'keepImage',
          imageFile
            ? 'false'
            : 'true'
        );

        response = await fetch(
          '/api/agenda',
          {
            method: 'PUT',
            body: formData,
          }
        );
      } else {
        response = await fetch(
          '/api/agenda',
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
            "Impossible d'enregistrer l'événement."
        );
      }

      /*
       * Si demandé, on crée maintenant une nouvelle
       * réunion indépendante dans instance_meetings.
       */
      if (
        editingId === null &&
        createAsInstance
      ) {
        const instanceResponse =
          await fetch(
            '/api/agenda/send-to-instance',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                eventId:
                  data?.event?.id,
                type: instanceType,
                subject:
                  instanceSubject.trim(),
              }),
            }
          );

        const instanceData =
          await instanceResponse.json();

        if (!instanceResponse.ok) {
          throw new Error(
            instanceData?.error ||
              "L'événement a été créé dans l'Agenda, mais impossible de créer la réunion dans les Instances."
          );
        }
      }

      await loadEvents();

      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer l'événement."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(
    item: EventItem
  ) {
    if (
      deletingId !== null ||
      item.published_on_site
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Supprimer l’événement « ${
          item.title || 'Sans titre'
        } » ?\n\nCette action est irréversible.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setError('');

    try {
      const response =
        await fetch(
          '/api/agenda',
          {
            method: 'DELETE',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              id: item.id,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Impossible de supprimer l'événement."
        );
      }

      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer l'événement."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function openPublishConfirmation(
    item: EventItem
  ) {
    if (
      item.published_on_site ||
      publishingId !== null
    ) {
      return;
    }

    setError('');
    setEventToPublish(item);
    setShowPublishModal(true);
  }

  function closePublishConfirmation() {
    if (publishingId !== null) {
      return;
    }

    setShowPublishModal(false);
    setEventToPublish(null);
  }

  async function publishEvent() {
    if (
      !eventToPublish ||
      publishingId !== null
    ) {
      return;
    }

    const item =
      eventToPublish;

    setPublishingId(item.id);
    setError('');

    try {
      const response =
        await fetch(
          '/api/agenda/publish',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              id: item.id,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Impossible d'envoyer l'événement sur le site."
        );
      }

      setShowPublishModal(false);
      setEventToPublish(null);

      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer l'événement sur le site."
      );
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <>
      <div className="topbar agenda-topbar">
        <div>
          <div className="eyebrow">
            GIPE
          </div>

          <h1>Agenda</h1>

          <div className="kicker">
            Gestion interne des événements
            et envoi vers le site internet.
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
        <div className="notice notice-error agenda-error">
          {error}
        </div>
      )}

      <section className="card section-card agenda-card">
        <div className="section-head agenda-section-head">
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

          <div className="agenda-search">
            <div className="agenda-search-wrap">
              <Search size={15} />

              <input
                className="input"
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
        ) : filteredEvents.length ===
          0 ? (
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
                  className="list-item agenda-list-item"
                  key={item.id}
                >
                  <div className="agenda-event-main">
                    {item.image_url ? (
                      <img
                        src={
                          item.image_url
                        }
                        alt={
                          item.title ||
                          'Événement'
                        }
                        className="agenda-event-image"
                      />
                    ) : (
                      <div className="agenda-event-placeholder">
                        <CalendarDays
                          size={25}
                        />
                      </div>
                    )}

                    <div className="item-main agenda-event-text">
                      <div className="agenda-title-line">
                        <strong>
                          {item.title ||
                            'Sans titre'}
                        </strong>

                        {item.published_on_site && (
                          <span className="agenda-published-badge">
                            <CheckCircle2
                              size={13}
                            />
                            Envoyé sur le site
                          </span>
                        )}
                      </div>

                      <span>
                        {formatDate(
                          item.event_date
                        )}

                        {item.start_time
                          ? ` · ${item.start_time}`
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
                        <span className="agenda-excerpt">
                          {excerpt(
                            item.description
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="agenda-item-actions">
                    {item.published_on_site ? (
                      <div className="agenda-published-info">
                        <CheckCircle2
                          size={15}
                        />
                        Déjà envoyé sur le site
                      </div>
                    ) : (
                      <>
                        <button
                          className="btn"
                          type="button"
                          onClick={() =>
                            openEdit(item)
                          }
                        >
                          <Pencil
                            size={14}
                          />
                          Modifier
                        </button>

                        <button
                          className="btn"
                          type="button"
                          onClick={() =>
                            void deleteEvent(
                              item
                            )
                          }
                          disabled={
                            deletingId ===
                            item.id
                          }
                        >
                          <Trash2
                            size={14}
                          />
                          {deletingId ===
                          item.id
                            ? 'Suppression…'
                            : 'Supprimer'}
                        </button>

                        <button
                          className="btn btn-primary agenda-publish-button"
                          type="button"
                          onClick={() =>
                            openPublishConfirmation(
                              item
                            )
                          }
                        >
                          <Send
                            size={14}
                          />
                          Envoyer sur le site
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {showForm && (
        <div
          className="agenda-modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div className="card agenda-modal-card">
            <div className="section-head agenda-modal-head">
              <div>
                <div className="eyebrow">
                  GIPE
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
                onClick={
                  closeForm
                }
                disabled={saving}
              >
                <X size={15} />
                Fermer
              </button>
            </div>

            <form
              onSubmit={submit}
              className="agenda-form"
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

              <div className="agenda-two-columns">
                <div className="agenda-form-field">
                  <label className="label">
                    Date
                  </label>

                  <input
                    className="input agenda-date-input"
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

                <div className="agenda-form-field">
                  <label className="label">
                    Heure
                  </label>

                  <input
                    className="input agenda-time-input"
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

              <div className="agenda-two-columns">
                <div className="agenda-form-field">
                  <label className="label">
                    Lieu
                  </label>

                  <input
                    className="input"
                    value={location}
                    onChange={(e) =>
                      setLocation(
                        e.target.value
                      )
                    }
                    placeholder="Lieu de l’événement"
                  />
                </div>

                <div className="agenda-form-field">
                  <label className="label">
                    Catégorie
                  </label>

                  <input
                    className="input"
                    list="agenda-categories"
                    value={category}
                    onChange={(e) =>
                      setCategory(
                        e.target.value
                      )
                    }
                    placeholder="Ex. Réunion, Sortie, GIPE..."
                  />

                  <datalist id="agenda-categories">
                    {Array.from(
                      new Set(
                        events
                          .map(
                            (item) =>
                              (
                                item.category ||
                                ''
                              ).trim()
                          )
                          .filter(
                            Boolean
                          )
                      )
                    )
                      .sort(
                        (a, b) =>
                          a.localeCompare(
                            b,
                            'fr'
                          )
                      )
                      .map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          />
                        )
                      )}
                  </datalist>

                  <div className="agenda-help">
                    Tu peux choisir une catégorie existante ou en saisir une nouvelle.
                  </div>
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
                    resize:
                      'vertical',
                  }}
                />
              </div>

              <div>
                <label className="label">
                  Image
                </label>

                {currentImage && (
                  <div className="agenda-current-image">
                    <img
                      src={
                        currentImage
                      }
                      alt="Image actuelle"
                    />
                  </div>
                )}

                <div className="agenda-file-row">
                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setImageFile(
                        e.target
                          .files?.[0] ||
                          null
                      )
                    }
                  />

                  <span>
                    Image de 8 Mo maximum.
                  </span>
                </div>

                {imageFile && (
                  <div className="agenda-file-name">
                    Nouvelle image :{' '}
                    <strong>
                      {
                        imageFile.name
                      }
                    </strong>
                  </div>
                )}
              </div>

              {editingId === null && (
                <div className="agenda-instance-section">
                  <label className="agenda-instance-checkbox">
                    <input
                      type="checkbox"
                      checked={
                        createAsInstance
                      }
                      onChange={(e) => {
                        const checked =
                          e.target.checked;

                        setCreateAsInstance(
                          checked
                        );

                        if (!checked) {
                          setInstanceType('');
                          setInstanceSubject('');
                        }
                      }}
                    />

                    <span>
                      <span>
                       Créer également la réunion dans les Instances ?
                      </span>
                    </span>
                  </label>

                  {createAsInstance && (
                    <div className="agenda-instance-fields">
                      <div className="agenda-form-field">
                        <label className="label">
                          Type d’instance
                        </label>

                        <select
                          className="input"
                          value={
                            instanceType
                          }
                          onChange={(e) =>
                            setInstanceType(
                              e.target.value
                            )
                          }
                          required={
                            createAsInstance
                          }
                        >
                          <option value="">
                            Sélectionner un type
                          </option>

                          {INSTANCE_TYPES.map(
                            (type) => (
                              <option
                                key={type}
                                value={type}
                              >
                                {type}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div className="agenda-form-field">
                        <label className="label">
                          Objet de la réunion
                        </label>

                        <input
                          className="input"
                          value={
                            instanceSubject
                          }
                          onChange={(e) =>
                            setInstanceSubject(
                              e.target.value
                            )
                          }
                          maxLength={200}
                          required={
                            createAsInstance
                          }
                          placeholder="Objet de la réunion"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="notice notice-error agenda-form-error">
                  {error}
                </div>
              )}

              <div className="agenda-form-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={
                    closeForm
                  }
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
                    : editingId !==
                        null
                      ? 'Enregistrer les modifications'
                      : 'Enregistrer l’événement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPublishModal &&
        eventToPublish && (
          <div
            className="agenda-modal-backdrop"
            role="dialog"
            aria-modal="true"
          >
            <div className="card agenda-confirm-card">
              <div className="agenda-confirm-icon">
                <Send size={24} />
              </div>

              <h2 className="section-title">
                Envoyer sur le site ?
              </h2>

              <p className="agenda-confirm-text">
                Tu es sur le point d’envoyer
                l’événement :
              </p>

              <div className="agenda-confirm-event">
                <strong>
                  {eventToPublish.title ||
                    'Sans titre'}
                </strong>

                <span>
                  {formatDate(
                    eventToPublish.event_date
                  )}

                  {eventToPublish.start_time
                    ? ` · ${eventToPublish.start_time}`
                    : ''}
                </span>
              </div>

              <div className="agenda-confirm-warning">
                <strong>
                  Attention
                </strong>

                <span>
                  Cet événement sera créé dans
                  l’Agenda du site internet.
                  Après son envoi, les
                  modifications ou sa
                  suppression devront être
                  effectuées directement dans
                  <strong>
                    {' '}
                    Site internet → Agenda
                  </strong>
                  .
                </span>
              </div>

              <div className="agenda-confirm-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={
                    closePublishConfirmation
                  }
                  disabled={
                    publishingId !==
                    null
                  }
                >
                  Annuler
                </button>

                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() =>
                    void publishEvent()
                  }
                  disabled={
                    publishingId !==
                    null
                  }
                >
                  <Send size={14} />

                  {publishingId !==
                  null
                    ? 'Envoi…'
                    : 'Confirmer'}
                </button>
              </div>
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

        .agenda-title-line {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        .agenda-excerpt {
          margin-top: 4px;
        }

        .agenda-published-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 999px;
          background: #eef8f0;
          color: #28733b;
          border: 1px solid #cce8d2;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .agenda-item-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          flex-shrink: 0;
          align-items: center;
          justify-content: flex-end;
        }

        .agenda-item-actions .btn {
          flex: 0 0 auto !important;
          width: auto !important;
          min-width: 125px !important;
          max-width: none !important;
          min-height: 40px !important;
          height: 40px !important;
          padding: 5px 14px !important;
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          box-sizing: border-box !important;
          font-size: 14px !important;
          line-height: 1 !important;
        }

        .agenda-item-actions .btn:nth-child(2) {
          color: #8a2b22 !important;
          border-color: #efc8c4 !important;
        }

        .agenda-publish-button {
          min-width: 165px !important;
        }

        .agenda-published-info {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 40px;
          padding: 8px 13px;
          box-sizing: border-box;
          border-radius: 9px;
          background: #f6faf7;
          border: 1px solid #d9e9dd;
          color: #28733b;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
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
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 16px;
          min-width: 0;
        }

        .agenda-two-columns > div {
          min-width: 0;
        }

        .agenda-date-input {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .agenda-time-input {
          width: 100% !important;
          min-width: 48px !important;
          max-width: 100% !important;
          height: 48px !important;
          min-height: 48px !important;
          box-sizing: border-box !important;
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

        .agenda-instance-section {
          display: grid;
          gap: 14px;
          padding-top: 4px;
        }

        .agenda-instance-checkbox {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          cursor: pointer;
          color: #8f211c;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          user-select: none;
        }

        .agenda-instance-checkbox input {
          width: 17px;
          height: 17px;
          flex: 0 0 17px;
          margin: 1px 0 0;
          accent-color: #8f211c;
          cursor: pointer;
        }

        .agenda-instance-fields {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 16px;
          padding: 14px;
          border: 1px solid var(--gipe-line);
          border-radius: 10px;
          background: #fafafa;
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

        .agenda-confirm-card {
          width: min(520px, 100%);
          box-sizing: border-box;
          padding: 26px;
        }

        .agenda-confirm-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #fff0d9;
          color: #8f211c;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .agenda-confirm-text {
          margin: 10px 0 12px;
          color: var(--gipe-muted);
          font-size: 14px;
          line-height: 1.5;
        }

        .agenda-confirm-event {
          display: grid;
          gap: 5px;
          padding: 13px 14px;
          border: 1px solid var(--gipe-line);
          border-radius: 10px;
          background: #fafafa;
        }

        .agenda-confirm-event strong {
          font-size: 15px;
        }

        .agenda-confirm-event span {
          color: var(--gipe-muted);
          font-size: 13px;
        }

        .agenda-confirm-warning {
          display: grid;
          gap: 5px;
          margin-top: 14px;
          padding: 13px 14px;
          border: 1px solid #ead9b8;
          border-radius: 10px;
          background: #fffaf0;
          color: #72551e;
          font-size: 13px;
          line-height: 1.5;
        }

        .agenda-confirm-warning strong {
          font-weight: 800;
        }

        .agenda-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        @media (max-width: 900px) {
          .agenda-item-actions {
            justify-content: flex-start;
          }
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
            margin-left: 0;
            justify-content: center !important;
            gap: 10px !important;
          }

          .agenda-item-actions .btn {
            flex: 1 1 auto !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
          }

          .agenda-publish-button {
            flex: 1 1 100% !important;
          }

          .agenda-published-info {
            width: 100%;
            white-space: normal;
            text-align: center;
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

          .agenda-instance-fields {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
          }

          .agenda-form-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .agenda-form-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .agenda-date-input {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            display: block !important;
            -webkit-appearance: none !important;
            appearance: none !important;
          }

          .agenda-time-input {
            width: 100% !important;
            min-width: 48px !important;
            max-width: 100% !important;
            height: 48px !important;
            min-height: 48px !important;
            box-sizing: border-box !important;
            display: block !important;
            -webkit-appearance: none !important;
            appearance: none !important;
          }

          .agenda-confirm-card {
            width: 100%;
            max-width: 100%;
            padding: 20px;
          }

          .agenda-confirm-actions {
            flex-direction: column-reverse;
          }

          .agenda-confirm-actions .btn {
            width: 100%;
            justify-content: center;
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

          .agenda-confirm-card {
            padding: 16px;
          }

          .agenda-modal-card .section-title,
          .agenda-confirm-card .section-title {
            font-size: 19px;
          }
        }
      `}</style>
    </>
  );
}
