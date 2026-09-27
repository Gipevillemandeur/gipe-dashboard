export type ClassRow = { name: string; level: string; students: number; teachers: number; status: 'active' | 'demo' };

export const classes: ClassRow[] = [
  { name: '3A', level: '3e', students: 26, teachers: 18, status: 'active' },
  { name: '3B', level: '3e', students: 25, teachers: 16, status: 'active' },
  { name: '3C', level: '3e', students: 27, teachers: 17, status: 'active' },
  { name: '4A', level: '4e', students: 27, teachers: 17, status: 'active' },
  { name: '4B', level: '4e', students: 29, teachers: 17, status: 'active' },
  { name: '5A', level: '5e', students: 27, teachers: 16, status: 'active' },
  { name: '6A', level: '6e', students: 27, teachers: 16, status: 'active' },
  { name: 'TEST', level: 'Démonstration', students: 3, teachers: 3, status: 'demo' },
];
