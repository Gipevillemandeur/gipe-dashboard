'use client';

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ImagePlus,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

type NewsItem = {
  id: string;
  title: string | null;
  content: string | null;
  category: string | null;
  image_url: string | null;
  date: string | null;
  author: string | null;
};

const categories = [
  'Information',
  'GIPE',
  'Portes Ouvertes',
];

const smileys = [
  '😊',
  '😃',
  '😄',
  '😁',
  '😂',
  '🤣',
  '😍',
  '🥳',
  '🤩',
  '👍',
  '👏',
  '❤️',
  '🙏',
];

const symbols = [
  '⚠️',
  '🚨',
  '✅',
  '❌',
  '📢',
  '📣',
  '🔔',
  '📅',
  '📌',
  '❗',
  '⭐',
  '💡',
  '🎉',
  '🎊',
  '🎓',
  '📚',
  '🏫',
];

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function formatDate(
  value: string | null
) {
  if (!value) return '—';

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    'fr-FR'
  );
}

function excerpt(
  value: string | null
) {
  const text = value || '';

  if (text.length <= 120) {
    return text;
  }

  return `${text.slice(0, 120)}…`;
}

export default function SiteActualitesPage() {
  const [news, setNews] =
    useState<NewsItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [title, setTitle] =
    useState('');

  const [content, setContent] =
    useState('');

  const [category, setCategory] =
    useState('');

  const [date, setDate] =
    useState(today());

  const [author, setAuthor] =
    useState('GIPE');

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [currentImage, setCurrentImage] =
    useState<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [showSmileys, setShowSmileys] =
    useState(false);

  const [showSymbols, setShowSymbols] =
    useState(false);

  async function loadNews() {
    setLoading(true);
    setError('');

    try {
      const response =
        await fetch(
          '/api/site/actualites',
          {
            cache: 'no-store',
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger les actualités.'
        );
      }

      setNews(
        data.news || []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les actualités.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNews();
  }, []);

  const filteredNews =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return news;
      }

      return news.filter(
        (item) =>
          [
            item.title || '',
            item.content || '',
            item.category || '',
            item.author || '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(value)
      );
    }, [news, search]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setContent('');
    setCategory('');
    setDate(today());
    setAuthor('GIPE');
    setImageFile(null);
    setCurrentImage(null);
    setShowSmileys(false);
    setShowSymbols(false);

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
    item: NewsItem
  ) {
    setEditingId(item.id);
    setTitle(item.title || '');
    setContent(item.content || '');
    setCategory(item.category || '');
    setDate(
      item.date
        ? item.date.slice(0, 10)
        : today()
    );
    setAuthor(
      item.author || 'GIPE'
    );
    setImageFile(null);
    setCurrentImage(
      item.image_url || null
    );
    setShowSmileys(false);
    setShowSymbols(false);
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    resetForm();
  }

  function insertText(
    value: string
  ) {
    setContent(
      (current) =>
        `${current}${value}`
    );
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
        'content',
        content
      );

      formData.set(
        'category',
        category
      );

      formData.set(
        'date',
        date
      );

      formData.set(
        'author',
        author
      );

      if (imageFile) {
        formData.set(
          'imageFile',
          imageFile
        );
      }

      let response: Response;

      if (editingId) {
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

        response =
          await fetch(
            '/api/site/actualites',
            {
              method: 'PUT',
              body: formData,
            }
          );
      } else {
        response =
          await fetch(
            '/api/site/actualites',
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
            'Impossible d’enregistrer l’actualité.'
        );
      }

      await loadNews();

      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer l’actualité.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteNews(
    item: NewsItem
  ) {
    if (deletingId) return;

    const confirmed =
      window.confirm(
        `Supprimer l’actualité « ${item.title || 'Sans titre'} » ?\n\nCette action est irréversible.`
      );

    if (!confirmed) return;

    setDeletingId(item.id);
    setError('');

    try {
      const response =
        await fetch(
          '/api/site/actualites',
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
            'Impossible de supprimer l’actualité.'
        );
      }

      await loadNews();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer l’actualité.'
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

          <h1>
            Actualités
          </h1>

          <div className="kicker">
            Gestion des actualités publiées
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
            Nouvelle actualité
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

      <section className="card section-card actualites-card">
        <div className="section-head actualites-section-head">
          <div>
            <h2 className="section-title">
              Actualités publiées
            </h2>

            <p className="section-sub">
              {news.length}{' '}
              actualité
              {news.length > 1
                ? 's'
                : ''}
              actuellement enregistrée
              {news.length > 1
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
                placeholder="Rechercher une actualité..."
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
                Récupération des actualités.
              </span>
            </div>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="list-item">
            <div className="item-main">
              <strong>
                Aucune actualité trouvée.
              </strong>

              <span>
                {search
                  ? 'Essaie une autre recherche.'
                  : 'Aucune actualité n’est encore enregistrée.'}
              </span>
            </div>
          </div>
        ) : (
          <div className="list">
            {filteredNews.map(
              (item) => (
                <div
                  className="list-item"
                  key={item.id}
                  style={{
                    alignItems:
                      'flex-start',
                  }}
                >
                  <div
                    className="actualites-item-main"
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
                          'Actualité'
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
                          background:
                            '#fff1dc',
                          display:
                            'grid',
                          placeItems:
                            'center',
                          flexShrink: 0,
                        }}
                      >
                        <Newspaper
                          size={26}
                        />
                      </div>
                    )}

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          display:
                            'block',
                          fontSize:
                            14,
                        }}
                      >
                        {item.title ||
                          'Sans titre'}
                      </strong>

                      <div
                        style={{
                          display:
                            'flex',
                          flexWrap:
                            'wrap',
                          gap: 7,
                          marginTop: 5,
                        }}
                      >
                        {item.category && (
                          <span className="badge badge-info">
                            {
                              item.category
                            }
                          </span>
                        )}

                        <span className="badge badge-ok">
                          {formatDate(
                            item.date
                          )}
                        </span>
                      </div>

                      <p
                        style={{
                          margin:
                            '8px 0 0',
                          fontSize:
                            12,
                          color:
                            'var(--gipe-muted)',
                        }}
                      >
                        {excerpt(
                          item.content
                        )}
                      </p>
                    </div>
                  </div>

                  <div
                    className="btn-row actualites-item-actions"
                    style={{
                      flexShrink: 0,
                    }}
                  >
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        openEdit(
                          item
                        )
                      }
                    >
                      <Pencil
                        size={13}
                      />
                      Modifier
                    </button>

                    <button
                      className="btn"
                      type="button"
                      disabled={
                        deletingId ===
                        item.id
                      }
                      onClick={() =>
                        void deleteNews(
                          item
                        )
                      }
                      style={{
                        color:
                          '#8a2b22',
                        borderColor:
                          '#efc8c4',
                      }}
                    >
                      <Trash2
                        size={13}
                      />
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
          className="actualites-modal-backdrop"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(43,35,33,.38)',
            zIndex: 100,
            padding: 24,
            overflowY: 'auto',
          }}
        >
          <div
            className="card actualites-modal-card"
            style={{
              width:
                'min(760px, 100%)',
              margin:
                '40px auto',
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

                <h2
                  className="section-title"
                  style={{
                    marginTop: 4,
                    fontSize: 22,
                  }}
                >
                  {editingId
                    ? 'Modifier l’actualité'
                    : 'Nouvelle actualité'}
                </h2>
              </div>

              <button
                className="btn"
                type="button"
                onClick={closeForm}
              >
                <X size={15} />
                Fermer
              </button>
            </div>

            <form
              onSubmit={submit}
              style={{
                display: 'grid',
                gap: 16,
              }}
            >
              <label
                style={{
                  display: 'grid',
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Titre
                <input
                  className="input"
                  value={title}
                  onChange={(e) =>
                    setTitle(
                      e.target.value
                    )
                  }
                  placeholder="Titre de l’actualité"
                  required
                />
              </label>

              <div
                className="actualites-two-columns"
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: 12,
                }}
              >
                <label
                  style={{
                    display: 'grid',
                    gap: 7,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Date
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
                </label>

                <label
                  style={{
                    display: 'grid',
                    gap: 7,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Auteur
                  <input
                    className="input"
                    value={author}
                    onChange={(e) =>
                      setAuthor(
                        e.target.value
                      )
                    }
                  />
                </label>
              </div>

              <label
                style={{
                  display: 'grid',
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Catégorie
                <select
                  className="select"
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Sans catégorie
                  </option>

                  {categories.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label
                style={{
                  display: 'grid',
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Contenu

                <textarea
                  className="input"
                  value={content}
                  onChange={(e) =>
                    setContent(
                      e.target.value
                    )
                  }
                  rows={9}
                  placeholder="Écris ici le contenu de l’actualité..."
                  required
                  style={{
                    resize:
                      'vertical',
                    lineHeight: 1.5,
                  }}
                />
              </label>

              <div>
                <div
                  className="btn-row"
                  style={{
                    marginBottom: 8,
                  }}
                >
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setShowSmileys(
                        (value) =>
                          !value
                      )
                    }
                  >
                    😊 Smileys
                  </button>

                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setShowSymbols(
                        (value) =>
                          !value
                      )
                    }
                  >
                    ⭐ Symboles
                  </button>
                </div>

                {showSmileys && (
                  <div
                    style={{
                      display:
                        'flex',
                      flexWrap:
                        'wrap',
                      gap: 6,
                      padding: 10,
                      border:
                        '1px solid var(--gipe-line)',
                      borderRadius: 10,
                      background:
                        '#fffdf9',
                      marginBottom: 8,
                    }}
                  >
                    {smileys.map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          className="btn"
                          onClick={() =>
                            insertText(
                              item
                            )
                          }
                          style={{
                            padding:
                              '6px 8px',
                            fontSize:
                              18,
                          }}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>
                )}

                {showSymbols && (
                  <div
                    style={{
                      display:
                        'flex',
                      flexWrap:
                        'wrap',
                      gap: 6,
                      padding: 10,
                      border:
                        '1px solid var(--gipe-line)',
                      borderRadius: 10,
                      background:
                        '#fffdf9',
                    }}
                  >
                    {symbols.map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          className="btn"
                          onClick={() =>
                            insertText(
                              item
                            )
                          }
                          style={{
                            padding:
                              '6px 8px',
                            fontSize:
                              17,
                          }}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  border:
                    '1px solid var(--gipe-line)',
                  borderRadius: 14,
                  padding: 14,
                  background:
                    '#fffdf9',
                }}
              >
                <div
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  <ImagePlus
                    size={16}
                  />
                  Image
                </div>

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

                <p
                  style={{
                    margin:
                      '8px 0 0',
                    color:
                      'var(--gipe-muted)',
                    fontSize: 11,
                  }}
                >
                  Image uniquement,
                  8 Mo maximum.
                </p>

                {currentImage &&
                  !imageFile && (
                    <div
                      style={{
                        marginTop:
                          12,
                        display:
                          'flex',
                        gap: 10,
                        alignItems:
                          'center',
                      }}
                    >
                      <img
                        src={
                          currentImage
                        }
                        alt=""
                        style={{
                          width: 90,
                          height: 60,
                          objectFit:
                            'cover',
                          borderRadius: 8,
                        }}
                      />

                      <span
                        style={{
                          fontSize:
                            11,
                          color:
                            'var(--gipe-muted)',
                        }}
                      >
                        Image actuelle
                      </span>
                    </div>
                  )}

                {imageFile && (
                  <div
                    style={{
                      marginTop:
                        10,
                      fontSize: 12,
                    }}
                  >
                    <strong>
                      Nouvelle image :
                    </strong>{' '}
                    {
                      imageFile.name
                    }
                  </div>
                )}
              </div>

              {error && (
                <div className="notice notice-error">
                  {error}
                </div>
              )}

              <div
                className="btn-row actualites-form-actions"
                style={{
                  justifyContent:
                    'flex-end',
                }}
              >
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
                    : editingId
                      ? 'Enregistrer les modifications'
                      : 'Publier l’actualité'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      <style jsx>{`
        .actualites-card {
          min-width: 0;
        }

        .actualites-section-head {
          gap: 18px;
        }

        .actualites-list-item {
          gap: 18px;
        }

        .actualites-item-main {
          min-width: 0;
        }

        .actualites-item-actions {
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .actualites-modal-backdrop {
          box-sizing: border-box;
        }

        .actualites-modal-card {
          box-sizing: border-box;
        }

        @media (max-width: 700px) {
          .actualites-section-head {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .actualites-section-head > div:last-child {
            width: 100% !important;
          }

          .actualites-list-item {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }

          .actualites-item-main {
            width: 100%;
          }

          .actualites-item-actions {
            width: 100%;
            justify-content: stretch !important;
          }

          .actualites-item-actions .btn {
            flex: 1 1 0;
            justify-content: center;
          }

          .actualites-modal-backdrop {
            padding: 10px !important;
          }

          .actualites-modal-card {
            width: 100% !important;
            margin: 10px auto !important;
            padding: 16px !important;
            border-radius: 14px !important;
          }

          .actualites-modal-card .section-head {
            align-items: flex-start !important;
            gap: 12px !important;
          }

          .actualites-modal-card .section-head .btn {
            flex-shrink: 0;
          }

          .actualites-two-columns {
            grid-template-columns: 1fr !important;
          }

          .actualites-form-actions {
            flex-direction: column-reverse !important;
            align-items: stretch !important;
          }

          .actualites-form-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .actualites-modal-card input[type='file'] {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }
        }

        @media (max-width: 480px) {
          .actualites-item-main {
            gap: 10px !important;
          }

          .actualites-item-main > img,
          .actualites-item-main > div:first-child {
            width: 58px !important;
            height: 58px !important;
          }

          .actualites-modal-card {
            padding: 14px !important;
          }

          .actualites-modal-card .section-title {
            font-size: 19px !important;
          }
        }
      `}</style>
    </>
  );
}
