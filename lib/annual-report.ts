/*
 * =========================================================
 * BILAN ANNUEL — SOURCE UNIQUE DES CHIFFRES
 * =========================================================
 *
 * Utilisé par :
 * - l'aperçu de clôture ;
 * - la clôture ;
 * - le PDF du bilan ;
 * - l'archivage dans le Drive.
 *
 * Fonctionne pour l'année en cours comme pour une année
 * déjà clôturée (rien n'est supprimé à la clôture).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ClassCount = {
  className: string;
  count: number;
};

export type CategoryTotal = {
  category: string;
  recettes: number;
  depenses: number;
};

export type MeetingSummary = {
  id: string;
  date: string;
  time: string | null;
  type: string;
  subject: string;
  location: string | null;
  hasSummary: boolean;
};

export type PreviousYear = {
  schoolYear: string;
  totalAdherents: number;
  solde: number;
} | null;

export type AnnualReport = {
  schoolYearId: string;
  schoolYear: string;
  isClosed: boolean;
  closedAt: string | null;

  totalAdherents: number;
  adherentsByClass: ClassCount[];
  previousYear: PreviousYear;

  initialBalance: number;
  totalRecettes: number;
  totalDepenses: number;
  solde: number;
  financialByCategory: CategoryTotal[];

  meetings: MeetingSummary[];

  moralReport: string;
  perspectives: string;
  notes: string;
  driveFolderUrl: string | null;
};

export type AdherentRow = {
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  address: string;
  children: { name: string; className: string }[];
  amount: number | null;
  paymentReceived: boolean;
  paymentMethod: string;
  renewal: boolean;
};

export type TransactionRow = {
  date: string;
  type: 'income' | 'expense' | string;
  category: string;
  label: string;
  amount: number;
  paymentMethod: string;
  note: string;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function sortFr(a: string, b: string) {
  return a.localeCompare(b, 'fr', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function isIncome(type: string | null | undefined) {
  const t = String(type || '').trim().toLowerCase();
  return ['income', 'recette', 'recettes', 'entree', 'entrée'].includes(t);
}

export function isExpense(type: string | null | undefined) {
  const t = String(type || '').trim().toLowerCase();
  return [
    'expense',
    'depense',
    'dépense',
    'depenses',
    'dépenses',
    'sortie',
  ].includes(t);
}

/*
 * Année concernée : celle demandée, sinon l'année active.
 */
