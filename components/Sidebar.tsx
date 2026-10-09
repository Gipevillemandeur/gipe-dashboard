'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  FileText,
  Home,
  Users,
  Globe2,
  BookOpen,
  UserRoundPlus,
  Settings,
  WalletCards,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import LogoutButton from '@/components/LogoutButton';

const items = [
  {
    href: '/',
    label: 'Tableau de bord',
    icon: Home,
  },
  {
    href: '/conseils',
    label: 'Scolarité',
    icon: Users,
  },
  {
    href: '/adherents',
    label: 'Adhérents',
    icon: UserRoundPlus,
  },
  {
    href: '/tresorerie',
    label: 'Trésorerie',
    icon: WalletCards,
  },
  {
    href: '/site',
    label: 'Site internet',
    icon: Globe2,
  },
  {
    href: '/agenda',
    label: 'Agenda',
    icon: CalendarDays,
  },
  {
    href: '/documents',
    label: 'Docs Drive',
    icon: FileText,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [role, setRole] =
    useState<string | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const response =
          await fetch(
            '/api/auth/access',
            {
              cache: 'no-store',
            }
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        if (
          !cancelled &&
          data?.authorized &&
          data?.role
        ) {
          setRole(data.role);
        }
      } catch (error) {
        console.error(
          'Impossible de récupérer le rôle:',
          error
        );
      }
    }

    loadRole();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Pas de menu sur les pages de connexion :
   * la page occupe tout l'écran.
   */
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/set-password';

  if (isAuthPage) {
    return (
      <style jsx global>{`
        .content {
          margin-left: 0 !important;
          width: 100% !important;
          padding: 0 !important;
        }
      `}</style>
    );
  }

  return (
    <>
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() =>
            setMobileOpen(true)
          }
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>

        <div className="mobile-brand">
          <img
            src="/images/Logo GIPE.png"
            alt="Logo GIPE Villemandeur"
            style={{
              width: '48px',
              height: '48px',
              objectFit: 'contain',
              display: 'block',
              flexShrink: 0,
            }}
          />

          <div>
            <strong>
              GIPE Villemandeur
            </strong>
            <span>
              Centre de gestion
            </span>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="mobile-overlay"
          onClick={() =>
            setMobileOpen(false)
          }
          aria-label="Fermer le menu"
        />
      )}

      <aside
        className={`sidebar ${
          mobileOpen
            ? 'sidebar-mobile-open'
            : ''
        }`}
      >
        <div
          className="brand"
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textAlign: 'center',
          }}
        >
          <img
            src="/images/Logo GIPE.png"
            alt="Logo GIPE Villemandeur"
            style={{
              width: '110px',
              height: '110px',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          <div
            className="brand-text"
            style={{
              textAlign: 'center',
            }}
          >
            <strong>
              GIPE Villemandeur
            </strong>
            <span>
              Centre de gestion
            </span>
          </div>

          <button
            type="button"
            className="mobile-close-button"
            onClick={() =>
              setMobileOpen(false)
            }
            aria-label="Fermer le menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="nav">
          {role && (
            <div
              className="sidebar-role"
              title={`Connecté en tant que ${role}`}
            >
              <ShieldCheck size={16} />

              <div>
                <span>
                  Connecté en tant que
                </span>

                <strong>
                  {role}
                </strong>
              </div>
            </div>
          )}

          {items.map((item) => {
            const Icon = item.icon;

            const active =
              item.href !== '#' &&
              (
                pathname ===
                  item.href ||
                pathname.startsWith(
                  `${item.href}/`
                )
              );

            return (
              <Link
                className={
                  active
                    ? 'active'
                    : ''
                }
                href={item.href}
                key={item.label}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}

          <div className="nav-sep" />

          <Link
            className={
              pathname ===
                '/configuration' ||
              pathname.startsWith(
                '/configuration/'
              ) ||
              pathname ===
                '/import-college'
                ? 'active'
                : ''
            }
            href="/configuration"
          >
            <Settings size={18} />
            Configuration
          </Link>

          <Link href="#">
            <BookOpen size={18} />
            Guide de passation
          </Link>

          <div className="nav-sep" />

          <LogoutButton />
        </nav>
      </aside>

      <style jsx>{`
        .sidebar-role {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 12px 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #fff1f0;
          border: 1px solid #eadfd5;
          color: #8f211c;
        }

        .sidebar-role > svg {
          flex-shrink: 0;
        }

        .sidebar-role > div {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-role span {
          font-size: 10px;
          line-height: 1.2;
          font-weight: 600;
          color: #7b6661;
        }

        .sidebar-role strong {
          font-size: 12px;
          line-height: 1.25;
          font-weight: 800;
          color: #8f211c;
          overflow-wrap: anywhere;
        }

        @media (max-width: 700px) {
          .sidebar-role {
            margin-left: 12px;
            margin-right: 12px;
          }
        }
      `}</style>
    </>
  );
}
