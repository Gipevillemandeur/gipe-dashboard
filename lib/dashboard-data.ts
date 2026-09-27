import { createClient } from '@/lib/supabase/server';
import { classes as mockClasses, type ClassRow } from '@/lib/mock-data';

export type DashboardSnapshot = {
  connected: boolean;
  schoolYear: string;
  classes: ClassRow[];
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
      return { connected: false, schoolYear: '2026–2027', classes: mockClasses };
    }

    const { data, error } = await supabase
      .from('classes')
      .select('name,level,kind,active,students(count),class_teachers(count)')
      .eq('school_year_id', activeYear.id)
      .eq('active', true)
      .order('kind')
      .order('name');

    if (error || !data) {
      return { connected: false, schoolYear: activeYear.label, classes: mockClasses };
    }

    const classes: ClassRow[] = data.map((row: any) => ({
      name: row.name,
      level: row.level || (row.kind === 'demo' ? 'Démonstration' : 'Autre'),
      students: Array.isArray(row.students) ? Number(row.students[0]?.count || 0) : 0,
      teachers: Array.isArray(row.class_teachers) ? Number(row.class_teachers[0]?.count || 0) : 0,
      status: row.kind === 'demo' ? 'demo' : 'active',
    }));

    return { connected: true, schoolYear: activeYear.label, classes };
  } catch {
    return { connected: false, schoolYear: '2026–2027', classes: mockClasses };
  }
}