export async function resolveSchoolYear(
  admin: SupabaseClient,
  schoolYearId?: string | null
) {
  const query = admin
    .from('school_years')
    .select('id,label,is_active,initial_balance,closed_at');

  const { data, error } = schoolYearId
    ? await query.eq('id', schoolYearId).maybeSingle()
    : await query.eq('is_active', true).maybeSingle();

  if (error) {
    throw new Error(
      `Impossible de charger l'année scolaire : ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      schoolYearId
        ? 'Année scolaire introuvable.'
        : 'Aucune année scolaire active.'
    );
  }

  return data as {
    id: string;
    label: string;
    is_active: boolean;
    initial_balance: number | null;
    closed_at: string | null;
  };
}

export async function buildAnnualReport(
  admin: SupabaseClient,
  schoolYearId?: string | null
): Promise<AnnualReport> {
  const year = await resolveSchoolYear(admin, schoolYearId);

  const [
    membershipsResult,
    transactionsResult,
    meetingsResult,
    closuresResult,
  ] = await Promise.all([
    admin
      .from('gipe_memberships')
      .select(`
        id,
        gipe_membership_children (
          classes ( name )
        )
      `)
      .eq('school_year_id', year.id),

    admin
      .from('gipe_transactions')
      .select('transaction_type,category,amount')
      .eq('school_year_id', year.id),

    admin
      .from('instance_meetings')
      .select('id,type,subject,meeting_date,meeting_time,location,summary')
      .eq('school_year_id', year.id)
      .order('meeting_date', { ascending: true }),

    admin
      .from('gipe_year_closures')
      .select('*')
      .order('closed_at', { ascending: false }),
  ]);

  const firstError =
    membershipsResult.error ||
    transactionsResult.error ||
    meetingsResult.error ||
    closuresResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  /*
   * ADHÉRENTS
   *
   * Total : un adhérent = une adhésion (même avec
   * plusieurs enfants).
   * Par classe : un adhérent compte une fois dans chaque
   * classe où il a au moins un enfant.
   */
  const memberships = membershipsResult.data || [];
  const byClass = new Map<string, Set<string>>();

  for (const membership of memberships as any[]) {
    for (const child of membership.gipe_membership_children || []) {
      const className = one<any>(child.classes)?.name;

      if (!className) continue;

      if (!byClass.has(className)) {
        byClass.set(className, new Set());
      }

      byClass.get(className)!.add(membership.id);
    }
  }

  const adherentsByClass = [...byClass.entries()]
    .map(([className, ids]) => ({
      className,
      count: ids.size,
    }))
    .sort((a, b) => sortFr(a.className, b.className));

  /*
   * TRÉSORERIE
   */
  const categories = new Map<string, CategoryTotal>();
  let totalRecettes = 0;
  let totalDepenses = 0;

  for (const transaction of transactionsResult.data || []) {
    const amount = Number(transaction.amount || 0);

    if (!Number.isFinite(amount)) continue;

    const category =
      String(transaction.category || '').trim() ||
      'Sans catégorie';

    if (!categories.has(category)) {
      categories.set(category, {
        category,
        recettes: 0,
        depenses: 0,
      });
    }

    const row = categories.get(category)!;

    if (isIncome(transaction.transaction_type)) {
      row.recettes += amount;
      totalRecettes += amount;
    } else if (isExpense(transaction.transaction_type)) {
      row.depenses += amount;
      totalDepenses += amount;
    }
  }

  const initialBalance = round2(Number(year.initial_balance || 0));
  totalRecettes = round2(totalRecettes);
  totalDepenses = round2(totalDepenses);

  const financialByCategory = [...categories.values()]
    .map((row) => ({
      category: row.category,
      recettes: round2(row.recettes),
      depenses: round2(row.depenses),
    }))
    .sort((a, b) => sortFr(a.category, b.category));

  /*
   * CLÔTURE DE CETTE ANNÉE (si déjà clôturée)
   * et ANNÉE PRÉCÉDENTE (pour l'évolution).
   */
  const closures = (closuresResult.data || []) as any[];

  const ownClosure =
    closures.find((c) => c.school_year_id === year.id) || null;

  /*
   * Année de comparaison :
   * - année en cours → la dernière année clôturée ;
   * - année clôturée → celle clôturée juste avant elle.
   */
  const previousClosure =
    closures.find(
      (c) =>
        c.school_year_id !== year.id &&
        (!ownClosure ||
          new Date(c.closed_at).getTime() <
            new Date(ownClosure.closed_at).getTime())
    ) || null;

  let previousYear: PreviousYear = null;

  if (previousClosure) {
    const { data: previousYearRow } = await admin
      .from('school_years')
      .select('label')
      .eq('id', previousClosure.school_year_id)
      .maybeSingle();

    previousYear = {
      schoolYear: previousYearRow?.label || 'Année précédente',
      totalAdherents: Number(previousClosure.total_adherents || 0),
      solde: round2(Number(previousClosure.solde || 0)),
    };
  }

  /*
   * RÉUNIONS DE L'ANNÉE
   */
  const meetings: MeetingSummary[] = (meetingsResult.data || []).map(
    (m: any) => ({
      id: m.id,
      date: m.meeting_date,
      time: m.meeting_time || null,
      type: m.type || '',
      subject: m.subject || '',
      location: m.location || null,
      hasSummary: Boolean(String(m.summary || '').trim()),
    })
  );

  return {
    schoolYearId: year.id,
    schoolYear: year.label,
    isClosed: !year.is_active,
    closedAt: ownClosure?.closed_at || year.closed_at || null,

    totalAdherents: memberships.length,
    adherentsByClass,
    previousYear,

    initialBalance,
    totalRecettes,
    totalDepenses,
    solde: round2(initialBalance + totalRecettes - totalDepenses),
    financialByCategory,

    meetings,

    moralReport: ownClosure?.moral_report || '',
    perspectives: ownClosure?.perspectives || '',
    notes: ownClosure?.notes || '',
    driveFolderUrl: ownClosure?.drive_folder_url || null,
  };
}

/*
 * Liste détaillée des adhérents (pour PDF / Excel).
 */
export async function loadAdherentRows(
  admin: SupabaseClient,
  schoolYearId: string
): Promise<AdherentRow[]> {
  const { data, error } = await admin
    .from('gipe_memberships')
    .select(`
      id,
      renewal,
      payment_received,
      payment_method,
      amount,
      gipe_adherents (
        last_name,
        first_name,
        address,
        phone,
        email
      ),
      gipe_membership_children (
        gipe_children ( last_name, first_name ),
        classes ( name )
      )
    `)
    .eq('school_year_id', schoolYearId);

  if (error) {
    throw new Error(
      `Impossible de charger les adhérents : ${error.message}`
    );
  }

  return ((data || []) as any[])
    .map((m) => {
      const adherent = one<any>(m.gipe_adherents) || {};

      const children = (m.gipe_membership_children || [])
        .map((c: any) => {
          const child = one<any>(c.gipe_children) || {};
          return {
            name: [child.first_name, child.last_name]
              .filter(Boolean)
              .join(' '),
            className: one<any>(c.classes)?.name || '',
          };
        })
        .sort((a: any, b: any) => sortFr(a.className, b.className));

      return {
        lastName: adherent.last_name || '',
        firstName: adherent.first_name || '',
        email: adherent.email || '',
        phone: adherent.phone || '',
        address: adherent.address || '',
        children,
        amount:
          m.amount === null || m.amount === undefined
            ? null
            : Number(m.amount),
        paymentReceived: Boolean(m.payment_received),
        paymentMethod: m.payment_method || '',
        renewal: Boolean(m.renewal),
      };
    })
    .sort(
      (a, b) =>
        sortFr(a.lastName, b.lastName) ||
        sortFr(a.firstName, b.firstName)
    );
}

/*
 * Journal complet de trésorerie (pour PDF / Excel).
 */
export async function loadTransactionRows(
  admin: SupabaseClient,
  schoolYearId: string
): Promise<TransactionRow[]> {
  const { data, error } = await admin
    .from('gipe_transactions')
    .select(
      'transaction_date,transaction_type,category,label,amount,payment_method,note,created_at'
    )
    .eq('school_year_id', schoolYearId)
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(
      `Impossible de charger la trésorerie : ${error.message}`
    );
  }

  return (data || []).map((t: any) => ({
    date: t.transaction_date,
    type: t.transaction_type,
    category: t.category || '',
    label: t.label || '',
    amount: round2(Number(t.amount || 0)),
    paymentMethod: t.payment_method || '',
    note: t.note || '',
  }));
}

export const PAYMENT_LABELS: Record<string, string> = {
  cheque: 'Chèque',
  cash: 'Espèces',
  transfer: 'Virement',
  online: 'Paiement en ligne',
  other: 'Autre',
};

export function paymentLabel(value: string | null | undefined) {
  if (!value) return '';
  return PAYMENT_LABELS[value] || value;
}
