import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_KEYS = [
  'adresse',
  'email',
  'rna',
  'president',
  'facebook',
  'instagram',
] as const;

type SettingKey = (typeof ALLOWED_KEYS)[number];

async function requireAdmin() {
  const supabase = await createClient();

  const { data: authData } =
    await supabase.auth.getClaims();

  const userId = authData?.claims?.sub;

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
    .in('key', ALLOWED_KEYS);

  if (error) {
    return NextResponse.json(
      {
        error:
          'Impossible de charger les paramètres.',
      },
      {
        status: 500,
      }
    );
  }

  const settings: Record<
    SettingKey,
    string
  > = {
    adresse: '',
    email: '',
    rna: '',
    president: '',
    facebook: '',
    instagram: '',
  };

  for (const row of data ?? []) {
    if (
      ALLOWED_KEYS.includes(
        row.key as SettingKey
      )
    ) {
      settings[
        row.key as SettingKey
      ] = row.value ?? '';
    }
  }

  return NextResponse.json(
    settings
  );
}

/* =========================================================
   PUT
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
      .catch(() => null);

  if (
    !body ||
    typeof body !== 'object'
  ) {
    return NextResponse.json(
      {
        error: 'Données invalides.',
      },
      {
        status: 400,
      }
    );
  }

  /*
   * On ne prend que les six paramètres
   * autorisés.
   */

  const values =
    ALLOWED_KEYS.map(
      (key) => ({
        key,
        value: String(
          body[key] ?? ''
        ).trim(),
      })
    );

  /*
   * Même principe que pour le bandeau :
   * on ne dépend pas d'une contrainte UNIQUE
   * sur la colonne key.
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
    settings: Object.fromEntries(
      values.map((item) => [
        item.key,
        item.value,
      ])
    ),
  });
}
