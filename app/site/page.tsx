import Link from 'next/link';
import {
  Newspaper,
  CalendarDays,
  FileText,
  Megaphone,
  Settings,
  Globe2,
} from 'lucide-react';

export default function SitePage() {
  const menu = [
    {
      href: '/site/actualites',
      title: 'Actualités',
      description:
        'Publier, modifier et supprimer les actualités du site.',
      icon: Newspaper,
    },
    {
      href: '/site/agenda',
      title: 'Agenda',
      description:
        'Gérer les événements, les dates et les rendez-vous.',
      icon: CalendarDays,
    },
    {
      href: '/site/documents',
      title: 'Documents',
      description:
        'Ajouter et gérer les documents disponibles au téléchargement.',
      icon: FileText,
    },
    {
      href: '/site/alerte',
      title: 'Bandeau d’alerte',
      description:
        'Afficher et modifier le message important visible sur le site.',
      icon: Megaphone,
    },
    {
      href: '/site/parametres',
      title: 'Paramètres',
      description:
        'Modifier les informations générales de l’association.',
      icon: Settings,
    },
  ];

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
            Gérez le contenu publié sur
            gipevillemandeur.com.
          </div>
        </div>
      </div>

      <section
        className="card section-card"
        style={{
          marginBottom: 18,
        }}
      >
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Que souhaitez-vous gérer ?
            </h2>

            <p className="section-sub">
              Choisissez une rubrique pour accéder
              directement à sa gestion.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(0, 1fr))',
            gap: 16,
            marginTop: 20,
          }}
        >
          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                }}
              >
                <div
                  className="card"
                  style={{
                    height: '100%',
                    padding: 20,
                    border:
                      '1px solid var(--gipe-line)',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div
                      className="stat-icon"
                      style={{
                        width: 44,
                        height: 44,
                        minWidth: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={21} />
                    </div>

                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 18,
                          fontWeight: 750,
                        }}
                      >
                        {item.title}
                      </h3>

                      <p
                        style={{
                          margin:
                            '7px 0 0',
                          color:
                            'var(--gipe-muted)',
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div
        className="footer-note"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Globe2 size={14} />

        Les modifications effectuées ici sont
        publiées sur le site public du GIPE.
      </div>
    </>
  );
}
