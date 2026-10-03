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
} from 'lucide-react';

import LogoutButton from '@/components/LogoutButton';

const items = [
  { href: '/', label: 'Tableau de bord', icon: Home },
  { href: '/conseils', label: 'Conseils de classe', icon: Users },
  { href: '/adherents', label: 'Adhérents', icon: UserRoundPlus },
  { href: '/tresorerie', label: 'Trésorerie', icon: WalletCards },
  { href: '#', label: 'Site internet', icon: Globe2 },
  { href: '#', label: 'Agenda', icon: CalendarDays },
  { href: '#', label: 'Documents', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">G</div>

        <div className="brand-text">
          <strong>GIPE Villemandeur</strong>
          <span>Centre de gestion</span>
        </div>
      </div>

      <nav className="nav">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href !== '#' &&
            (pathname === item.href ||
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              className={active ? 'active' : ''}
              href={item.href}
              key={item.label}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}

        <div className="nav-sep" />

        <Link
          className={
            pathname === '/configuration' ||
            pathname.startsWith('/configuration/') ||
            pathname === '/import-college'
              ? 'active'
              : ''
          }
          href="/configuration"
        >
          <Settings size={16} />
          Configuration
        </Link>

        <Link href="#">
          <BookOpen size={16} />
          Guide de passation
        </Link>

        <div className="nav-sep" />
        <LogoutButton />
      </nav>
    </aside>
  );
}
