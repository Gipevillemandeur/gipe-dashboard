import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { classes as mockClasses, type ClassRow } from '@/lib/mock-data';

export type DashboardSnapshot = {
  connected: boolean;
  schoolYear: string;
  classes: ClassRow[];
  adherents: number;
};

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const supabase = await createClient();

    const { data: activeYear } = await supabase
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle();

    if (!activeYear) {
      return {
        connected: false,
        schoolYear: '2026–2027',
        classes: mockClasses,
        adherents: 0,
      };
    }

    const { data, error } = await supabase
      .from('classes')
      .select(
        'name,level,kind,active,students(count),class_teachers(count)'
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
      };
    }

    const classes: ClassRow[] = data.map((row: any) => ({
      name: row.name,
      level:
        row.level ||
        (row.kind === 'demo' ? 'Démonstration' : 'Autre'),
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

    let adherents = 0;

    try {
      const admin = createAdminClient();

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
    };
  } catch {
    return {
      connected: false,
      schoolYear: '2026–2027',
      classes: mockClasses,
      adherents: 0,
    };
  }
}
