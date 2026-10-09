'use client';

import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();

    // Rechargement complet : on repart d'une page propre, sans session.
    window.location.assign('/login');
  }

  return <button className="nav-button" onClick={logout} type="button"><LogOut size={16}/> Déconnexion</button>;
}
