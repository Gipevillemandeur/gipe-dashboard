'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

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
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}

function excerpt(value: string | null) {
  const text = value || '';
  return text.length <= 150 ? text : `${text.slice(0, 150)}…`;
}

export default function SiteDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
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
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [currentFileUrl, setCurrentFileUrl] = useState<string | null>(null);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/site/documents', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Impossible de charger les documents.');
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les documents.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  const filteredDocuments = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return documents;
    return documents.filter((item) =>
      [item.title || '', item.description || '', item.category || '', item.date || '']
        .join(' ')
        .toLowerCase()
        .includes(value)
    );
  }, [documents, search]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        documents.map((item) => (item.category || '').trim()).filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'fr'));
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openNew() {
    resetForm();
    setError('');
    setShowForm(true);
  }

  function openEdit(item: DocumentItem) {
    setEditingId(item.id);
    setTitle(item.title || '');
    setDescription(item.description || '');
    setDate(item.date ? item.date.slice(0, 10) : today());
    setCategory(item.category || '');
    setFile(null);
    setCurrentFileUrl(item.file_url || null);
    setCurrentThumbnailUrl(item.thumbnail_url || null);
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
      formData.set('category', category);
      if (file) formData.set('file', file);

      let response: Response;
      if (editingId !== null) {
        formData.set('id', String(editingId));
        response = await fetch('/api/site/documents', { method: 'PUT', body: formData });
      } else {
        response = await fetch('/api/site/documents', { method: 'POST', body: formData });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Impossible d’enregistrer le document.');
      await loadDocuments();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le document.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(item: DocumentItem) {
    if (deletingId !== null) return;
    const confirmed = window.confirm(
      `Supprimer le document « ${item.title || 'Sans titre'} » ?\n\nCette action est irréversible.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    setError('');
    try {
      const response = await fetch('/api/site/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: String(item.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Impossible de supprimer le document.');
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer le document.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Site internet</div>
          <h1>Documents</h1>
          <div className="kicker">Gestion des documents publiés sur gipevillemandeur.com.</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" type="button" onClick={openNew}>
            <Plus size={15} />
            Nouveau document
          </button>
        </div>
      </div>

      {error && <div className="notice notice-error documents-error">{error}</div>}

      <section className="card section-card documents-card">
        <div className="section-head documents-section-head">
          <div>
            <h2 className="section-title">Documents publiés</h2>
            <p className="section-sub">
              {documents.length} document{documents.length > 1 ? 's' : ''} actuellement enregistré{documents.length > 1 ? 's' : ''}.
            </p>
          </div>
          <div className="documents-search-wrap">
            <div className="documents-search-box">
              <Search size={15} className="documents-search-icon" />
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un document..."
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="list-item"><div className="item-main"><strong>Chargement…</strong><span>Récupération des documents.</span></div></div>
        ) : filteredDocuments.length === 0 ? (
          <div className="list-item"><div className="item-main"><strong>Aucun document trouvé.</strong><span>{search ? 'Essaie une autre recherche.' : 'Aucun document n’est encore enregistré.'}</span></div></div>
        ) : (
          <div className="list">
            {filteredDocuments.map((item) => (
              <div className="list-item documents-list-item" key={String(item.id)}>
                <div className="documents-item-main">
                  {item.thumbnail_url ? (
                    <img className="documents-thumb" src={item.thumbnail_url} alt={item.title || 'Document'} />
                  ) : (
                    <div className="documents-thumb documents-thumb-placeholder"><FileText size={27} /></div>
                  )}
                  <div className="item-main documents-item-text">
                    <strong>{item.title || 'Sans titre'}</strong>
                    <span>{formatDate(item.date)}{item.category ? ` · ${item.category}` : ''}</span>
                    {item.description && <span className="documents-description">{excerpt(item.description)}</span>}
                    {item.file_url && (
                      <a className="documents-pdf-link" href={item.file_url} target="_blank" rel="noreferrer">Ouvrir le PDF</a>
                    )}
                  </div>
                </div>
                <div className="documents-item-actions">
                  <button className="btn" type="button" onClick={() => openEdit(item)}><Pencil size={14} />Modifier</button>
                  <button className="btn documents-delete-button" type="button" onClick={() => void deleteDocument(item)} disabled={deletingId === item.id}>
                    <Trash2 size={14} />{deletingId === item.id ? 'Suppression…' : 'Supprimer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="documents-modal-backdrop" role="dialog" aria-modal="true">
          <div className="card documents-modal-card">
            <div className="section-head documents-modal-head">
              <div>
                <div className="eyebrow">Site internet</div>
                <h2 className="section-title">{editingId !== null ? 'Modifier le document' : 'Nouveau document'}</h2>
              </div>
              <button className="btn documents-close-button" type="button" onClick={closeForm} disabled={saving}><X size={15} />Fermer</button>
            </div>

            <form onSubmit={submit} className="documents-form">
              <label className="documents-field">Titre
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="Titre du document" />
              </label>

              <div className="documents-two-columns">
                <label className="documents-field">Date
                  <input className="input documents-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </label>
                <label className="documents-field">Catégorie
                  <input className="input" list="document-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. Conseil d'administration" />
                  <datalist id="document-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist>
                </label>
              </div>

              <label className="documents-field">Description
                <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="Description du document..." />
              </label>

              <div className="documents-field">
                <span>Document PDF</span>
                {currentFileUrl && (
                  <div className="documents-current-file">
                    {currentThumbnailUrl ? <img src={currentThumbnailUrl} alt="Aperçu du document" /> : <FileText size={30} />}
                    <div className="documents-current-file-text">
                      <strong>Document actuel</strong>
                      <a href={currentFileUrl} target="_blank" rel="noreferrer">Ouvrir le PDF</a>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required={editingId === null} />
                <small>PDF uniquement, 8 Mo maximum.{editingId !== null && ' Laissez vide pour conserver le document actuel.'}</small>
                {file && <div className="documents-selected-file">Nouveau fichier : <strong>{file.name}</strong></div>}
              </div>

              {error && <div className="notice notice-error">{error}</div>}

              <div className="documents-form-actions">
                <button className="btn" type="button" onClick={closeForm} disabled={saving}>Annuler</button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Enregistrement…' : editingId !== null ? 'Enregistrer les modifications' : 'Publier le document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .documents-card { min-width: 0; }
        .documents-section-head { gap: 18px; }
        .documents-search-wrap { width: 280px; max-width: 100%; }
        .documents-search-box { position: relative; }
        .documents-search-box .input { padding-left: 34px; }
        .documents-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--gipe-muted); z-index: 1; pointer-events: none; }
        .documents-list-item { align-items: flex-start; padding: 18px 20px; gap: 18px; border-radius: 12px; margin-bottom: 10px; }
        .documents-item-main { display: flex; gap: 14px; min-width: 0; flex: 1; }
        .documents-thumb { width: 82px; height: 82px; object-fit: cover; border-radius: 10px; border: 1px solid var(--gipe-line); flex-shrink: 0; }
        .documents-thumb-placeholder { display: flex; align-items: center; justify-content: center; color: var(--gipe-muted); }
        .documents-item-text { min-width: 0; }
        .documents-description { margin-top: 4px; }
        .documents-pdf-link { display: inline-block; margin-top: 6px; font-size: 13px; font-weight: 600; }
        .documents-item-actions { display: flex; gap: 8px; flex-shrink: 0; margin-left: 12px; }
        .documents-delete-button { color: #8a2b22; border-color: #efc8c4; }
        .documents-item-actions .btn { box-sizing: border-box; line-height: 1.1; width: 155px; flex: 0 0 155px; }
        .documents-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; overflow-y: auto; }
        .documents-modal-card { width: min(760px, 100%); max-height: calc(100vh - 40px); overflow-y: auto; padding: 24px; box-sizing: border-box; }
        .documents-modal-head { margin-bottom: 20px; gap: 14px; }
        .documents-form { display: grid; gap: 16px; }
        .documents-field { display: grid; gap: 7px; font-size: 12px; font-weight: 700; min-width: 0; }
        .documents-two-columns { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; min-width: 0; }
        .documents-date-input { width: 100% !important; min-width: 0 !important; max-width: 100% !important; box-sizing: border-box !important; }
        .documents-current-file { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--gipe-line); border-radius: 10px; min-width: 0; }
        .documents-current-file img { width: 70px; height: 70px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
        .documents-current-file-text { min-width: 0; }
        .documents-current-file-text a { display: block; margin-top: 4px; font-size: 13px; }
        .documents-field input[type='file'] { width: 100%; max-width: 100%; box-sizing: border-box; }
        .documents-field small { margin-top: -1px; font-size: 12px; color: var(--gipe-muted); font-weight: 400; }
        .documents-selected-file { font-size: 13px; font-weight: 400; }
        .documents-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
        .documents-error { margin-bottom: 18px; }

        @media (max-width: 700px) {
          .documents-section-head { align-items: stretch !important; flex-direction: column !important; }
          .documents-search-wrap { width: 100%; }
          .documents-list-item { flex-direction: column !important; align-items: stretch !important; padding: 14px !important; gap: 14px !important; }
          .documents-item-main { width: 100%; }
          .documents-item-actions { width: 100%; margin-left: 0; gap: 10px; justify-content: center; }
          .documents-item-actions .btn { flex: 0 0 145px !important; width: 145px !important; max-width: 145px !important; min-width: 145px !important; min-height: 40px !important; height: 40px !important; padding: 5px 8px !important; justify-content: center !important; font-size: 14px !important; box-sizing: border-box !important; }
          .documents-modal-backdrop { padding: 10px !important; align-items: flex-start !important; }
          .documents-modal-card { width: 100% !important; max-width: 100% !important; max-height: calc(100vh - 20px) !important; margin: 10px auto !important; padding: 16px !important; border-radius: 14px !important; }
          .documents-modal-head { align-items: flex-start !important; }
          .documents-modal-head .btn { flex-shrink: 0; }
          .documents-two-columns { grid-template-columns: minmax(0,1fr) !important; gap: 16px !important; }
          .documents-form-actions { flex-direction: column-reverse !important; align-items: stretch !important; }
          .documents-form-actions .btn { width: 100%; justify-content: center; }
          .documents-date-input { width: 100% !important; min-width: 0 !important; max-width: 100% !important; box-sizing: border-box !important; display: block !important; -webkit-appearance: none !important; appearance: none !important; }
          .documents-thumb { width: 64px; height: 64px; }
          .documents-modal-card input[type='file'] { width: 100%; max-width: 100%; }
        }

        @media (max-width: 480px) {
          .documents-modal-card { padding: 14px !important; }
          .documents-modal-card .section-title { font-size: 19px !important; }
          .documents-item-main { gap: 10px; }
        }
      `}</style>
    </>
  );
}




