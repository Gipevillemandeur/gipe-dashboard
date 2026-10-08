import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOfficePermission } from '@/lib/office-auth';

type AlertType = 'info' | 'urgent';

async function requireWebsiteAccess() {
  try {
    await requireOfficePermission('website');

    return {
      admin: createAdminClient(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        'AUTHENTICATION_REQUIRED'
      ) {
        return {
          error: NextResponse.json(
            {
              error: 'Non authentifié.',
            },
            {
              status: 401,
            }
          ),
        };
      }

      if (
        error.message ===
          'OFFICE_ACCESS_DENIED' ||
        error.message ===
          'OFFICE_PERMISSION_DENIED'
      ) {
        return {
          error: NextResponse.json(
            {
              error:
                'Compte non autorisé.',
            },
            {
              status: 403,
            }
          ),
        };
      }
    }

    console.error(
      'Erreur contrôle accès site:',
      error
    );

    return {
      error: NextResponse.json(
        {
          error:
            'Erreur de contrôle des accès.',
        },
        {
          status: 500,
        }
      ),
    };
  }
}

/* =========================================================
   GET
   ========================================================= */

export async function GET() {
  const auth =
    await requireWebsiteAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const {
    data,
    error,
  } = await admin
    .from('settings')
    .select('key,value')
    .in('key', [
      'alert_enabled',
      'alert_message',
      'alert_type',
    ]);

  if (error) {
    return NextResponse.json(
      {
        error:
          'Impossible de charger les paramètres du bandeau.',
      },
      {
        status: 500,
      }
    );
  }

  const settings: Record<
    string,
    string
  > = {};

  for (const row of data ?? []) {
    if (row.key) {
      settings[row.key] =
        row.value ?? '';
    }
  }

  return NextResponse.json({
    enabled:
      settings.alert_enabled ===
      'true',

    message:
      settings.alert_message ?? '',

    type:
      settings.alert_type ===
      'urgent'
        ? 'urgent'
        : 'info',
  });
}

/* =========================================================
   PUT
   ========================================================= */

export async function PUT(
  request: Request
) {
  const auth =
    await requireWebsiteAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const body =
    await request
      .json()
      .catch(() => null) as {
        enabled?: boolean;
        message?: string;
        type?: AlertType;
      } | null;

  if (!body) {
    return NextResponse.json(
      {
        error:
          'Données invalides.',
      },
      {
        status: 400,
      }
    );
  }

  const enabled =
    body.enabled === true;

  const message =
    String(
      body.message ?? ''
    ).trim();

  const type: AlertType =
    body.type === 'urgent'
      ? 'urgent'
      : 'info';

  const values = [
    {
      key: 'alert_enabled',
      value: enabled
        ? 'true'
        : 'false',
    },
    {
      key: 'alert_message',
      value: message,
    },
    {
      key: 'alert_type',
      value: type,
    },
  ];

  /*
   * La table settings n'a pas de contrainte UNIQUE
   * sur la colonne key.
   *
   * On met donc à jour les paramètres existants
   * directement par leur clé.
   *
   * S'ils n'existent pas encore, on les crée.
   */

  for (const item of values) {
    const {
      data: existingRows,
      error: selectError,
    } = await admin
      .from('settings')
      .select('key')
      .eq('key', item.key);

    if (selectError) {
      return NextResponse.json(
        {
          error:
            `Impossible de lire le paramètre ${item.key} : ${selectError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    if (
      existingRows &&
      existingRows.length > 0
    ) {
      const {
        error: updateError,
      } = await admin
        .from('settings')
        .update({
          value: item.value,
        })
        .eq('key', item.key);

      if (updateError) {
        return NextResponse.json(
          {
            error:
              `Impossible de modifier le paramètre ${item.key} : ${updateError.message}`,
          },
          {
            status: 500,
          }
        );
      }
    } else {
      const {
        error: insertError,
      } = await admin
        .from('settings')
        .insert({
          key: item.key,
          value: item.value,
        });

      if (insertError) {
        return NextResponse.json(
          {
            error:
              `Impossible de créer le paramètre ${item.key} : ${insertError.message}`,
          },
          {
            status: 500,
          }
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    enabled,
    message,
    type,
  });
}
