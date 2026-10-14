import { createClient } from '@/lib/supabase/server';
import { resolveOfficeAccess } from '@/lib/access-core';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ClassRow } from '@/lib/mock-data';

/*
 * Données du tableau de bord et de la vue des classes.
 *
 * IMPORTANT : aucune donnée d'exemple n'est jamais affichée.
 * En cas de problème, `error` contient un message et les
 * listes sont vides.
 */
export type UpcomingMeeting = {
  id: string;
  date: string;
  time: string | null;
  type: string;
  subject: string;
};

/* Réunion (Instances) ou événement de l'agenda interne. */
export type UpcomingEvent = {
  id: string;
  kind: 'meeting' | 'agenda';
  date: string;
  time: string | null;
  title: string;
  href: string;
};

export type RecentActivity = {
  id: number;
  at: string;
  who: string;
  area: string;
  summary: string;
};

/*
 * Chaque rubrique du journal n'est montrée qu'aux personnes
 * qui ont accès à cette rubrique.
 */
const AREA_PERMISSIONS: Record<string, string | null> = {
  'Trésorerie': 'treasury_view',
  'Adhérents': 'members_view',
  'Agenda': 'agenda_view',
  'Instances': 'schooling_view',
  'Site internet': 'website_view',
  'Configuration': 'configuration',
  'Docs Drive': 'drive_view',
  'Clôture': null,
  'Guide': null,
};

export type DashboardSnapshot = {
  connected: boolean;
  error: string | null;
  schoolYear: string;
  classes: ClassRow[];
  adherents: number;
  role: string;
  upcomingMeetings: UpcomingMeeting[];
  upcomingEvents: UpcomingEvent[];
  recentActivity: RecentActivity[];
  // Solde actuel, visible par tout le bureau (lecture seule)
  treasury: { total: number; bank: number; cash: number; cheques: number } | null;
};

