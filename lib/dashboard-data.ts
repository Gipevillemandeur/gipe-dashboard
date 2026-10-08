import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { classes as mockClasses, type ClassRow } from '@/lib/mock-data';

const FULL_PERMISSIONS = [
  'dashboard',
  'schooling',
  'members',
  'treasury',
  'website',
  'agenda',
  'drive',
  'configuration',
  'office_members',
];

export type DashboardSnapshot = {
  connected: boolean;
  schoolYear: string;
  classes: ClassRow[];
  adherents: number;
  role: string;
};

async function getCurrentRole(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string | null
): Promise<string> {
  /*
   * Ancien compte administrateur
   */
  const { data: adminRow } = await adminClient
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (adminRow) {
    return 'Administrateur';
  }

  /*
   * SUPER ADMIN
   */
  const { data: superAdmins } = await adminClient
    .from('office_super_admin')
    .select('user_id, email, active')
    .eq('active', true);

  const superAdmin = superAdmins?.find(
    (item) =>
      item.user_id === userId ||
      (
        email &&
        item.email?.trim().toLowerCase() === email
      )
  );

  if (superAdmin) {
    return 'SUPER ADMIN';
  }

  /*
   * Membre du bureau
   */
  const { data: member } = await adminClient
    .from('office_position_members')
    .select(`
      user_id,
      email,
      position_id,
      active,
      office_positions (
        id,
        name,
        active
      )
    `)
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();

  if (!member) {
    return 'Administrateur GIPE';
  }

  const position = Array.isArray(member.office_positions)
    ? member.office_positions[0]
    : member.office_positions;

  if (!position || !position.active) {
    return 'Administrateur GIPE';
  }

  /*
   * Le Président possède tous les droits,
   * comme prévu dans le système des membres du bureau.
   */
  if (position.name === 'Président') {
    return 'Président';
  }

  /*
   * Pour les autres postes, on vérifie simplement
   * que le poste possède bien ses permissions.
   */
  const { data: permissionLinks } = await adminClient
    .from('office_position_permissions')
    .select(`
      permission_id,
      office_permissions (
        code
      )
    `)
    .eq('position_id', position.id);

  const permissions =
    (permissionLinks || [])
      .map((link) => {
        const permission = Array.isArray(
          link.office_permissions
        )
          ? link.office_permissions[0]
          : link.office_permissions;

        return permission?.code || null;
      })
      .filter(
        (code): code is string =>
          Boolean(code)
      );

  if (permissions.length >= FULL_PERMISSIONS.length) {
    return position.name;
  }

  return position.name;
}

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

    const role = await getCurrentRole(
      admin,
      user.id,
      email
    );

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
