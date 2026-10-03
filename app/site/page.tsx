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

        <div className="site-menu-grid">
          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="site-menu-link"
              >
                <div className="card site-menu-card">
                  <div className="site-menu-card-inner">
                    <div className="site-menu-icon stat-icon">
                      <Icon size={21} />
                    </div>

                    <div className="site-menu-content">
                      <h3>
                        {item.title}
                      </h3>

                      <p>
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
