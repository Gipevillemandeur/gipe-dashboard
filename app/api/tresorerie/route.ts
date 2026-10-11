import { NextResponse } from 'next/server'
import { euros, logActivity, quote } from '@/lib/activity'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'
import { getGoogleAccessToken } from '@/lib/google-drive'
import { trashDriveFile } from '@/lib/receipts'

/*
 * TRÉSORERIE
 *
 * Deux comptes : 'bank' (banque) et 'cash' (caisse).
 * Trois types d'opérations :
 *  - 'income'   : recette sur un compte ;
 *  - 'expense'  : dépense sur un compte ;
 *  - 'transfer' : mouvement d'un compte vers l'autre
 *                 (ni recette ni dépense).
 *
 * GET    → année, soldes de départ, opérations
 * POST   → nouvelle opération
 * PUT    → modification d'une opération, ou soldes de départ
 * DELETE → suppression d'une opération
 */

type Admin = ReturnType<typeof createAdminClient>
type Account = 'bank' | 'cash'
type TxType = 'income' | 'expense' | 'transfer'

const ACCOUNTS: Account[] = ['bank', 'cash']
const ACCOUNT_LABELS: Record<Account, string> = { bank: 'banque', cash: 'caisse' }
const PAYMENT_METHODS = ['cheque', 'cash', 'transfer', 'online', 'other']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function requireTreasuryAccess(): Promise<{ admin: Admin } | { error: NextResponse }> {
  try {
    await requireOfficePermission('treasury')
    return { admin: createAdminClient() }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (message === 'AUTHENTICATION_REQUIRED') return { error: fail('Non authentifié.', 401) }
    if (message === 'OFFICE_ACCESS_DENIED' || message === 'OFFICE_PERMISSION_DENIED') {
      return { error: fail('Compte non autorisé.', 403) }
    }

    console.error('Erreur contrôle accès trésorerie:', error)
    return { error: fail('Erreur de contrôle des accès.', 500) }
  }
}

/* Montant positif arrondi au centime (null si invalide). */
function parsePositiveAmount(value: unknown) {
  const amount = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100) / 100
}

function parseBalance(value: unknown) {
  if (value === undefined || value === null || value === '') return 0
  const amount = Number(String(value).replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100) / 100
}

function isAccount(value: unknown): value is Account {
  return ACCOUNTS.includes(value as Account)
}

function typeLabel(type: string, withArticle: 'un' | 'le') {
  if (type === 'income') return withArticle === 'un' ? 'une recette' : 'la recette'
  if (type === 'expense') return withArticle === 'un' ? 'une dépense' : 'la dépense'
  return withArticle === 'un' ? 'un mouvement' : 'le mouvement'
}

function accountsText(row: { transaction_type: string; account: string; transfer_to?: string | null }) {
  if (row.transaction_type === 'transfer') {
    return `${ACCOUNT_LABELS[row.account as Account] || row.account} → ${ACCOUNT_LABELS[row.transfer_to as Account] || row.transfer_to}`
  }
  return ACCOUNT_LABELS[row.account as Account] || row.account
}

async function activeYear(admin: Admin) {
  const { data, error } = await admin
    .from('school_years')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`Impossible de charger l'année scolaire : ${error.message}`)
  return data as
    | { id: string; label: string; initial_balance: number | null; initial_cash_balance?: number | null }
    | null
}

/*
 * Une opération n'est modifiable que si elle appartient à l'année
 * EN COURS. Les recettes d'adhésion se modifient depuis Adhérents.
 */
async function checkTransactionIsEditable(admin: Admin, id: string) {
  const { data, error } = await admin
    .from('gipe_transactions')
    .select('id, school_year_id, membership_id')
    .eq('id', id)
    .maybeSingle()

  if (error) return fail(`Impossible de vérifier l'opération : ${error.message}`, 500)
  if (!data) return fail('Opération introuvable.', 404)

  if (data.membership_id) {
    return fail(
      'Cette recette vient d’une adhésion : modifie-la (ou passe-la en « non payé ») depuis la page Adhérents.',
      409
    )
  }

  const { data: year, error: yearError } = await admin
    .from('school_years')
    .select('is_active')
    .eq('id', data.school_year_id)
    .maybeSingle()

  if (yearError) return fail(`Impossible de vérifier l'année : ${yearError.message}`, 500)
  if (!year?.is_active) {
    return fail('Cette opération appartient à une année clôturée : elle ne peut plus être modifiée.', 409)
  }

  return null
}

/*
 * Vérifie et prépare les champs d'une opération.
 * `partial` : en modification, seuls les champs envoyés comptent,
 * complétés par la valeur actuelle (`current`).
 */
