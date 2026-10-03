'use client';

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

type DocumentItem = {
  id: string | number;
  title: string | null;
  description: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  date: string | null;
  category: string | null;
};

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return '—';

  const date = new Date(
    `${value.slice(0, 10)}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('fr-FR');
}

function excerpt(value: string | null) {
  const text = value || '';

  if (text.length <= 150) {
    return text;
  }

  return `${text.slice(0, 150)}…`;
}

export default function SiteDocumentsPage() {
  const [documents, setDocuments] =
    useState<DocumentItem[]>([]);

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

  const [category, setCategory] =
    useState('');

  const [file, setFile] =
    useState<File | null>(null);

  const [currentFileUrl, setCurrentFileUrl] =
    useState<string | null>(null);

  const [currentThumbnailUrl, setCurrentThumbnailUrl] =
    useState<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    setLoading(true);
    setError('');

    try {
      const response =
        await fetch(
          '/api/site/documents',
          {
            cache: 'no-store',
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger les documents.'
        );
      }

      setDocuments(
        data.documents || []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les documents.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  const filteredDocuments =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return documents;
      }

      return documents.filter(
        (item) =>
          [
            item.title || '',
            item.description || '',
            item.category || '',
            item.date || '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(value)
      );
    }, [documents, search]);

  const categories =
    useMemo(() => {
      return Array.from(
        new Set(
          documents
            .map((item) =>
              (item.category || '').trim()
            )
            .filter(Boolean)
        )
      ).sort((a, b) =>
        a.localeCompare(b, 'fr')
      );
    }, [documents]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDate(today());
    setCategory('');
    setFile(null);
    setCurrentFileUrl(null);
    setCurrentThumbnailUrl(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function openNew() {
    resetForm();
    setError('');
    setShowForm(true);
  }

  function openEdit(
    item: DocumentItem
  ) {
    setEditingId(item.id);
    setTitle(item.title || '');
    setDescription(
      item.description || ''
    );
    setDate(
      item.date
        ? item.date.slice(0, 10)
        : today()
    );
    setCategory(
      item.category || ''
    );
    setFile(null);
    setCurrentFileUrl(
      item.file_url || null
    );
    setCurrentThumbnailUrl(
      item.thumbnail_url || null
    );
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

      formData.set(
        'title',
        title
      );

      formData.set(
        'description',
        description
      );

      formData.set(
        'date',
        date
      );

      formData.set(
        'category',
        category
      );

      if (file) {
        formData.set(
          'file',
          file
        );
      }

      let response: Response;

      if (editingId !== null) {
        formData.set(
          'id',
          String(editingId)
        );

        response =
          await fetch(
            '/api/site/documents',
            {
              method: 'PUT',
              body: formData,
            }
          );
      } else {
        response =
          await fetch(
            '/api/site/documents',
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
            'Impossible d’enregistrer le document.'
        );
      }

      await loadDocuments();

      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer le document.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(
    item: DocumentItem
  ) {
    if (deletingId !== null) {
      return;
    }

    const confirmed =
      window.confirm(
        `Supprimer le document « ${
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
          '/api/site/documents',
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
            'Impossible de supprimer le document.'
        );
      }

      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer le document.'
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

          <h1>Documents</h1>

          <div className="kicker">
            Gestion des documents publiés
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
            Nouveau document
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
              Documents publiés
            </h2>

            <p className="section-sub">
              {documents.length}{' '}
              document
              {documents.length > 1
                ? 's'
                : ''}{' '}
              actuellement enregistré
              {documents.length > 1
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
                placeholder="Rechercher un document..."
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
                Récupération des documents.
              </span>
            </div>
          </div>
        ) : filteredDocuments.length ===
          0 ? (
          <div className="list-item">
            <div className="item-main">
              <strong>
                Aucun document trouvé.
              </strong>

              <span>
                {search
                  ? 'Essaie une autre recherche.'
                  : 'Aucun document n’est encore enregistré.'}
              </span>
            </div>
          </div>
        ) : (
          <div className="list">
            {filteredDocuments.map(
              (item) => (
                <div
                  className="list-item"
                  key={String(item.id)}
                  style={{
                    alignItems:
                      'flex-start',
                    padding:
                      '18px 20px',
                    gap: 18,
                    borderRadius: 12,
                    marginBottom: 10,
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
                    {item.thumbnail_url ? (
                      <img
                        src={
                          item.thumbnail_url
                        }
                        alt={
                          item.title ||
                          'Document'
                        }
                        style={{
                          width: 82,
                          height: 82,
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
                          width: 82,
                          height: 82,
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
                        <FileText
                          size={27}
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

                        {item.category
                          ? ` · ${item.category}`
                          : ''}
                      </span>

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

                      {item.file_url && (
                        <a
                          href={
                            item.file_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            marginTop: 6,
                            display:
                              'inline-block',
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          Ouvrir le PDF
                        </a>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexShrink: 0,
                      marginLeft: 12,
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
                        deleteDocument(item)
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
              width:
                'min(760px, 100%)',
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
                    ? 'Modifier le document'
                    : 'Nouveau document'}
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
                    placeholder="Titre du document"
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
                      Catégorie
                    </label>

                    <input
                      className="input"
                      list="document-categories"
                      value={category}
                      onChange={(e) =>
                        setCategory(
                          e.target.value
                        )
                      }
                      placeholder="Ex. Conseil d'administration"
                    />

                    <datalist id="document-categories">
                      {categories.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          />
                        )
                      )}
                    </datalist>
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
                    rows={6}
                    placeholder="Description du document..."
                    style={{
                      resize:
                        'vertical',
                    }}
                  />
                </div>

                <div>
                  <label className="label">
                    Document PDF
                  </label>

                  {currentFileUrl && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems:
                          'center',
                        gap: 12,
                        padding: 12,
                        marginBottom: 12,
                        border:
                          '1px solid var(--gipe-line)',
                        borderRadius: 10,
                      }}
                    >
                      {currentThumbnailUrl ? (
                        <img
                          src={
                            currentThumbnailUrl
                          }
                          alt="Aperçu du document"
                          style={{
                            width: 70,
                            height: 70,
                            objectFit:
                              'cover',
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <FileText
                          size={30}
                        />
                      )}

                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <strong>
                          Document actuel
                        </strong>

                        <a
                          href={
                            currentFileUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display:
                              'block',
                            marginTop: 4,
                            fontSize: 13,
                          }}
                        >
                          Ouvrir le PDF
                        </a>
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) =>
                      setFile(
                        e.target.files?.[0] ||
                          null
                      )
                    }
                    required={
                      editingId ===
                      null
                    }
                  />

                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 12,
                      color:
                        'var(--gipe-muted)',
                    }}
                  >
                    PDF uniquement, 8 Mo
                    maximum.
                    {editingId !== null &&
                      ' Laissez vide pour conserver le document actuel.'}
                  </div>

                  {file && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                      }}
                    >
                      Nouveau fichier :{' '}
                      <strong>
                        {file.name}
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
                      : 'Publier le document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
