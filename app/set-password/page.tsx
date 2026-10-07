'use client';

import {
  FormEvent,
  useState,
} from 'react';
import {
  Check,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] =
    useState('');

  const [confirmation, setConfirmation] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError('');

    if (password.length < 8) {
      setError(
        'Le mot de passe doit contenir au moins 8 caractères.'
      );
      return;
    }

    if (password !== confirmation) {
      setError(
        'Les deux mots de passe ne correspondent pas.'
      );
      return;
    }

    setLoading(true);

    try {
      const supabase =
        createClient();

      const {
        data: {
          user,
        },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          'La session d’invitation est invalide ou expirée.'
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        throw new Error(
          updateError.message ||
            'Impossible de définir le mot de passe.'
        );
      }

      setSuccess(true);

      setTimeout(() => {
        router.replace('/login');
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de définir le mot de passe.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card card">
        <div className="login-mark">
          G
        </div>

        <div className="eyebrow">
          GIPE Villemandeur
        </div>

        <h1>
          Créer votre mot de passe
        </h1>

        <p className="section-sub">
          Définissez le mot de passe de votre compte.
        </p>

        {success ? (
          <div className="password-success">
            <Check size={20} />

            <div>
              Mot de passe enregistré.
              <br />
              Redirection…
            </div>
          </div>
        ) : (
          <form
            className="login-form"
            onSubmit={handleSubmit}
          >
            <label>
              Nouveau mot de passe

              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                required
                minLength={8}
              />
            </label>

            <label>
              Confirmer le mot de passe

              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(
                    event.target.value
                  )
                }
                required
                minLength={8}
              />
            </label>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              className="btn btn-primary login-submit"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <Loader2
                  size={15}
                  className="password-spinner"
                />
              ) : (
                <KeyRound size={15} />
              )}

              {loading
                ? 'Enregistrement…'
                : 'Créer mon mot de passe'}
            </button>
          </form>
        )}

        <div className="login-security">
          <ShieldCheck size={16} />

          <span>
            Votre mot de passe est géré
            directement par Supabase.
          </span>
        </div>
      </section>

      <style jsx>{`
        .password-success {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 14px;
          border-radius: 10px;
          border: 1px solid #c9e4d1;
          background: #f2fbf4;
          color: #27643a;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 600;
        }

        .password-spinner {
          animation: password-spin 0.8s linear infinite;
        }

        @keyframes password-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
