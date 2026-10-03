import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type AlertType = 'info' | 'urgent';

async function requireAdmin() {
  const supabase = await createClient();

  const { data: authData } =
    await supabase.auth.getClaims();

  const userId =
    authData?.claims?.sub;

  if (!userId) {
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

  const admin = createAdminClient();

  const {
    data,
    error,
  } = await admin
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        {
          error:
            'Impossible de vérifier les droits administrateur.',
        },
        {
          status: 500,
        }
      ),
    };
  }

  if (!data) {
    return {
      error: NextResponse.json(
        {
          error: 'Compte non autorisé.',
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    admin,
  };
}

/* =========================================================
   GET
   Lecture du bandeau d'alerte
   ========================================================= */

export async function GET() {
  const auth = await requireAdmin();

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

  const settings: Record<string, string> = {};

  for (const row of data ?? []) {
    if (row.key) {
      settings[row.key] = row.value ?? '';
    }
  }

  return NextResponse.json({
    enabled:
      settings.alert_enabled === 'true',

    message:
      settings.alert_message ?? '',

    type:
      settings.alert_type === 'urgent'
        ? 'urgent'
        : 'info',
  });
}

/* =========================================================
   PUT
   Modification du bandeau d'alerte
   ========================================================= */

export async function PUT(
  request: Request
) {
  const auth = await requireAdmin();

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
        error: 'Données invalides.',
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

  /*
   * On utilise upsert afin de fonctionner
   * aussi bien si les paramètres existent
   * déjà que s'ils doivent être créés.
   */

  const {
    error,
  } = await admin
    .from('settings')
    .upsert(
      [
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
      ],
      {
        onConflict: 'key',
      }
    );

  if (error) {
    return NextResponse.json(
      {
        error:
          `Impossible d’enregistrer le bandeau : ${error.message}`,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,
    enabled,
    message,
    type,
  });
}
