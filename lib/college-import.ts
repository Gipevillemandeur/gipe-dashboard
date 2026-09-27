import * as XLSX from 'xlsx';

export type ImportedTeacher = {
  displayName: string;
  subject: string;
  isPP: boolean;
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

const STUDENT_SHEET = 'liste eleves';
const RESERVED = new Set(['code classe', 'direction', 'test']);
const TEAM_SHEET_RE = /^equipe peda\s+([3456][a-z])$/i;

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
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
    if (!student.lastName && !student.firstName) return false;
    const key = `${normalize(student.lastName)}|${normalize(student.firstName)}`;
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

  if (classCol < 0 || codeCol < 0) return codes;

  for (const row of rows.slice(1)) {
    const values = row as unknown[];
    const className = clean(values[classCol]);
    const code = clean(values[codeCol]);
    if (className && code) codes.set(className.toLocaleUpperCase('fr-FR'), code);
  }

  return codes;
}

function parseDirection(sheet: XLSX.WorkSheet | undefined): string[] {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const values: string[] = [];

  for (const row of rows) {
    const cells = row as unknown[];
    const text = clean(cells[0]);
    if (text) values.push(text);
  }

  if (values.length > 0 && normalize(values[0]).includes('direction')) values.shift();
  return values;
}

function parseStudentsSheet(
  sheet: XLSX.WorkSheet | undefined,
): Map<string, ImportedStudent[]> {
  const byClass = new Map<string, ImportedStudent[]>();
  if (!sheet) return byClass;

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const headers = (rows[0] ?? []).map(normalize);
  const nameCol = findColumn(headers, ['nom']);
  const firstNameCol = findColumn(headers, ['prenom', 'prénom']);
  const classCol = findColumn(headers, ['division', 'classe']);

  if (nameCol < 0 || firstNameCol < 0 || classCol < 0) return byClass;

  for (const row of rows.slice(1)) {
    const values = row as unknown[];
    const className = clean(values[classCol]).toLocaleUpperCase('fr-FR');
    const lastName = clean(values[nameCol]);
    const firstName = clean(values[firstNameCol]);
    if (!className || (!lastName && !firstName)) continue;

    const list = byClass.get(className) ?? [];
    list.push({ lastName, firstName });
    byClass.set(className, list);
  }

  for (const [className, students] of byClass) {
    byClass.set(className, uniqueStudents(students));
  }

  return byClass;
}

function parseTeamSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet | undefined,
  students: ImportedStudent[],
  accessCodes: Map<string, string>,
): ImportedClass | null {
  if (!sheet) return null;

  const match = normalize(sheetName).match(TEAM_SHEET_RE);
  if (!match) return null;
  const className = match[1].toLocaleUpperCase('fr-FR');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const header = (rows[0] ?? []).map(normalize);
  const nameCol = findColumn(header, ['nom']);
  const subjectCol = findColumn(header, ['matiere/fonction', 'matière/fonction', 'matiere', 'matière', 'fonction']);
  const ppCol = findColumn(header, ['professeur principal', 'pp']);

  if (nameCol < 0 || subjectCol < 0) return null;

  const teachers: ImportedTeacher[] = [];
  for (const row of rows.slice(2)) {
    const values = row as unknown[];
    const displayName = clean(values[nameCol]);
    const subject = clean(values[subjectCol]);
    if (!displayName) continue;
    // The second row contains counts such as "12 professeurs" and is skipped above.
    const isPP = ppCol >= 0 && normalize(values[ppCol]) === 'x';
    teachers.push({ displayName, subject, isPP });
  }

  return {
    name: className,
    level: levelFromClassName(className),
    accessCode: accessCodes.get(className) ?? null,
    teachers: uniqueTeachers(teachers),
    students,
  };
}

export function parseCollegeWorkbook(data: ArrayBuffer): CollegeImport {
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const accessCodes = parseAccessCodes(workbook.Sheets['code classe']);
  const direction = parseDirection(workbook.Sheets['direction']);
  const studentsByClass = parseStudentsSheet(workbook.Sheets['LISTE ELEVES']);
  const classes: ImportedClass[] = [];
  const ignoredSheets: string[] = [];
  const warnings: string[] = [];

  if (!workbook.Sheets['LISTE ELEVES']) {
    warnings.push('L’onglet « LISTE ELEVES » est absent : les élèves ne pourront pas être importés.');
  }

  if (!workbook.Sheets['code classe']) {
    warnings.push('Aucun onglet « code classe » dans ce fichier : les codes de déverrouillage existants seront conservés.');
  }

  if (!workbook.Sheets['direction']) {
    warnings.push('Aucun onglet « direction » dans ce fichier : les informations de direction existantes seront conservées.');
  }

  for (const sheetName of workbook.SheetNames) {
    const normalized = normalize(sheetName);

    if (RESERVED.has(normalized) || normalized === STUDENT_SHEET) {
      ignoredSheets.push(sheetName);
      continue;
    }

    if (TEAM_SHEET_RE.test(normalized)) {
      const match = normalized.match(TEAM_SHEET_RE);
      const className = match?.[1]?.toLocaleUpperCase('fr-FR');
      if (!className) continue;

      const item = parseTeamSheet(
        sheetName,
        workbook.Sheets[sheetName],
        studentsByClass.get(className) ?? [],
        accessCodes,
      );
      if (item) classes.push(item);
      continue;
    }

    ignoredSheets.push(sheetName);
  }

  const realClasses = classes.filter((item) => normalize(item.name) !== 'test');
  const totalStudents = realClasses.reduce((sum, item) => sum + item.students.length, 0);

  if (realClasses.length === 0) {
    warnings.push('Aucune classe réelle exploitable n’a été détectée dans le fichier.');
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
