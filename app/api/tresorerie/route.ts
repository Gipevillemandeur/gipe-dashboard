import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const PAYMENT_METHODS = new Set([
  'cheque',
  'cash',
  'transfer',
  'online',
  'other',
]);

const TRANSACTION_TYPES = new Set([
  'income',
  'expense',
]);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
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
        { status: 500 }
      ),
    };
  }

  if (!data) {
    return {
      error: NextResponse.json(
        { error: 'Compte non autorisé.' },
        { status: 403 }
      ),
    };
  }

  return { admin };
}

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function parseAmount(value: unknown) {
  const amount = Number(
    cleanString(value).replace(',', '.')
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return !Number.isNaN(date.getTime());
}

async function getActiveYear(
  admin: ReturnType<typeof createAdminClient>
) {
  const { data, error } = await admin
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      'Aucune année scolaire active.'
    );
  }

  return data;
}

async function readAndValidateBody(
  request: Request
) {
  const body = await request.json().catch(() => null) as
    | Record<string, unknown>
    | null;

  const date = cleanString(body?.date);
  const type = cleanString(body?.type);
  const category = cleanString(body?.category);
  const label = cleanString(body?.label);
  const paymentMethod = cleanString(
    body?.paymentMethod
  );
  const note = cleanString(body?.note);
  const amount = parseAmount(body?.amount);

  if (!validDate(date)) {
    throw new Error('La date est invalide.');
  }

  if (!TRANSACTION_TYPES.has(type)) {
    throw new Error(
      'Le type d’opération est invalide.'
    );
  }

  if (!category) {
    throw new Error(
      'La catégorie est obligatoire.'
    );
  }

  if (!label) {
    throw new Error(
      'Le libellé est obligatoire.'
    );
  }

  if (label.length > 200) {
    throw new Error(
      'Le libellé est trop long.'
    );
  }

  if (!amount) {
    throw new Error(
      'Le montant doit être supérieur à 0.'
    );
  }

  if (
    paymentMethod &&
    !PAYMENT_METHODS.has(paymentMethod)
  ) {
    throw new Error(
      'Le mode de paiement est invalide.'
    );
  }

  if (note.length > 500) {
    throw new Error('La note est trop longue.');
  }

  return {
    date,
    type,
    category,
    label,
    paymentMethod: paymentMethod || null,
    note: note || null,
    amount,
  };
}

export async function GET() {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  try {
    const year = await getActiveYear(admin);

    const { data: transactions, error } =
      await admin
        .from('gipe_transactions')
        .select(
          'id,transaction_date,transaction_type,category,label,amount,payment_method,note,created_at,updated_at'
        )
        .eq('school_year_id', year.id)
        .order('transaction_date', {
          ascending: false,
        })
        .order('created_at', {
          ascending: false,
        });

    if (error) {
      throw new Error(error.message);
    }

    const rows = transactions || [];

    let totalRecettes = 0;
    let totalDepenses = 0;

    for (const row of rows) {
      const amount = Number(row.amount) || 0;

      if (
        row.transaction_type === 'income'
      ) {
        totalRecettes += amount;
      }

      if (
        row.transaction_type === 'expense'
      ) {
        totalDepenses += amount;
      }
    }

    totalRecettes = Math.round(
      totalRecettes * 100
    ) / 100;

    totalDepenses = Math.round(
      totalDepenses * 100
    ) / 100;

    return NextResponse.json({
      schoolYear: year.label,
      totalRecettes,
      totalDepenses,
      solde: Math.round(
        (totalRecettes - totalDepenses) * 100
      ) / 100,
      transactions: rows.map((row) => ({
        id: row.id,
        date: row.transaction_date,
        type: row.transaction_type,
        category: row.category,
        label: row.label,
        amount: Number(row.amount),
        paymentMethod: row.payment_method,
        note: row.note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error(
      'Erreur chargement trésorerie GIPE:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de charger la trésorerie.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  try {
    const input = await readAndValidateBody(
      request
    );

    const year = await getActiveYear(admin);

    const { data, error } = await admin
      .from('gipe_transactions')
      .insert({
        school_year_id: year.id,
        transaction_date: input.date,
        transaction_type: input.type,
        category: input.category,
        label: input.label,
        amount: input.amount,
        payment_method: input.paymentMethod,
        note: input.note,
      })
      .select(
        'id,transaction_date,transaction_type,category,label,amount,payment_method,note'
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        transaction: {
          id: data.id,
          date: data.transaction_date,
          type: data.transaction_type,
          category: data.category,
          label: data.label,
          amount: Number(data.amount),
          paymentMethod: data.payment_method,
          note: data.note,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’ajouter l’opération.',
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  try {
    const body = await request.json().catch(
      () => null
    ) as Record<string, unknown> | null;

    const id = cleanString(body?.id);

    if (!id) {
      return NextResponse.json(
        { error: 'Opération introuvable.' },
        { status: 400 }
      );
    }

    const input = await readAndValidateBody(
      new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(body),
      })
    );

    const year = await getActiveYear(admin);

    const { data, error } = await admin
      .from('gipe_transactions')
      .update({
        transaction_date: input.date,
        transaction_type: input.type,
        category: input.category,
        label: input.label,
        amount: input.amount,
        payment_method: input.paymentMethod,
        note: input.note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('school_year_id', year.id)
      .select(
        'id,transaction_date,transaction_type,category,label,amount,payment_method,note'
      )
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            'Opération introuvable pour l’année active.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      transaction: {
        id: data.id,
        date: data.transaction_date,
        type: data.transaction_type,
        category: data.category,
        label: data.label,
        amount: Number(data.amount),
        paymentMethod: data.payment_method,
        note: data.note,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de modifier l’opération.',
      },
      { status: 400 }
    );
  }
}
