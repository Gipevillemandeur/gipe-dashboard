import {
  FileText,
  Globe2,
  Newspaper,
  Settings,
  CalendarDays,
} from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function getSiteData() {
  const admin = createAdminClient();

  const [
    newsResult,
    eventsResult,
    documentsResult,
    settingsResult,
  ] = await Promise.all([
    admin
      .from('news')
      .select('id,title,date,category')
      .order('date', { ascending: false })
      .limit(1),

    admin
      .from('events')
      .select('id,title,date,time,location,category')
      .order('date', { ascending: true })
      .limit(1),

    admin
      .from('documents')
      .select('id,title,date,category')
      .order('date', { ascending: false })
      .limit(1),

    admin
      .from('settings')
      .select('key,value'),
  ]);

  return {
    news: newsResult.data || [],
    events: eventsResult.data || [],
    documents: documentsResult.data || [],
    settings: settingsResult.data || [],
    errors: {
      news: newsResult.error?.message || null,
      events: eventsResult.error?.message || null,
      documents: documentsResult.error?.message || null,
      settings: settingsResult.error?.message || null,
    },
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('fr-FR');
}

export default async function SitePage() {
  const data = await getSiteData();

  const settingsMap = Object.fromEntries(
    data.settings.map((item) => [
      item.key,
      item.value || '',
    ])
  );

  const hasError = Object.values(data.errors).some(Boolean);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Site internet
          </div>

          <h1>
            Gestion du site
          </h1>

          <div className="kicker">
            Contenu publié sur gipevillemandeur.com.
          </div>
        </div>

        <div className="topbar-right">
          <span className="user-pill">
            Administration centralisée
          </span>
        </div>
      </div>

      {hasError && (
        <section
          className="card section-card"
          style={{ marginBottom: 18 }}
        >
          <h2 className="section-title">
            Problème de connexion
          </h2>

          <p
            className="section-sub"
            style={{ marginTop: 8 }}
          >
            Une ou plusieurs tables du site n’ont pas pu
            être lues.
          </p>

          <div
            style={{
              marginTop: 12,
              display: 'grid',
              gap: 6,
            }}
          >
            {Object.entries(data.errors)
              .filter(([, error]) => Boolean(error))
              .map(([key, error]) => (
                <div
                  key={key}
                  className="badge badge-warn"
                  style={{
                    display: 'inline-flex',
                    width: 'fit-content',
                  }}
                >
                  {key} : {error}
                </div>
              ))}
          </div>
        </section>
      )}

      <div className="page-grid cards-4">
        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">
              Actualités
            </div>

            <div className="stat-icon">
              <Newspaper size={17} />
            </div>
          </div>

          <div className="stat-value">
            {data.news.length > 0 ? '1+' : '0'}
          </div>

          <div className="stat-note">
            Dernière actualité récupérée.
          </div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">
              Agenda
            </div>

            <div className="stat-icon">
              <CalendarDays size={17} />
            </div>
          </div>

          <div className="stat-value">
            {data.events.length > 0 ? '1+' : '0'}
          </div>

          <div className="stat-note">
            Prochain événement récupéré.
          </div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">
              Documents
            </div>

            <div className="stat-icon">
              <FileText size={17} />
            </div>
          </div>

          <div className="stat-value">
            {data.documents.length > 0 ? '1+' : '0'}
          </div>

          <div className="stat-note">
            Dernier document récupéré.
          </div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">
              Paramètres
            </div>

            <div className="stat-icon">
              <Settings size={17} />
            </div>
          </div>

          <div className="stat-value">
            {data.settings.length}
          </div>

          <div className="stat-note">
            Paramètres actuellement enregistrés.
          </div>
        </div>
      </div>

      <section
        className="card section-card"
        style={{ marginTop: 18 }}
      >
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Dernière actualité
            </h2>

            <p className="section-sub">
              Vérification de la lecture de la table
              <strong> news </strong>.
            </p>
          </div>
        </div>

        {data.news.length === 0 ? (
          <div className="list-item">
            <div className="item-main">
              <strong>
                Aucune actualité récupérée.
              </strong>

              <span>
                La table est accessible mais aucune ligne
                n’a été trouvée.
              </span>
            </div>
          </div>
        ) : (
          <div className="list-item">
            <div className="item-main">
              <strong>
                {data.news[0].title || 'Sans titre'}
              </strong>

              <span>
                {data.news[0].category || 'Sans catégorie'}
                {' · '}
                {formatDate(data.news[0].date)}
              </span>
            </div>

            <span className="badge badge-ok">
              Connecté
            </span>
          </div>
        )}
      </section>

      <section
        className="card section-card"
        style={{ marginTop: 18 }}
      >
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Prochain événement
            </h2>

            <p className="section-sub">
              Vérification de la lecture de la table
              <strong> events </strong>.
            </p>
          </div>
        </div>

        {data.events.length === 0 ? (
          <div className="list-item">
            <div className="item-main">
              <strong>
                Aucun événement récupéré.
              </strong>

              <span>
                La table est accessible mais aucune ligne
                n’a été trouvée.
              </span>
            </div>
          </div>
        ) : (
          <div className="list-item">
            <div className="item-main">
              <strong>
                {data.events[0].title || 'Sans titre'}
              </strong>

              <span>
                {formatDate(data.events[0].date)}
                {data.events[0].time
                  ? ` · ${data.events[0].time}`
                  : ''}
                {data.events[0].location
                  ? ` · ${data.events[0].location}`
                  : ''}
              </span>
            </div>

            <span className="badge badge-ok">
              Connecté
            </span>
          </div>
        )}
      </section>

      <section
        className="card section-card"
        style={{ marginTop: 18 }}
      >
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Dernier document
            </h2>

            <p className="section-sub">
              Vérification de la lecture de la table
              <strong> documents </strong>.
            </p>
          </div>
        </div>

        {data.documents.length === 0 ? (
          <div className="list-item">
            <div className="item-main">
              <strong>
                Aucun document récupéré.
              </strong>

              <span>
                La table est accessible mais aucune ligne
                n’a été trouvée.
              </span>
            </div>
          </div>
        ) : (
          <div className="list-item">
            <div className="item-main">
              <strong>
                {data.documents[0].title || 'Sans titre'}
              </strong>

              <span>
                {data.documents[0].category || 'Sans catégorie'}
                {' · '}
                {formatDate(data.documents[0].date)}
              </span>
            </div>

            <span className="badge badge-ok">
              Connecté
            </span>
          </div>
        )}
      </section>

      <section
        className="card section-card"
        style={{ marginTop: 18 }}
      >
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Paramètres du site
            </h2>

            <p className="section-sub">
              Vérification de la lecture de la table
              <strong> settings </strong>.
            </p>
          </div>
        </div>

        {data.settings.length === 0 ? (
          <div className="list-item">
            <div className="item-main">
              <strong>
                Aucun paramètre enregistré.
              </strong>
            </div>
          </div>
        ) : (
          <div className="list">
            {Object.entries(settingsMap).map(
              ([key, value]) => (
                <div
                  className="list-item"
                  key={key}
                >
                  <div className="item-main">
                    <strong>{key}</strong>

                    <span>
                      {value || 'Valeur vide'}
                    </span>
                  </div>

                  <span className="badge badge-ok">
                    Accessible
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <div className="footer-note">
        <Globe2 size={14} />
        Les données affichées ici sont lues depuis
        Supabase côté serveur du GIPE Dashboard.
      </div>
    </>
  );
}
