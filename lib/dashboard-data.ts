import { createClient } from '@/lib/supabase/server';
import { resolveOfficeAccess } from '@/lib/access-core';
import { createAdminClient } from '@/lib/supabase/admin';
import { classes as mockClasses, type ClassRow } from '@/lib/mock-data';

export type DashboardSnapshot = {
  connected: boolean;
  schoolYear: string;
  classes: ClassRow[];
  adherents: number;
  role: string;
};

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    /*
     * On récupère l'utilisateur connecté uniquement
     * pour déterminer son rôle.
     */
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        connected: false,
        schoolYear: '2026–2027',
        classes: mockClasses,
        adherents: 0,
        role: 'Administrateur GIPE',
      };
    }

    /*
     * Pour les données du tableau de bord, on utilise
     * le client administrateur.
     *
     * Cela évite que les règles RLS de l'utilisateur
     * connecté réduisent artificiellement les données
     * affichées au Président.
     */
    const admin = createAdminClient();

    const email =
      user.email?.trim().toLowerCase() || null;

    const access = await resolveOfficeAccess(
      admin,
      user.id,
      email
    );

    const role =
      access.positionName || 'Membre du bureau';

    /*
     * Année scolaire active
     */
    const { data: activeYear, error: yearError } =
      await admin
        .from('school_years')
        .select('id,label')
        .eq('is_active', true)
        .maybeSingle();

    if (yearError || !activeYear) {
      return {
        connected: false,
        schoolYear: '2026–2027',
        classes: mockClasses,
        adherents: 0,
        role,
      };
    }

    /*
     * Classes + élèves + équipes
     */
    const { data, error } = await admin
      .from('classes')
      .select(
        'id,name,level,kind,active,students(count),class_teachers(count)'
      )
      .eq('school_year_id', activeYear.id)
      .eq('active', true)
      .order('kind')
      .order('name');

    if (error || !data) {
      return {
        connected: false,
        schoolYear: activeYear.label,
        classes: mockClasses,
        adherents: 0,
        role,
      };
    }

    const classes: ClassRow[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      level:
        row.level ||
        (row.kind === 'demo'
          ? 'Démonstration'
          : 'Autre'),
      students: Array.isArray(row.students)
        ? Number(row.students[0]?.count || 0)
        : 0,
      teachers: Array.isArray(row.class_teachers)
        ? Number(row.class_teachers[0]?.count || 0)
        : 0,
      status:
        row.kind === 'demo'
          ? 'demo'
          : 'active',
    }));

    /*
     * Adhérents
     */
    let adherents = 0;

    try {
      const { count } = await admin
        .from('gipe_memberships')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('school_year_id', activeYear.id);

      adherents = count || 0;
    } catch {
      adherents = 0;
    }

    return {
      connected: true,
      schoolYear: activeYear.label,
      classes,
      adherents,
      role,
    };
  } catch {
    return {
      connected: false,
      schoolYear: '2026–2027',
      classes: mockClasses,
      adherents: 0,
      role: 'Administrateur GIPE',
    };
  }
}
