'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, UploadCloud, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

type ParsedClass = { name: string; teachers: number; students: number };

type ParsedImport = { classes: ParsedClass[]; ignored: string[]; warnings: string[]; totalStudents: number };

const RESERVED = new Set(['code classe', 'direction']);

function headerIndex(headers: string[], wanted: string[]) {
  return headers.findIndex((h) => wanted.some((w) => h.includes(w)));
}

function parseWorkbook(data: ArrayBuffer): ParsedImport {
  const wb = XLSX.read(data, { type: 'array' });
  const classes: ParsedClass[] = [];
  const ignored: string[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const normalized = sheetName.trim().toLowerCase();
    if (RESERVED.has(normalized)) { ignored.push(sheetName); continue; }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '' });
    const header = (rows[0] ?? []).map((v) => String(v).trim().toLowerCase());
    const nameCol = headerIndex(header, ['nom']);
    const firstNameCol = headerIndex(header, ['prenom', 'prénom']);
    const teacherCol = headerIndex(header, ['professeur', 'prof']);

    let students = 0;
    let teacherSet = new Set<string>();
    for (const row of rows.slice(1)) {
      const values = row as unknown[];
      const nom = nameCol >= 0 ? String(values[nameCol] ?? '').trim() : '';
      const prenom = firstNameCol >= 0 ? String(values[firstNameCol] ?? '').trim() : '';
      const prof = teacherCol >= 0 ? String(values[teacherCol] ?? '').trim() : '';
      if (nom || prenom) students += 1;
      if (prof) prof.split(/\n+/).map((p)=>p.trim()).filter(Boolean).forEach((p)=>teacherSet.add(p));
    }

    if (students === 0 && teacherSet.size === 0) {
      warnings.push(`L'onglet « ${sheetName} » ne contient pas de données reconnaissables.`);
      continue;
    }
    classes.push({ name: sheetName, teachers: teacherSet.size, students });
  }

  const totalStudents = classes.reduce((sum, c) => sum + c.students, 0);
  return { classes, ignored, warnings, totalStudents };
}

export default function ImportCollegePage() {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [error, setError] = useState('');

  const summary = useMemo(() => {
    if (!parsed) return null;
    const levels = new Map<string, number>();
    for (const c of parsed.classes) {
      const m = c.name.match(/^(6|5|4|3)/);
      if (m) levels.set(m[1], (levels.get(m[1]) ?? 0) + 1);
    }
    return Array.from(levels.entries()).map(([level,count]) => `${level}e : ${count}`).join(' · ');
  }, [parsed]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const result = parseWorkbook(buffer);
      setParsed(result);
    } catch (err) {
      console.error(err);
      setError('Impossible de lire ce fichier. Utilise un fichier .xls ou .xlsx provenant du collège.');
    }
  }

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">Conseils de classe</div><h1>Importer les listes du collège</h1><div className="kicker">Le fichier reçu régulièrement devient la référence pour l'état actuel.</div></div>
        <div className="topbar-right"><Link className="btn" href="/conseils"><ArrowLeft size={14}/> Conseils</Link></div>
      </div>

      <section className="card section-card">
        <div className="upload">
          <FileSpreadsheet size={34} style={{opacity:.75}}/>
          <strong>{fileName || 'Dépose le fichier du collège ici'}</strong>
          <p>Formats acceptés : .xls et .xlsx. L'import ne demande pas de validation pour chaque élève ou professeur : le fichier du collège décrit la situation courante.</p>
          <label className="btn btn-gold"><UploadCloud size={14}/> Choisir le fichier<input className="hidden" type="file" accept=".xls,.xlsx" onChange={onFile}/></label>
        </div>
      </section>

      {error && <div className="card section-card" style={{marginTop:18}}><div className="notice"><AlertTriangle size={17}/><div>{error}</div></div></div>}

      {parsed && <section className="page-grid" style={{marginTop:18}}>
        <div className="card section-card">
          <div className="section-head"><div><h2 className="section-title">Import analysé</h2><p className="section-sub">{summary}</p></div><span className="badge badge-ok"><CheckCircle2 size={12}/> Lecture terminée</span></div>
          <div className="page-grid cards-4" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
            <div className="card stat"><div className="stat-label">Classes détectées</div><div className="stat-value">{parsed.classes.length}</div></div>
            <div className="card stat"><div className="stat-label">Élèves détectés</div><div className="stat-value">{parsed.totalStudents}</div></div>
            <div className="card stat"><div className="stat-label">Onglets ignorés</div><div className="stat-value">{parsed.ignored.length}</div></div>
          </div>
        </div>

        <div className="card section-card">
          <div className="section-head"><div><h2 className="section-title">Classes détectées</h2><p className="section-sub">La classe TEST n'a pas besoin d'être dans le fichier : elle reste gérée à part.</p></div></div>
          <table className="table"><thead><tr><th>Classe</th><th>Élèves</th><th>Enseignants</th></tr></thead><tbody>{parsed.classes.map(c=><tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.students}</td><td>{c.teachers}</td></tr>)}</tbody></table>
        </div>

        {parsed.warnings.length > 0 && <div className="card section-card"><div className="notice"><AlertTriangle size={17}/><div><strong>Quelques onglets nécessitent une vérification</strong><br/>{parsed.warnings.map((w)=><div key={w}>{w}</div>)}</div></div></div>}

        <div className="card section-card"><div className="notice"><CheckCircle2 size={17} color="#1d6d3a"/><div><strong>Dans la version connectée</strong><br/>Ce bouton déclenchera le remplacement des données actuelles de l'année dans Supabase et la synchronisation vers l'outil Conseil de classe. La classe TEST sera conservée automatiquement.</div></div><div className="btn-row" style={{marginTop:14}}><button className="btn btn-primary" disabled>Appliquer l'import — prochaine étape</button></div></div>
      </section>}
    </>
  );
}
