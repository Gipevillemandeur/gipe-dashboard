'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Save, ShieldCheck, KeyRound } from 'lucide-react';
import Link from 'next/link';

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  kind: 'real' | 'demo';
  access_code: string | null;
  active: boolean;
};

export default function ConfigurationClassesPage() {
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCodes, setSavingCodes] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/configuration', {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossible de charger la configuration.'
        );
      }

      setSchoolYear(data.schoolYear);
      setClasses(data.classes || []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de charger la configuration.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateCode(id: string, value: string) {
    setClasses((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, access_code: value }
          : item
      )
    );
  }

  async function saveCodes() {
    setSavingCodes(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/configuration', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classes: classes.map((item) => ({
            id: item.id,
            accessCode: item.access_code,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossible d’enregistrer les codes.'
        );
      }

      setMessage(
        'Les codes de déverrouillage ont été enregistrés.'
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible d’enregistrer les codes.'
      );
    } finally {
      setSavingCodes(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Configuration · Classes
          </div>

          <h1>Gestion des classes</h1>

          <div className="kicker">
            Année active : {schoolYear || 'aucune'}. Les codes restent
            indépendants des imports du collège.
          </div>
        </div>

        <div className="topbar-right">
          <Link className="btn" href="/configuration">
            <ArrowLeft size={14} /> Configuration
          </Link>
        </div>
      </div>


      {(message || error) && (
        <div
          className={`notice ${
            error ? 'notice-error' : ''
          }`}
          style={{ marginBottom: 18 }}
        >
          <ShieldCheck size={17} />

          <div>
            {error || message}
          </div>
        </div>
      )}


      <section className="card section-card">

        <div className="section-head">

          <div>
            <h2 className="section-title">
              <KeyRound
                size={18}
                style={{
                  verticalAlign: '-3px',
                  marginRight: 8,
                }}
              />
              Codes des conseils de classe
            </h2>

            <p className="section-sub">
              Tu peux changer ces codes à chaque conseil.
              Un import du collège ne les efface pas.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={saveCodes}
            disabled={savingCodes || loading}
          >
            <Save size={14} />

            {savingCodes
              ? 'Enregistrement…'
              : 'Enregistrer les codes'}
          </button>

        </div>


        {loading ? (
          <p className="kicker">
            Chargement…
          </p>
        ) : classes.length === 0 ? (
          <p className="kicker">
            Aucune classe active.
          </p>
        ) : (
          <table className="table">

            <thead>
              <tr>
                <th>Classe</th>
                <th>Niveau</th>
                <th>Type</th>
                <th>Code de déverrouillage</th>
              </tr>
            </thead>

            <tbody>

              {classes.map((item) => (
                <tr key={item.id}>

                  <td>
                    <strong>
                      {item.name}
                    </strong>
                  </td>

                  <td>
                    {item.level || '—'}
                  </td>

                  <td>
                    {item.kind === 'demo'
                      ? 'Démonstration'
                      : 'Réelle'}
                  </td>

                  <td>
                    <input
                      className="input"
                      style={{ maxWidth: 220 }}
                      value={item.access_code || ''}
                      onChange={(e) =>
                        updateCode(
                          item.id,
                          e.target.value
                        )
                      }
                      placeholder="Code"
                      inputMode="numeric"
                    />
                  </td>

                </tr>
              ))}

            </tbody>

          </table>
        )}

      </section>
    </>
  );
}
