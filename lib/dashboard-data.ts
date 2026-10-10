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

export type DashboardSnapshot = {
  connected: boolean;
  error: string | null;
  schoolYear: string;
  classes: ClassRow[];
  adherents: number;
  role: string;
  upcomingMeetings: UpcomingMeeting[];
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
      .select('id,label')
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

    const [classesResult, adherentsResult, meetingsResult] = await Promise.all([
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
        .limit(3),
    ]);

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
      upcomingMeetings: (meetingsResult.data || []).map((m: any) => ({
        id: m.id,
        date: m.meeting_date,
        time: m.meeting_time || null,
        type: m.type || '',
        subject: m.subject || '',
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
