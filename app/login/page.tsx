'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LogIn, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function LoginContent() {
  const searchParams = useSearchParams();

  const requestedNext = searchParams.get('next') || '/';
  const next =
    requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/';

  const unauthorized = searchParams.get('error') === 'unauthorized';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    unauthorized
      ? 'Ce compte n’est pas autorisé à accéder au centre de gestion.'
      : ''
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      setError('Email ou mot de passe incorrect.');
      setLoading(false);
      return;
    }

    // Rechargement complet de la page : le site relit la session
    // fraîchement créée, sans rester bloqué sur l'écran de connexion.
    window.location.assign(next);
  }

  return (
    <main className="login-page">
      <section className="login-card card">
        <div className="login-mark">G</div>

        <div className="eyebrow">GIPE Villemandeur</div>

        <h1>Centre de gestion</h1>

        <p className="section-sub">
          Connecte-toi pour accéder aux outils administratifs du GIPE.
        </p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Mot de passe
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button
            className="btn btn-primary login-submit"
            disabled={loading}
            type="submit"
          >
            <LogIn size={15} />
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="login-security">
          <ShieldCheck size={16} />
          <span>
            Authentification gérée par Supabase. Aucun mot de passe n'est
            stocké dans le code du dashboard.
          </span>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