function buildFields(body: any, current?: any) {
  const pick = (key: string, fallback: unknown) =>
    body[key] !== undefined ? body[key] : fallback

  const type = pick('type', current?.transaction_type) as TxType
  if (!['income', 'expense', 'transfer'].includes(type)) {
    return { error: 'Choisis le type : recette, dépense ou mouvement entre la caisse et la banque.' }
  }

  const date = String(pick('date', current?.transaction_date) || '')
  if (!DATE_PATTERN.test(date)) return { error: 'La date est obligatoire.' }

  const amount = parsePositiveAmount(pick('amount', current?.amount))
  if (amount === null) return { error: 'Le montant doit être supérieur à 0.' }

  const account = pick('account', current?.account)
  if (!isAccount(account)) return { error: 'Choisis le compte : banque ou caisse.' }

  const note = String(pick('note', current?.note) || '').trim() || null

  if (type === 'transfer') {
    const transferTo = pick('transferTo', current?.transfer_to)
    if (!isAccount(transferTo) || transferTo === account) {
      return { error: 'Un mouvement va de la caisse vers la banque, ou de la banque vers la caisse.' }
    }

    const label =
      String(pick('label', current?.label) || '').trim() ||
      (account === 'cash' ? 'Dépôt d’espèces à la banque' : 'Retrait d’espèces pour la caisse')

    return {
      fields: {
        transaction_type: type,
        transaction_date: date,
        amount,
        account,
        transfer_to: transferTo,
        category: 'Mouvement interne',
        label,
        payment_method: null,
        note,
      },
    }
  }

  const label = String(pick('label', current?.label) || '').trim()
  if (!label) return { error: 'Le libellé est obligatoire.' }

  const category = String(pick('category', current?.category) || '').trim()
  if (!category || category === 'Mouvement interne') return { error: 'La catégorie est obligatoire.' }

  const paymentMethod = String(pick('paymentMethod', current?.payment_method) || '').trim() || null
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    return { error: 'Mode de paiement invalide.' }
  }

  return {
    fields: {
      transaction_type: type,
      transaction_date: date,
      amount,
      account,
      transfer_to: null,
      category,
      label,
      payment_method: paymentMethod,
      note,
    },
  }
}

function toClient(row: any) {
  return {
    id: row.id,
    date: row.transaction_date,
    type: row.transaction_type,
    category: row.category,
    label: row.label,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    note: row.note,
    account: (row.account as Account) || 'bank',
    transferTo: row.transfer_to || null,
    createdAt: row.created_at,
    // Recette créée automatiquement par une adhésion
    fromMembership: Boolean(row.membership_id),
    receipt: row.receipt_file_id
      ? { fileId: row.receipt_file_id, name: row.receipt_file_name || 'Justificatif', url: row.receipt_url || null }
      : null,
  }
}

/* ---------------------------------------------------------
 * GET
 * --------------------------------------------------------- */
