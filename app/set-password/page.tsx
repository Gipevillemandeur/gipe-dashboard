'use client';

import {
  FormEvent,
  useEffect,
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
import { createClient } from '@/lib/supabase/client';

type LinkStatus =
  | 'checking'
  | 'ready'
  | 'invalid';

export default function SetPasswordPage() {
  /*
   * Au chargement : on lit le lien reçu par e-mail.
   *
   * Supabase place la session après le # de l'adresse
   * (#access_token=...&refresh_token=...), ou un
   * message d'erreur si le lien est périmé.
   */
  const [linkStatus, setLinkStatus] =
    useState<LinkStatus>('checking');

  const [linkError, setLinkError] =
    useState('');

  useEffect(() => {
    let cancelled = false;

    async function readLink() {
      const hash =
        window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : '';

      const params =
        new URLSearchParams(hash);

      const supabase =
        createClient();

      if (
        params.get('error') ||
        params.get('error_code')
      ) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname
        );

        if (!cancelled) {
          setLinkError(
            'Ce lien n’est plus valide : il a déjà été utilisé ou il a expiré. Demande un nouvel envoi de l’accès.'
          );
          setLinkStatus('invalid');
        }
        return;
      }

      const accessToken =
        params.get('access_token');

      const refreshToken =
        params.get('refresh_token');

      if (
        accessToken &&
        refreshToken
      ) {
        const { error: sessionError } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        // On retire les jetons de la barre d'adresse.
        window.history.replaceState(
          null,
          '',
          window.location.pathname
        );

        if (sessionError) {
          console.error(
            'Erreur ouverture session invitation:',
            sessionError
          );

          if (!cancelled) {
            setLinkError(
              'Ce lien n’est plus valide. Demande un nouvel envoi de l’accès.'
            );
            setLinkStatus('invalid');
          }
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setLinkError(
          'Ce lien n’est plus valide ou a déjà été utilisé. Demande un nouvel envoi de l’accès.'
        );
        setLinkStatus('invalid');
        return;
      }

      setLinkStatus('ready');
    }

    readLink();

    return () => {
      cancelled = true;
    };
  }, []);

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

      // Mot de passe créé : la personne est connectée,
      // on l'envoie directement sur le tableau de bord.
      setTimeout(() => {
        window.location.assign('/');
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

        {linkStatus === 'checking' ? (
          <div className="password-info">
            <Loader2
              size={18}
              className="password-spinner"
            />
            <div>Vérification du lien…</div>
          </div>
        ) : linkStatus === 'invalid' ? (
          <div className="login-error password-invalid">
            {linkError}
          </div>
        ) : success ? (
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

        .password-info {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 14px;
          border-radius: 10px;
          background: #f7f2eb;
          color: #6f6663;
          font-size: 13px;
        }

        .password-invalid {
          margin-top: 20px;
          font-size: 13px;
          line-height: 1.45;
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
