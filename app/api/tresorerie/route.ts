import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'

async function requireTreasuryAccess() {
  try {
    await requireOfficePermission('treasury')

    return {
      admin: createAdminClient(),
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'AUTHENTICATION_REQUIRED') {
        return {
          error: NextResponse.json(
            {
              error: 'Non authentifié.',
            },
            { status: 401 }
          ),
        }
      }

      if (
        error.message === 'OFFICE_ACCESS_DENIED' ||
        error.message === 'OFFICE_PERMISSION_DENIED'
      ) {
        return {
          error: NextResponse.json(
            {
              error: 'Compte non autorisé.',
            },
            { status: 403 }
          ),
        }
      }
    }

    console.error(
      'Erreur contrôle accès trésorerie:',
      error
    )

    return {
      error: NextResponse.json(
        {
          error: 'Erreur de contrôle des accès.',
        },
        { status: 500 }
      ),
    }
  }
}

export async function GET() {
  const auth = await requireTreasuryAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  const {
    data: schoolYear,
    error: schoolYearError,
  } = await admin
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
    .maybeSingle()

  if (schoolYearError) {
    console.error(
      'Erreur chargement année scolaire:',
      schoolYearError
    )

    return NextResponse.json(
      {
        error:
          `Impossible de charger l'année scolaire : ${schoolYearError.message}`,
      },
      { status: 500 }
    )
  }

  if (!schoolYear) {
    return NextResponse.json({
      schoolYear: null,
      transactions: [],
    })
  }

  const {
    data,
    error,
  } = await admin
    .from('gipe_transactions')
    .select(`
      id,
      school_year_id,
      transaction_date,
      transaction_type,
      category,
      label,
      amount,
      payment_method,
      note,
      created_at,
      updated_at
    `)
    .eq('school_year_id', schoolYear.id)
    .order('transaction_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    console.error(
      'Erreur chargement trésorerie:',
      error
    )

    return NextResponse.json(
      {
        error:
          `Impossible de charger la trésorerie : ${error.message}`,
      },
      { status: 500 }
    )
  }

  const transactions = (data || []).map(
    (transaction) => ({
      id: transaction.id,
      date: transaction.transaction_date,
      type: transaction.transaction_type,
      category: transaction.category,
      label: transaction.label,
      amount: Number(transaction.amount),
      paymentMethod: transaction.payment_method,
      note: transaction.note,
    })
  )

  return NextResponse.json({
    schoolYear: schoolYear.label,
    transactions,
  })
}

