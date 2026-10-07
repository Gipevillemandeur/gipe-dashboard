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
  const [mobileOpen, setMobileOpen] = useState(false);

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
      {/* Bouton hamburger mobile */}
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu size={24} />
      </button>

      {/* Fond sombre mobile */}
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer le menu"
        />
      )}

      <aside
        className={`sidebar ${
          mobileOpen ? 'sidebar-mobile-open' : ''
        }`}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">G</div>

            <div>
              <div className="sidebar-title">GIPE</div>
              <div className="sidebar-subtitle">Villemandeur</div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = item.icon;

            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${
                  isActive ? 'sidebar-link-active' : ''
                }`}
              >
                <Icon size={20} strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <Link
            href="/configuration"
            className={`sidebar-link ${
              pathname === '/configuration' ||
              pathname.startsWith('/configuration/')
                ? 'sidebar-link-active'
                : ''
            }`}
          >
            <Settings size={20} strokeWidth={2} />
            <span>Configuration</span>
          </Link>

          <Link
            href="/guide"
            className={`sidebar-link ${
              pathname === '/guide' ||
              pathname.startsWith('/guide/')
                ? 'sidebar-link-active'
                : ''
            }`}
          >
            <BookOpen size={20} strokeWidth={2} />
            <span>Guide de passation</span>
          </Link>

          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
