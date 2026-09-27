import * as XLSX from 'xlsx';

export type ImportedTeacher = {
  displayName: string;
  subject: string;
};

export type ImportedStudent = {
  lastName: string;
  firstName: string;
};

export type ImportedClass = {
  name: string;
  level: string;
  accessCode: string | null;
  teachers: ImportedTeacher[];
  students: ImportedStudent[];
};

export type CollegeImport = {
  classes: ImportedClass[];
  direction: string[];
  ignoredSheets: string[];
  warnings: string[];
  totalStudents: number;
};

const RESERVED = new Set(['code classe', 'direction', 'test']);

function clean(value: unknown): string {
  return String(value ?? '').replace(/\\s+/g, ' ').trim();
}

function normalize(value: unknown): string {
  return clean(value).toLocaleLowerCase('fr-FR');
}

function findColumn(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

function levelFromClassName(name: string): string {
  const match = name.trim().match(/^([3456])/);
  return match ? `${match[1]}e` : 'Autre';
}

function uniqueStudents(rows: ImportedStudent[]): ImportedStudent[] {
  const seen = new Set<string>();
  return rows.filter((student) => {
    const key = `${normalize(student.lastName)}|${normalize(student.firstName)}`;
    if (!student.lastName && !student.firstName) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueTeachers(rows: ImportedTeacher[]): ImportedTeacher[] {
  const seen = new Set<string>();
  return rows.filter((teacher) => {
    if (!teacher.displayName) return false;
    const key = `${normalize(teacher.displayName)}|${normalize(teacher.subject)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseAccessCodes(sheet: XLSX.WorkSheet | undefined): Map<string, string> {
  const codes = new Map<string, string>();
  if (!sheet) return codes;

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const headers = (rows[0] ?? []).map(normalize);
  const classCol = findColumn(headers, ['classe']);
  const codeCol = findColumn(headers, ['code', 'deverouillage', 'déverrouillage']);

  for (const row of (classCol >= 0 && codeCol >= 0 ? rows.slice(1) : rows)) {
    const values = row as unknown[];
    const className = clean(values[classCol >= 0 ? classCol : 0]);
    const code = clean(values[codeCol >= 0 ? codeCol : 1]);
    if (className && code) codes.set(className.toLocaleUpperCase('fr-FR'), code);
  }

  return codes;
}

function parseDirection(sheet: XLSX.WorkSheet | undefined): string[] {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  return rows.flatMap((row, index) => {
    const text = clean((row as unknown[])[0]);
    if (!text) return [];
    if (index === 0 && normalize(text).includes('direction')) return [];
    return [text];
  });
}

function parseClass(sheetName: string, sheet: XLSX.WorkSheet, accessCodes: Map<string, string>): { item: ImportedClass | null; warning?: string } {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const header = (rows[0] ?? []).map(normalize);
  const nameCol = findColumn(header, ['nom']);
  const firstNameCol = findColumn(header, ['prenom', 'prénom']);
  const teacherCol = findColumn(header, ['professeur', 'prof']);
  const subjectCol = findColumn(header, ['matiere', 'matière', 'discipline']);

  if (nameCol < 0 && firstNameCol < 0 && teacherCol < 0) {
    return { item: null, warning: `L'onglet « ${sheetName} » ne contient pas de colonnes reconnues.` };
  }

  const students: ImportedStudent[] = [];
  const teachers: ImportedTeacher[] = [];

  for (const row of rows.slice(1)) {
    const values = row as unknown[];
    const lastName = clean(nameCol >= 0 ? values[nameCol] : '');
    const firstName = clean(firstNameCol >= 0 ? values[firstNameCol] : '');
    const displayName = clean(teacherCol >= 0 ? values[teacherCol] : '');
    const subject = clean(subjectCol >= 0 ? values[subjectCol] : '');

    if (lastName || firstName) students.push({ lastName, firstName });
    if (displayName) teachers.push({ displayName, subject });
  }

  const cleanStudents = uniqueStudents(students);
  const cleanTeachers = uniqueTeachers(teachers);

  if (cleanStudents.length === 0 && cleanTeachers.length === 0) {
    return { item: null, warning: `L'onglet « ${sheetName} » est vide ou ne contient pas de données exploitables.` };
  }

  return {
    item: {
      name: sheetName.trim(),
      level: levelFromClassName(sheetName),
      accessCode: accessCodes.get(sheetName.trim().toLocaleUpperCase('fr-FR')) ?? null,
      teachers: cleanTeachers,
      students: cleanStudents,
    },
  };
}

export function parseCollegeWorkbook(data: ArrayBuffer): CollegeImport {
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const accessCodes = parseAccessCodes(workbook.Sheets['code classe']);
  const direction = parseDirection(workbook.Sheets['direction']);
  const classes: ImportedClass[] = [];
  const ignoredSheets: string[] = [];
  const warnings: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const normalized = normalize(sheetName);
    if (RESERVED.has(normalized)) {
      ignoredSheets.push(sheetName);
      continue;
    }

    const result = parseClass(sheetName, workbook.Sheets[sheetName], accessCodes);
    if (result.item) classes.push(result.item);
    if (result.warning) warnings.push(result.warning);
  }

  const realClasses = classes.filter((item) => normalize(item.name) !== 'test');
  const totalStudents = realClasses.reduce((sum, item) => sum + item.students.length, 0);

  if (realClasses.length === 0) {
    warnings.push('Aucune classe réelle exploitable n\'a été détectée dans le fichier.');
  }

  return {
    classes: realClasses,
    direction,
    ignoredSheets,
    warnings,
    totalStudents,
  };
}

export function summarizeImport(data: CollegeImport) {
  const levels = new Map<string, number>();
  for (const item of data.classes) {
    levels.set(item.level, (levels.get(item.level) ?? 0) + 1);
  }

  return {
    classes: data.classes.length,
    students: data.totalStudents,
    teachers: new Set(data.classes.flatMap((item) => item.teachers.map((teacher) => normalize(teacher.displayName)))).size,
    direction: data.direction.length,
    levels: Array.from(levels.entries()).map(([level, count]) => ({ level, count })),
    ignoredSheets: data.ignoredSheets,
    warnings: data.warnings,
  };
}