export async function POST(
  request: Request
) {
  const auth = await requireTreasuryAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body = await request.json()

    const {
      date,
      label,
      category,
      amount,
      type,
      paymentMethod,
      note,
    } = body

    if (!date) {
      return NextResponse.json(
        {
          error: 'La date est obligatoire.',
        },
        { status: 400 }
      )
    }

    if (!label || !String(label).trim()) {
      return NextResponse.json(
        {
          error: 'Le libellé est obligatoire.',
        },
        { status: 400 }
      )
    }

    if (!category || !String(category).trim()) {
      return NextResponse.json(
        {
          error: 'La catégorie est obligatoire.',
        },
        { status: 400 }
      )
    }

    if (type !== 'income' && type !== 'expense') {
      return NextResponse.json(
        {
          error: 'Le type de transaction est invalide.',
        },
        { status: 400 }
      )
    }

    if (
      amount === undefined ||
      amount === null ||
      amount === ''
    ) {
      return NextResponse.json(
        {
          error: 'Le montant est obligatoire.',
        },
        { status: 400 }
      )
    }

    const numericAmount = Number(
      String(amount).replace(',', '.')
    )

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      return NextResponse.json(
        {
          error: 'Le montant est invalide.',
        },
        { status: 400 }
      )
    }

    const {
      data: schoolYear,
      error: schoolYearError,
    } = await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle()

    if (schoolYearError || !schoolYear) {
      return NextResponse.json(
        {
          error:
            schoolYearError?.message ||
            "Aucune année scolaire active n'est définie.",
        },
        { status: 409 }
      )
    }

    const {
      data,
      error,
    } = await admin
      .from('gipe_transactions')
      .insert({
        school_year_id: schoolYear.id,
        transaction_date: date,
        transaction_type: type,
        category: String(category).trim(),
        label: String(label).trim(),
        amount: numericAmount,
        payment_method:
          paymentMethod || null,
        note: note || null,
      })
      .select(`
        id,
        school_year_id,
        transaction_date,
        transaction_type,
        category,
        label,
        amount,
        payment_method,
        note,
        created_at,
        updated_at
      `)
      .single()

    if (error) {
      console.error(
        'Erreur création transaction:',
        error
      )

      return NextResponse.json(
        {
          error:
            `Impossible d'ajouter la transaction : ${error.message}`,
        },
        { status: 500 }
      )
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
    )
  } catch (error) {
    console.error(
      'Erreur API trésorerie:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'ajouter la transaction.",
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request
) {
  const auth = await requireTreasuryAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body = await request.json()

    const id = String(body?.id || '').trim()

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Identifiant de transaction invalide.',
        },
        { status: 400 }
      )
    }

    const updateData: Record<
      string,
      unknown
    > = {}

    if (body.date !== undefined) {
      updateData.transaction_date =
        body.date
    }

    if (body.label !== undefined) {
      const label =
        String(body.label || '').trim()

      if (!label) {
        return NextResponse.json(
          {
            error:
              'Le libellé est obligatoire.',
          },
          { status: 400 }
        )
      }

      updateData.label = label
    }

    if (body.category !== undefined) {
      const category =
        String(body.category || '').trim()

      if (!category) {
        return NextResponse.json(
          {
            error:
              'La catégorie est obligatoire.',
          },
          { status: 400 }
        )
      }

      updateData.category = category
    }

    if (body.amount !== undefined) {
      const numericAmount = Number(
        String(body.amount).replace(',', '.')
      )

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount < 0
      ) {
        return NextResponse.json(
          {
            error: 'Le montant est invalide.',
          },
          { status: 400 }
        )
      }

      updateData.amount = numericAmount
    }

    if (body.type !== undefined) {
      if (
        body.type !== 'income' &&
        body.type !== 'expense'
      ) {
        return NextResponse.json(
          {
            error:
              'Le type de transaction est invalide.',
          },
          { status: 400 }
        )
      }

      updateData.transaction_type =
        body.type
    }

    if (body.paymentMethod !== undefined) {
      updateData.payment_method =
        body.paymentMethod || null
    }

    if (body.note !== undefined) {
      updateData.note =
        body.note || null
    }

    if (
      Object.keys(updateData).length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Aucune modification à enregistrer.',
        },
        { status: 400 }
      )
    }

    const {
      data,
      error,
    } = await admin
      .from('gipe_transactions')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        school_year_id,
        transaction_date,
        transaction_type,
        category,
        label,
        amount,
        payment_method,
        note,
        created_at,
        updated_at
      `)
      .single()

    if (error) {
      console.error(
        'Erreur modification transaction:',
        error
      )

      return NextResponse.json(
        {
          error:
            `Impossible de modifier la transaction : ${error.message}`,
        },
        { status: 500 }
      )
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
    })
  } catch (error) {
    console.error(
      'Erreur API modification trésorerie:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de modifier la transaction.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request
) {
  const auth = await requireTreasuryAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body = await request.json()

    const id = String(body?.id || '').trim()

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Identifiant de transaction invalide.',
        },
        { status: 400 }
      )
    }

    const {
      error,
    } = await admin
      .from('gipe_transactions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(
        'Erreur suppression transaction:',
        error
      )

      return NextResponse.json(
        {
          error:
            `Impossible de supprimer la transaction : ${error.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(
      'Erreur API suppression trésorerie:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer la transaction.',
      },
      { status: 500 }
    )
  }
}
