'use client';

import {
  FormEvent,
  useState,
} from 'react';
import {
  Check,
  Eye,
  EyeOff,
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

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmation, setShowConfirmation] =
    useState(false);

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

              <div className="password-field">
                <input
                  className="input"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
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

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  aria-label={
                    showPassword
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            <label>
              Confirmer le mot de passe

              <div className="password-field">
                <input
                  className="input"
                  type={
                    showConfirmation
                      ? 'text'
                      : 'password'
                  }
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

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmation(
                      (current) => !current
                    )
                  }
                  aria-label={
                    showConfirmation
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                >
                  {showConfirmation ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
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
        .password-field {
          position: relative;
          width: 100%;
        }

        .password-field .input {
          width: 100%;
          padding-right: 46px;
          box-sizing: border-box;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          width: 30px;
          height: 30px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #8f211c;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 6px;
        }

        .password-toggle:hover {
          background: #fff1f0;
        }

        .password-toggle:focus-visible {
          outline: 2px solid #8f211c;
          outline-offset: 2px;
        }

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