function failure(error: string, role = '', schoolYear = ''): DashboardSnapshot {
  return {
    connected: false,
    error,
    schoolYear,
    classes: [],
    adherents: 0,
    role,
    upcomingMeetings: [],
    upcomingEvents: [],
    recentActivity: [],
    treasury: null,
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return failure('Session expirée : reconnecte-toi.');
    }

    const admin = createAdminClient();

    const access = await resolveOfficeAccess(
      admin,
      user.id,
      user.email?.trim().toLowerCase() || null
    );

    const role = access.positionName || 'Membre du bureau';

    const { data: activeYear, error: yearError } = await admin
      .from('school_years')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (yearError) {
      return failure(
        `Impossible de lire l’année scolaire : ${yearError.message}`,
        role
      );
    }

    if (!activeYear) {
      return failure('Aucune année scolaire active.', role);
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
    }).format(new Date());

    const allowedAreas = Object.entries(AREA_PERMISSIONS)
      .filter(
        ([, permission]) =>
          permission === null || access.permissions.includes(permission)
      )
      .map(([area]) => area);

    const [classesResult, adherentsResult, meetingsResult, activityResult, agendaResult, treasuryResult] = await Promise.all([
      admin
        .from('classes')
        .select('id,name,level,kind,active,students(count),class_teachers(count)')
        .eq('school_year_id', activeYear.id)
        .eq('active', true)
        .order('kind')
        .order('name'),

      admin
        .from('gipe_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('school_year_id', activeYear.id),

      admin
        .from('instance_meetings')
        .select('id,type,subject,meeting_date,meeting_time')
        .eq('school_year_id', activeYear.id)
        .gte('meeting_date', today)
        .order('meeting_date', { ascending: true })
        .order('meeting_time', { ascending: true })
        .limit(5),

      // Table absente (SQL pas encore lancé) : erreur ignorée.
      admin
        .from('gipe_activity_log')
        .select('id,created_at,actor_email,actor_position,area,summary')
        .in('area', allowedAreas)
        .order('created_at', { ascending: false })
        .limit(4),

      // Agenda interne (seulement pour qui a accès à l'Agenda).
      access.permissions.includes('agenda_view')
        ? admin
            .from('internal_agenda_events')
            .select('id,title,event_date,start_time')
            .gte('event_date', today)
            .order('event_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),

      // Trésorerie : le solde est visible par tout le bureau.
      admin.from('gipe_transactions').select('*').eq('school_year_id', activeYear.id),
    ]);

    /*
     * Solde actuel = soldes de départ + recettes − dépenses.
     * Les mouvements caisse ↔ banque ne changent que la répartition.
     */
    let treasury: DashboardSnapshot['treasury'] = null;

    if (!(treasuryResult as any).error) {
      const balances = {
        bank: Number((activeYear as any).initial_balance || 0),
        cash: Number((activeYear as any).initial_cash_balance || 0),
        cheques: 0,
      };

      for (const t of ((treasuryResult as any).data || []) as any[]) {
        const amount = Number(t.amount || 0);
        if (!Number.isFinite(amount)) continue;
        const account: 'bank' | 'cash' | 'cheques' =
          t.account === 'cash' ? 'cash' : t.account === 'cheques' ? 'cheques' : 'bank';

        if (t.transaction_type === 'transfer') {
          balances[account] -= amount;
          balances[t.transfer_to === 'cash' ? 'cash' : 'bank'] += amount;
        } else if (t.transaction_type === 'income') {
          balances[account] += amount;
        } else if (t.transaction_type === 'expense') {
          balances[account] -= amount;
        }
      }

      const round = (v: number) => Math.round(v * 100) / 100;
      treasury = {
        bank: round(balances.bank),
        cash: round(balances.cash),
        cheques: round(balances.cheques),
        total: round(balances.bank + balances.cash + balances.cheques),
      };
    }

    const meetings = (meetingsResult.data || []) as any[];

    /*
     * Une réunion créée depuis l'Agenda existe aussi dans l'Agenda :
     * on ne l'affiche qu'une fois (même jour et même heure).
     */
    const meetingSlots = new Set(
      meetings.map((m) => `${m.meeting_date}|${String(m.meeting_time || '').slice(0, 5)}`)
    );

    const upcomingEvents: UpcomingEvent[] = [
      ...meetings.map((m) => ({
        id: `m-${m.id}`,
        kind: 'meeting' as const,
        date: m.meeting_date,
        time: m.meeting_time || null,
        title: [m.type, m.subject].filter(Boolean).join(' – '),
        href: `/instances/${m.id}`,
      })),
      ...((agendaResult as any).error ? [] : ((agendaResult as any).data || []) as any[])
        .filter(
          (e) => !meetingSlots.has(`${e.event_date}|${String(e.start_time || '').slice(0, 5)}`)
        )
        .map((e) => ({
          id: `a-${e.id}`,
          kind: 'agenda' as const,
          date: e.event_date,
          time: e.start_time || null,
          title: e.title || 'Événement',
          href: '/agenda',
        })),
    ]
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          String(a.time || '').localeCompare(String(b.time || ''))
      )
      .slice(0, 5);

    if (classesResult.error) {
      return failure(
        `Impossible de charger les classes : ${classesResult.error.message}`,
        role,
        activeYear.label
      );
    }

    const classes: ClassRow[] = (classesResult.data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      level: row.level || (row.kind === 'demo' ? 'Démonstration' : 'Autre'),
      students: Array.isArray(row.students)
        ? Number(row.students[0]?.count || 0)
        : 0,
      teachers: Array.isArray(row.class_teachers)
        ? Number(row.class_teachers[0]?.count || 0)
        : 0,
      status: row.kind === 'demo' ? 'demo' : 'active',
    }));

    return {
      connected: true,
      error: null,
      schoolYear: activeYear.label,
      classes,
      adherents: adherentsResult.count || 0,
      role,
      upcomingEvents,
      treasury,
      upcomingMeetings: (meetingsResult.data || []).map((m: any) => ({
        id: m.id,
        date: m.meeting_date,
        time: m.meeting_time || null,
        type: m.type || '',
        subject: m.subject || '',
      })),
      recentActivity: activityResult.error
        ? []
        : (activityResult.data || []).map((row: any) => ({
            id: row.id,
            at: row.created_at,
            who: row.actor_position || row.actor_email || 'Quelqu’un',
            area: row.area,
            summary: row.summary,
          })),
    };
  } catch (error) {
    return failure(
      error instanceof Error
        ? `Erreur de chargement : ${error.message}`
        : 'Erreur de chargement des données.'
    );
  }
}
