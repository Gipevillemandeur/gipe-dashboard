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
      if (
        error.message ===
        'AUTHENTICATION_REQUIRED'
      ) {
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
          error:
            'Erreur de contrôle des accès.',
        },
        { status: 500 }
      ),
    }
  }
}

export async function GET() {
  const auth =
    await requireTreasuryAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  const {
    data,
    error,
  } = await admin
    .from('treasury_transactions')
    .select('*')
    .order('date', {
      ascending: false,
    })
    .order('id', {
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

  return NextResponse.json({
    transactions: data || [],
  })
}

export async function POST(
  request: Request
) {
  const auth =
    await requireTreasuryAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body =
      await request.json()

    const {
      date,
      label,
      description,
      category,
      amount,
      type,
      payment_method,
      reference,
    } = body

    if (!date) {
      return NextResponse.json(
        {
          error:
            'La date est obligatoire.',
        },
        { status: 400 }
      )
    }

    if (!label) {
      return NextResponse.json(
        {
          error:
            'Le libellé est obligatoire.',
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
          error:
            'Le montant est obligatoire.',
        },
        { status: 400 }
      )
    }

    const numericAmount =
      Number(amount)

    if (
      !Number.isFinite(
        numericAmount
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Le montant est invalide.',
        },
        { status: 400 }
      )
    }

    const {
      data,
      error,
    } = await admin
      .from(
        'treasury_transactions'
      )
      .insert({
        date,
        label,
        description:
          description || null,
        category:
          category || null,
        amount:
          numericAmount,
        type:
          type || null,
        payment_method:
          payment_method || null,
        reference:
          reference || null,
      })
      .select('*')
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
        transaction: data,
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
            : 'Impossible d’ajouter la transaction.',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request
) {
  const auth =
    await requireTreasuryAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body =
      await request.json()

    const id =
      Number(body?.id)

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
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

    if (
      body.date !== undefined
    ) {
      updateData.date =
        body.date
    }

    if (
      body.label !== undefined
    ) {
      updateData.label =
        body.label
    }

    if (
      body.description !==
      undefined
    ) {
      updateData.description =
        body.description || null
    }

    if (
      body.category !==
      undefined
    ) {
      updateData.category =
        body.category || null
    }

    if (
      body.amount !==
      undefined
    ) {
      const numericAmount =
        Number(body.amount)

      if (
        !Number.isFinite(
          numericAmount
        )
      ) {
        return NextResponse.json(
          {
            error:
              'Le montant est invalide.',
          },
          { status: 400 }
        )
      }

      updateData.amount =
        numericAmount
    }

    if (
      body.type !== undefined
    ) {
      updateData.type =
        body.type || null
    }

    if (
      body.payment_method !==
      undefined
    ) {
      updateData.payment_method =
        body.payment_method ||
        null
    }

    if (
      body.reference !==
      undefined
    ) {
      updateData.reference =
        body.reference || null
    }

    if (
      Object.keys(updateData)
        .length === 0
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
      .from(
        'treasury_transactions'
      )
      .update(updateData)
      .eq('id', id)
      .select('*')
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
      transaction: data,
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
  const auth =
    await requireTreasuryAccess()

  if ('error' in auth) {
    return auth.error
  }

  const { admin } = auth

  try {
    const body =
      await request.json()

    const id =
      Number(body?.id)

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
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
      .from(
        'treasury_transactions'
      )
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
