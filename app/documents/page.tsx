'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Loader2, XCircle } from 'lucide-react';

type GoogleStatus =
  | 'idle'
  | 'connected'
  | 'cancelled'
  | 'error';

export default function DocumentsPage() {
  const [status, setStatus] =
    useState<GoogleStatus>('idle');

  const [message, setMessage] =
    useState('');

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const google =
      params.get('google');

    if (google === 'connected') {
      setStatus('connected');
      setMessage(
        'La connexion Google Drive est bien enregistrée.'
      );
    }

    if (google === 'cancelled') {
      setStatus('cancelled');
      setMessage(
        'La connexion Google Drive a été annulée.'
      );
    }

    if (
      google === 'missing_code' ||
      google === 'token_error' ||
      google === 'no_refresh_token' ||
      google === 'save_error' ||
      google === 'error'
    ) {
      setStatus('error');

      const messages: Record<string, string> = {
        missing_code:
          'Google n’a pas fourni le code de connexion.',
        token_error:
          'Google a refusé la récupération du jeton de connexion.',
        no_refresh_token:
          'Google n’a pas fourni le jeton permanent nécessaire.',
        save_error:
          'La connexion Google a été obtenue, mais son enregistrement a échoué.',
        error:
          'Une erreur est survenue pendant la connexion Google Drive.',
      };

      setMessage(
        messages[google] ||
          'Une erreur est survenue.'
      );
    }

    if (google) {
      window.history.replaceState(
        {},
        '',
        '/documents'
      );
    }
  }, []);

  function connectGoogleDrive() {
    window.location.href =
      '/api/google/drive/connect';
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Gestion de l’association
          </div>

          <h1>Documents</h1>

          <div className="kicker">
            Gestion du Google Drive de l’association.
          </div>
        </div>
      </div>

      <section className="card documents-connection-card">
        <div className="documents-icon">
          <Cloud size={34} />
        </div>

        <div className="documents-content">
          <div className="eyebrow">
            Google Drive
          </div>

          <h2>
            Connecter le Drive de l’association
          </h2>

          <p>
            Le Dashboard pourra ensuite permettre
            de consulter et gérer les fichiers et
            dossiers du Google Drive de
            l’association.
          </p>

          {status === 'connected' && (
            <div className="documents-status documents-status-success">
              <CheckCircle2 size={18} />

              <span>
                {message}
              </span>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="documents-status documents-status-warning">
              <XCircle size={18} />

              <span>
                {message}
              </span>
            </div>
          )}

          {status === 'error' && (
            <div className="documents-status documents-status-error">
              <XCircle size={18} />

              <span>
                {message}
              </span>
            </div>
          )}

          <div className="documents-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={connectGoogleDrive}
            >
              <Cloud size={16} />

              {status === 'connected'
                ? 'Reconnecter Google Drive'
                : 'Connecter Google Drive'}
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .documents-connection-card {
          display: flex;
          gap: 24px;
          align-items: flex-start;
          padding: 28px;
          max-width: 900px;
        }

        .documents-icon {
          width: 64px;
          height: 64px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: #fff0d9;
          color: #8f211c;
        }

        .documents-content {
          min-width: 0;
          flex: 1;
        }

        .documents-content h2 {
          margin: 4px 0 8px;
          font-size: 23px;
          line-height: 1.2;
        }

        .documents-content p {
          margin: 0;
          max-width: 680px;
          color: var(--gipe-muted);
          line-height: 1.6;
        }

        .documents-status {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 20px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14px;
          line-height: 1.5;
        }

        .documents-status-success {
          color: #216e39;
          background: #edf8f0;
          border: 1px solid #c8e8d0;
        }

        .documents-status-warning {
          color: #8a5a00;
          background: #fff8e6;
          border: 1px solid #f0dfad;
        }

        .documents-status-error {
          color: #8a2b22;
          background: #fff0ee;
          border: 1px solid #efc8c4;
        }

        .documents-actions {
          margin-top: 24px;
        }

        @media (max-width: 700px) {
          .documents-connection-card {
            flex-direction: column;
            padding: 20px;
            gap: 18px;
          }

          .documents-icon {
            width: 54px;
            height: 54px;
            border-radius: 14px;
          }

          .documents-content h2 {
            font-size: 20px;
          }

          .documents-actions .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
