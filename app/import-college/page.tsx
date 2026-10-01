'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, UploadCloud, AlertTriangle, Database, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { parseCollegeWorkbook, summarizeImport, type CollegeImport } from '@/lib/college-import';

type ApplyResult = { ok: boolean; fileName?: string; summary?: ReturnType<typeof summarizeImport>; error?: string };

const defaultSchoolYear = process.env.NEXT_PUBLIC_DEFAULT_SCHOOL_YEAR || '2026-2027';

export default function ImportCollegePage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<CollegeImport | null>(null);
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const summary = useMemo(() => parsed ? summarizeImport(parsed) : null, [parsed]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setParsed(null);
    setError('');
    setSuccess('');
    if (!selected) return;

    try {
      const result = parseCollegeWorkbook(await selected.arrayBuffer());
      setParsed(result);
    } catch {
      setError('Impossible de lire ce fichier. Utilise le fichier .xls ou .xlsx transmis par le collège.');
    }
  }

  async function applyImport() {
    if (!file || !parsed) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('schoolYearLabel', schoolYear);

      const response = await fetch('/api/import/apply', { method: 'POST', body: formData });
      const result = await response.json() as ApplyResult;
      if (!response.ok || !result.ok) {
        setError(result.error || 'L’import n’a pas été appliqué.');
      } else {
        setSuccess(`Import appliqué : ${result.summary?.classes ?? parsed.classes.length} classes et ${result.summary?.students ?? parsed.totalStudents} élèves pour ${schoolYear}.`);
      }
    } catch {
      setError('Impossible de contacter le serveur d’import.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">
  Configuration
</div>

<h1>
  Importer le listing collège
</h1><div className="kicker">Le fichier reçu devient la référence pour l’état courant.</div></div>
        <div className="topbar-right"><Link className="btn" href="/conseils"><ArrowLeft size={14}/> Conseils</Link></div>
      </div>

      <section className="card section-card">
        <div className="upload">
          <FileSpreadsheet size={34} style={{opacity:.75}}/>
          <strong>{file?.name || 'Dépose le fichier du collège ici'}</strong>
          <p>Formats acceptés : .xls et .xlsx. Le fichier est analysé localement pour l’aperçu puis relu côté serveur au moment de l’application.</p>
          <label className="btn btn-gold"><UploadCloud size={14}/> Choisir le fichier<input className="hidden" type="file" accept=".xls,.xlsx" onChange={onFile}/></label>
        </div>
      </section>

      {(error || success) && <div className="card section-card" style={{marginTop:18}}><div className={error ? 'notice notice-error' : 'notice'}>{error ? <AlertTriangle size={17}/> : <CheckCircle2 size={17}/>}<div>{error || success}</div></div></div>}

      {parsed && <section className="page-grid" style={{marginTop:18}}>
        <div className="card section-card">
          <div className="section-head">
            <div><h2 className="section-title">Import analysé</h2><p className="section-sub">Vérifie seulement les anomalies techniques. Il n’y a pas de validation élève par élève.</p></div>
            <span className="badge badge-ok"><CheckCircle2 size={12}/> Lecture terminée</span>
          </div>
          <div className="page-grid cards-4" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>
            <div className="card stat"><div className="stat-label">Classes</div><div className="stat-value">{summary?.classes}</div></div>
            <div className="card stat"><div className="stat-label">Élèves</div><div className="stat-value">{summary?.students}</div></div>
            <div className="card stat"><div className="stat-label">Enseignants</div><div className="stat-value">{summary?.teachers}</div></div>
            <div className="card stat"><div className="stat-label">Direction</div><div className="stat-value">{summary?.direction}</div></div>
          </div>
        </div>

        <div className="card section-card">
          <div className="section-head"><div><h2 className="section-title">Année scolaire et application</h2><p className="section-sub">La classe TEST reste indépendante et permanente.</p></div><span className="badge badge-info"><Database size={12}/> Base privée</span></div>
          <div className="page-grid two-col" style={{gridTemplateColumns:'1fr 1fr'}}>
            <label className="login-form" style={{marginTop:0}}>Année scolaire<input className="input" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} placeholder="2026-2027" /></label>
            <div className="notice"><ShieldCheck size={17}/><div><strong>Import contrôlé</strong><br/>Le serveur vérifie le compte administrateur avant toute modification.</div></div>
          </div>
          <div className="btn-row" style={{marginTop:14}}><button className="btn btn-primary" onClick={applyImport} disabled={loading || parsed.classes.length === 0}>{loading ? 'Application…' : 'Appliquer l’import'}</button></div>
        </div>

        <div className="card section-card">
          <div className="section-head"><div><h2 className="section-title">Classes détectées</h2><p className="section-sub">Les onglets « code classe » et « direction » sont utilisés séparément.</p></div></div>
          <table className="table"><thead><tr><th>Classe</th><th>Niveau</th><th>Élèves</th><th>Enseignants</th><th>Code</th></tr></thead><tbody>{parsed.classes.map(c=><tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.level}</td><td>{c.students.length}</td><td>{c.teachers.length}</td><td>{c.accessCode ? 'Détecté' : 'Absent'}</td></tr>)}</tbody></table>
        </div>

        {(parsed.warnings.length > 0 || parsed.ignoredSheets.length > 0) && <div className="card section-card"><div className="notice notice-error"><AlertTriangle size={17}/><div><strong>Informations à contrôler</strong>{parsed.warnings.map((w)=><div key={w}>{w}</div>)}{parsed.ignoredSheets.length > 0 && <div style={{marginTop:6}}>Onglets réservés : {parsed.ignoredSheets.join(', ')}.</div>}</div></div></div>}
      </section>}
    </>
  );
}
