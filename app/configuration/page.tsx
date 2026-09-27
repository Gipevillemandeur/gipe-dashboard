'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2, ShieldCheck, KeyRound } from 'lucide-react';
import Link from 'next/link';

type ClassItem = { id: string; name: string; level: string | null; kind: 'real' | 'demo'; access_code: string | null; active: boolean };
type DirectionMember = { id?: string; display_name: string; role: string | null; active: boolean };

export default function ConfigurationPage() {
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [direction, setDirection] = useState<DirectionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCodes, setSavingCodes] = useState(false);
  const [savingDirection, setSavingDirection] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/configuration', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger la configuration.');
      setSchoolYear(data.schoolYear);
      setClasses(data.classes || []);
      setDirection(data.direction || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de charger la configuration.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function updateCode(id: string, value: string) {
    setClasses((current) => current.map((item) => item.id === id ? { ...item, access_code: value } : item));
  }

  async function saveCodes() {
    setSavingCodes(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/configuration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classes: classes.map((item) => ({ id: item.id, accessCode: item.access_code })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer les codes.');
      setMessage('Les codes de déverrouillage ont été enregistrés.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer les codes.'); }
    finally { setSavingCodes(false); }
  }

  function updateDirection(index: number, field: 'display_name' | 'role', value: string) {
    setDirection((current) => current.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addDirection() { setDirection((current) => [...current, { display_name: '', role: '', active: true }]); }
  function removeDirection(index: number) { setDirection((current) => current.filter((_, i) => i !== index)); }

  async function saveDirection() {
    setSavingDirection(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/configuration', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ members: direction }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer la direction.');
      setMessage('La composition de la direction a été enregistrée.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer la direction.'); }
    finally { setSavingDirection(false); }
  }

  return (
    <>
      <div className="topbar">
        <div><div className="eyebrow">Configuration</div><h1>Paramètres du GIPE</h1><div className="kicker">Les éléments qui ne doivent pas dépendre du fichier du collège.</div></div>
        <div className="topbar-right"><Link className="btn" href="/"><ArrowLeft size={14}/> Accueil</Link></div>
      </div>

      {(message || error) && <div className={`notice ${error ? 'notice-error' : ''}`} style={{marginBottom:18}}><ShieldCheck size={17}/><div>{error || message}</div></div>}

      <section className="card section-card">
        <div className="section-head"><div><h2 className="section-title"><KeyRound size={18} style={{verticalAlign:'-3px', marginRight:8}}/>Codes des conseils de classe</h2><p className="section-sub">Année active : {schoolYear || 'aucune'}. Tu peux changer ces codes à chaque conseil. Un import du collège ne les efface pas.</p></div><button className="btn btn-primary" onClick={saveCodes} disabled={savingCodes || loading}><Save size={14}/> {savingCodes ? 'Enregistrement…' : 'Enregistrer les codes'}</button></div>
        {loading ? <p className="kicker">Chargement…</p> : classes.length === 0 ? <p className="kicker">Aucune classe active.</p> : <table className="table"><thead><tr><th>Classe</th><th>Niveau</th><th>Type</th><th>Code de déverrouillage</th></tr></thead><tbody>
          {classes.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.level || '—'}</td><td>{item.kind === 'demo' ? 'Démonstration' : 'Réelle'}</td><td><input className="input" style={{maxWidth:220}} value={item.access_code || ''} onChange={(e) => updateCode(item.id, e.target.value)} placeholder="Code" inputMode="numeric" /></td></tr>)}
        </tbody></table>}
      </section>

      <section className="card section-card" style={{marginTop:18}}>
        <div className="section-head"><div><h2 className="section-title">Direction du collège</h2><p className="section-sub">Cette liste est indépendante du fichier des élèves. Elle reste en place lorsque le fichier reçu ne contient pas d’onglet « direction ».</p></div><div className="btn-row"><button className="btn" onClick={addDirection}><Plus size={14}/> Ajouter</button><button className="btn btn-primary" onClick={saveDirection} disabled={savingDirection || loading}><Save size={14}/> {savingDirection ? 'Enregistrement…' : 'Enregistrer'}</button></div></div>
        {loading ? <p className="kicker">Chargement…</p> : <table className="table"><thead><tr><th>Nom</th><th>Fonction</th><th></th></tr></thead><tbody>
          {direction.map((member, index) => <tr key={member.id || `new-${index}`}><td><input className="input" value={member.display_name} onChange={(e) => updateDirection(index, 'display_name', e.target.value)} placeholder="Nom Prénom" /></td><td><input className="input" value={member.role || ''} onChange={(e) => updateDirection(index, 'role', e.target.value)} placeholder="Principale, principale adjointe…" /></td><td style={{width:60}}><button className="btn" title="Supprimer" onClick={() => removeDirection(index)}><Trash2 size={14}/></button></td></tr>)}
        </tbody></table>}
        <div className="notice" style={{marginTop:16}}><ShieldCheck size={16}/><div><strong>Principe retenu</strong><br/>Le fichier du collège met à jour les élèves, les classes et les équipes. Les codes et la direction sont gérés ici dans le dashboard.</div></div>
      </section>
    </>
  );
}
