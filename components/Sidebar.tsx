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

  return (
    <>
      {/* Barre mobile */}
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
          <div className="mobile-brand-mark">
            G
          </div>

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

      {/* Fond derrière le menu */}
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

      {/* Menu */}
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
              width: '95px',
              height: '95px',
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
          {items.map((item) => {
            const Icon = item.icon;

            const active =
              item.href !== '#' &&
              (pathname === item.href ||
                pathname.startsWith(
                  `${item.href}/`
                ));

            return (
              <Link
                className={
                  active ? 'active' : ''
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
    </>
  );
}