export async function GET() {
  const auth = await requireTreasuryAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  try {
    const year = await activeYear(admin)

    if (!year) {
      return NextResponse.json({
        schoolYear: null,
        initialBalances: { bank: 0, cash: 0 },
        transactions: [],
        ready: true,
      })
    }

    const { data, error } = await admin
      .from('gipe_transactions')
      .select('*')
      .eq('school_year_id', year.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return fail(`Impossible de charger la trésorerie : ${error.message}`, 500)

    const rows = data || []

    return NextResponse.json({
      schoolYear: year.label,
      initialBalances: {
        bank: Number(year.initial_balance || 0),
        cash: Number(year.initial_cash_balance || 0),
      },
      // false tant que migration_tresorerie_v3.sql n'a pas été lancé
      ready: 'initial_cash_balance' in year,
      transactions: rows.map(toClient),
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Erreur de chargement.', 500)
  }
}

/* ---------------------------------------------------------
 * POST : nouvelle opération
 * --------------------------------------------------------- */
export async function POST(request: Request) {
  const auth = await requireTreasuryAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  try {
    const body = await request.json().catch(() => null)
    if (!body) return fail('Données invalides.')

    const built = buildFields(body)
    if ('error' in built) return fail(built.error as string)

    const year = await activeYear(admin)
    if (!year) return fail("Aucune année scolaire active n'est définie.", 409)

    const { data, error } = await admin
      .from('gipe_transactions')
      .insert({ school_year_id: year.id, ...built.fields })
      .select('*')
      .single()

    if (error) {
      console.error('Erreur création transaction:', error)
      return fail(
        error.message.includes('account') || error.message.includes('transfer_to')
          ? 'La trésorerie banque/caisse n’est pas encore installée : lance migration_tresorerie_v3.sql dans Supabase.'
          : `Impossible d'ajouter l'opération : ${error.message}`,
        500
      )
    }

    await logActivity(
      'Trésorerie',
      `a ajouté ${typeLabel(data.transaction_type, 'un')} ${quote(data.label)} (${euros(data.amount)}, ${accountsText(data)})`
    )

    return NextResponse.json({ ok: true, transaction: toClient(data) }, { status: 201 })
  } catch (error) {
    console.error('Erreur API trésorerie:', error)
    return fail(error instanceof Error ? error.message : "Impossible d'ajouter l'opération.", 500)
  }
}

/* ---------------------------------------------------------
 * PUT : modification d'une opération, ou soldes de départ
 * --------------------------------------------------------- */
export async function PUT(request: Request) {
  const auth = await requireTreasuryAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  try {
    const body = await request.json().catch(() => null)
    if (!body) return fail('Données invalides.')

    /*
     * Soldes de départ de l'année (banque et caisse).
     */
    if (body.initialBalances !== undefined && body.id === undefined) {
      const bank = parseBalance(body.initialBalances?.bank)
      const cash = parseBalance(body.initialBalances?.cash)

      if (bank === null || cash === null) return fail('Le solde de départ est invalide.')

      const year = await activeYear(admin)
      if (!year) return fail("Aucune année scolaire active n'est définie.", 409)

      const { error } = await admin
        .from('school_years')
        .update({ initial_balance: bank, initial_cash_balance: cash })
        .eq('id', year.id)

      if (error) {
        return fail(
          error.message.includes('initial_cash_balance')
            ? 'La trésorerie banque/caisse n’est pas encore installée : lance migration_tresorerie_v3.sql dans Supabase.'
            : `Impossible d'enregistrer les soldes de départ : ${error.message}`,
          500
        )
      }

      await logActivity(
        'Trésorerie',
        `a modifié les soldes de départ (banque ${euros(bank)}, caisse ${euros(cash)})`
      )

      return NextResponse.json({ ok: true, initialBalances: { bank, cash } })
    }

    const id = String(body.id || '').trim()
    if (!id) return fail('Identifiant de transaction invalide.')

    const notEditable = await checkTransactionIsEditable(admin, id)
    if (notEditable) return notEditable

    const { data: current, error: currentError } = await admin
      .from('gipe_transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (currentError) return fail(currentError.message, 500)

    const built = buildFields(body, current)
    if ('error' in built) return fail(built.error as string)

    const { data, error } = await admin
      .from('gipe_transactions')
      .update({ ...built.fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Erreur modification transaction:', error)
      return fail(`Impossible de modifier l'opération : ${error.message}`, 500)
    }

    await logActivity(
      'Trésorerie',
      `a modifié ${typeLabel(data.transaction_type, 'le')} ${quote(data.label)} (${euros(data.amount)}, ${accountsText(data)})`
    )

    return NextResponse.json({ ok: true, transaction: toClient(data) })
  } catch (error) {
    console.error('Erreur API trésorerie:', error)
    return fail(error instanceof Error ? error.message : "Impossible de modifier l'opération.", 500)
  }
}

/* ---------------------------------------------------------
 * DELETE
 * --------------------------------------------------------- */
export async function DELETE(request: Request) {
  const auth = await requireTreasuryAccess()
  if ('error' in auth) return auth.error
  const { admin } = auth

  try {
    const body = await request.json().catch(() => null)
    const id = String(body?.id || '').trim()
    if (!id) return fail('Identifiant de transaction invalide.')

    const notEditable = await checkTransactionIsEditable(admin, id)
    if (notEditable) return notEditable

    const { data: before } = await admin
      .from('gipe_transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    const { error } = await admin.from('gipe_transactions').delete().eq('id', id)

    if (error) {
      console.error('Erreur suppression transaction:', error)
      return fail(`Impossible de supprimer l'opération : ${error.message}`, 500)
    }

    // Le justificatif part à la corbeille du Drive (récupérable 30 jours).
    if (before?.receipt_file_id) {
      try {
        await trashDriveFile(await getGoogleAccessToken(), before.receipt_file_id)
      } catch (driveError) {
        console.error('Justificatif non mis à la corbeille :', driveError)
      }
    }

    if (before) {
      await logActivity(
        'Trésorerie',
        `a supprimé ${typeLabel(before.transaction_type, 'le')} ${quote(before.label)} (${euros(before.amount)})`
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erreur API suppression trésorerie:', error)
    return fail(error instanceof Error ? error.message : "Impossible de supprimer l'opération.", 500)
  }
}
