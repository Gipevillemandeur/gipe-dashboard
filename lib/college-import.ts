import * as XLSX from 'xlsx';

/*
 * =========================================================
 * LECTURE DU LISTING DU COLLÈGE
 * =========================================================
 *
 * Utilisé à la fois pour l'aperçu (dans le navigateur) et
 * pour l'import réel (sur le serveur).
 *
 * Principe : être TOLÉRANT sur la forme du fichier (noms
 * d'onglets, majuscules, accents, ordre des colonnes, ligne
 * de titres pas forcément en ligne 1…) et ne JAMAIS perdre
 * de données en silence : tout ce qui est douteux est
 * signalé dans l'aperçu, avant de valider l'import.
 *
 * Onglets reconnus :
 * - élèves : « LISTE ELEVES », « Liste des élèves »… ou, à
 *   défaut, tout onglet ayant des colonnes Nom / Prénom /
 *   Classe (ou Division) ;
 * - équipes : « Equipe peda 6A », « Équipe pédagogique 6A »,
 *   « Equipe 6A »… (une par classe, facultatif) ;
 * - codes : un onglet dont le nom contient « code » ;
 * - direction : un onglet nommé « direction ».
 */

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
  // Ce que l'import a reconnu (pour vérifier d'un coup d'œil).
  notes: string[];
  totalStudents: number;
};

type Rows = unknown[][];

/* ---------------------------------------------------------
 * Outils de normalisation
 * --------------------------------------------------------- */

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/* minuscules, sans accents, ponctuation → espaces */
function simplify(value: unknown): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(value: unknown): string[] {
  return simplify(value).split(' ').filter(Boolean);
}

/* Nom de classe homogène : « 6 a » → « 6A », « 6ème A » → « 6A » */
function normalizeClassName(value: unknown): string {
  return clean(value)
    .toLocaleUpperCase('fr-FR')
    .replace(/^([3456])\s*(?:E|EME|ÈME|EM)\s+/, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^(\d)\s+([A-Z0-9]{1,2})$/, '$1$2');
}

function levelFromClassName(name: string): string {
  const match = name.trim().match(/^([3456])/);
  return match ? `${match[1]}e` : 'Autre';
}

function readRows(sheet: XLSX.WorkSheet | undefined): Rows {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    // On garde les lignes vides pour que les numéros de ligne
    // annoncés correspondent à ceux d'Excel.
    blankrows: true,
  });
}

/* ---------------------------------------------------------
 * Reconnaissance des colonnes
 * --------------------------------------------------------- */

type ColumnTest = (headerWords: string[]) => boolean;

const isLastNameHeader: ColumnTest = (w) =>
  w.includes('nom') && !w.includes('prenom') && !w.includes('prenoms');

const isFirstNameHeader: ColumnTest = (w) =>
  (w.includes('prenom') || w.includes('prenoms')) && !w.includes('nom');

/* « Nom Prénom », « Élève », « Nom et prénom » dans une seule colonne */
const isFullNameHeader: ColumnTest = (w) =>
  (w.includes('nom') && (w.includes('prenom') || w.includes('prenoms'))) ||
  (w.length === 1 && w[0] === 'eleve');

const isClassHeader: ColumnTest = (w) =>
  (w.includes('division') || w.includes('classe') || w.includes('div')) &&
  !w.includes('code');

const isSubjectHeader: ColumnTest = (w) =>
  w.includes('matiere') ||
  w.includes('fonction') ||
  w.includes('discipline') ||
  w.includes('enseignement');

const isTeacherNameHeader: ColumnTest = (w) =>
  (w.includes('nom') ||
    w.includes('professeur') ||
    w.includes('enseignant') ||
    w.includes('personnel')) &&
  !isSubjectHeader(w) &&
  !w.includes('principal');

const isPPHeader: ColumnTest = (w) =>
  (w.includes('professeur') && w.includes('principal')) ||
  (w.length === 1 && w[0] === 'pp');

const isCodeHeader: ColumnTest = (w) =>
  w.includes('code') || w.includes('deverrouillage') || w.includes('deverouillage');

function findCol(header: string[][], test: ColumnTest) {
  return header.findIndex((w) => test(w));
}

/*
 * Cherche la ligne de titres dans les 15 premières lignes
 * (elle n'est pas forcément en ligne 1).
 */
function findHeaderRow(rows: Rows, required: ColumnTest[][]) {
  for (let index = 0; index < Math.min(rows.length, 15); index++) {
    const header = (rows[index] || []).map(words);

    // chaque groupe : au moins un des tests doit trouver une colonne
    if (required.every((group) => group.some((test) => findCol(header, test) >= 0))) {
      return { index, header };
    }
  }

  return null;
}

/* « DUPONT Marie » → nom en majuscules, prénom ensuite */
function splitFullName(value: string): ImportedStudent {
  const parts = clean(value).split(' ');
  const upper = (p: string) => p === p.toLocaleUpperCase('fr-FR') && /\p{L}/u.test(p);

  let cut = 0;
  while (cut < parts.length - 1 && upper(parts[cut])) cut++;
  if (cut === 0) cut = 1;

  return {
    lastName: parts.slice(0, cut).join(' '),
    firstName: parts.slice(cut).join(' '),
  };
}

/* ---------------------------------------------------------
 * Onglets
 * --------------------------------------------------------- */

const TEAM_SHEET_RE = /^equipe(?:\s+peda(?:gogique)?)?\s+(.+)$/;

function teamSheetClass(sheetName: string): string | null {
  const match = simplify(sheetName).match(TEAM_SHEET_RE);

  // « Équipe de direction », « Équipe vie scolaire »… ne sont pas des classes.
  if (
    !match ||
    match[1].length > 12 ||
    /\b(direction|vie|scolaire|administrative|de|du|des)\b/.test(match[1])
  ) {
    return null;
  }

  // On reprend le nom d'origine pour garder la casse (« 6A », « ULIS »).
  const original = clean(sheetName).split(' ');
  const suffixWords = match[1].split(' ').length;
  return normalizeClassName(original.slice(-suffixWords).join(' '));
}

function isStudentsSheetName(name: string) {
  const w = words(name);
  return w.some((x) => x.startsWith('eleve')) && !w.includes('equipe');
}

function parseStudents(
  sheetName: string,
  rows: Rows,
  notes: string[],
  warnings: string[]
) {
  const byClass = new Map<string, ImportedStudent[]>();

  const found = findHeaderRow(rows, [
    [isLastNameHeader, isFullNameHeader],
    [isClassHeader],
  ]);

  if (!found) {
    warnings.push(
      `Onglet « ${sheetName} » : impossible de trouver les colonnes Nom / Prénom / Classe. Les élèves ne seront pas importés.`
    );
    return null;
  }

  const { index, header } = found;
  const lastCol = findCol(header, isLastNameHeader);
  const firstCol = findCol(header, isFirstNameHeader);
  const fullCol = lastCol < 0 ? findCol(header, isFullNameHeader) : -1;
  const classCol = findCol(header, isClassHeader);
  const titles = rows[index] as unknown[];

  notes.push(
    `Élèves lus dans l’onglet « ${sheetName} » (ligne de titres ${index + 1}, colonnes : ${[
      lastCol >= 0 ? clean(titles[lastCol]) : clean(titles[fullCol]),
      firstCol >= 0 ? clean(titles[firstCol]) : null,
      clean(titles[classCol]),
    ]
      .filter(Boolean)
      .join(', ')}).`
  );

  if (lastCol >= 0 && firstCol < 0) {
    warnings.push(
      `Onglet « ${sheetName} » : pas de colonne Prénom trouvée, seuls les noms seront importés.`
    );
  }

  let skipped = 0;

  for (const row of rows.slice(index + 1)) {
    const className = normalizeClassName(row[classCol]);

    const student: ImportedStudent =
      fullCol >= 0
        ? splitFullName(clean(row[fullCol]))
        : {
            lastName: clean(row[lastCol]),
            firstName: firstCol >= 0 ? clean(row[firstCol]) : '',
          };

    if (!student.lastName && !student.firstName) continue;

    if (!className) {
      skipped++;
      continue;
    }

    const list = byClass.get(className) ?? [];
    list.push(student);
    byClass.set(className, list);
  }

  if (skipped > 0) {
    warnings.push(
      `${skipped} élève(s) sans classe dans l’onglet « ${sheetName} » : ignoré(s).`
    );
  }

  return byClass;
}

function parseTeam(
  sheetName: string,
  rows: Rows,
  warnings: string[]
): ImportedTeacher[] {
  const found = findHeaderRow(rows, [[isTeacherNameHeader]]);

  if (!found) {
    warnings.push(
      `Onglet « ${sheetName} » : colonne Nom introuvable, équipe pédagogique non importée.`
    );
    return [];
  }

  const { index, header } = found;
  const nameCol = findCol(header, isTeacherNameHeader);
  const subjectCol = findCol(header, isSubjectHeader);
  const ppCol = findCol(header, isPPHeader);

  const teachers: ImportedTeacher[] = [];

  for (const row of rows.slice(index + 1)) {
    const displayName = clean(row[nameCol]);

    // Lignes de comptage du type « 12 professeurs » ou « 12 ».
    if (!displayName || /^\d+(\s+\p{L}+)?$/u.test(displayName)) continue;

    teachers.push({
      displayName,
      subject: subjectCol >= 0 ? clean(row[subjectCol]) : '',
      isPP: ppCol >= 0 && ['x', 'oui', 'pp', '1'].includes(simplify(row[ppCol])),
    });
  }

  return teachers;
}

function parseAccessCodes(sheetName: string, rows: Rows, warnings: string[]) {
  const codes = new Map<string, string>();
  const found = findHeaderRow(rows, [[isClassHeader], [isCodeHeader]]);

  if (!found) {
    warnings.push(
      `Onglet « ${sheetName} » : colonnes Classe / Code introuvables, codes non importés.`
    );
    return codes;
  }

  const classCol = findCol(found.header, isClassHeader);
  const codeCol = found.header.findIndex(
    (w, i) => i !== classCol && isCodeHeader(w)
  );

  if (codeCol < 0) return codes;

  for (const row of rows.slice(found.index + 1)) {
    const className = normalizeClassName(row[classCol]);
    const code = clean(row[codeCol]);
    if (className && code) codes.set(className, code);
  }

  return codes;
}

function parseDirection(rows: Rows): string[] {
  const values = rows.map((row) => clean(row[0])).filter(Boolean);

  if (values.length > 0 && simplify(values[0]).includes('direction')) {
    values.shift();
  }

  return values;
}

function uniqueStudents(rows: ImportedStudent[]) {
  const seen = new Set<string>();

  return rows.filter((s) => {
    const key = `${simplify(s.lastName)}|${simplify(s.firstName)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueTeachers(rows: ImportedTeacher[]) {
  const seen = new Set<string>();

  return rows.filter((t) => {
    const key = `${simplify(t.displayName)}|${simplify(t.subject)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortClasses(a: string, b: string) {
  return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
}

/* ---------------------------------------------------------
 * Lecture du classeur
 * --------------------------------------------------------- */

export function parseCollegeWorkbook(data: ArrayBuffer): CollegeImport {
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });

  const warnings: string[] = [];
  const notes: string[] = [];
  const ignoredSheets: string[] = [];

  const teams = new Map<string, { sheet: string; teachers: ImportedTeacher[] }>();
  let studentsByClass: Map<string, ImportedStudent[]> | null = null;
  let studentsSheet: string | null = null;
  let codes: Map<string, string> | null = null;
  let direction: string[] | null = null;

  /* 1. Onglets reconnus par leur nom */
  for (const sheetName of workbook.SheetNames) {
    const rows = readRows(workbook.Sheets[sheetName]);
    const simple = simplify(sheetName);
    const teamClass = teamSheetClass(sheetName);

    if (teamClass) {
      if (simplify(teamClass) === 'test') {
        ignoredSheets.push(sheetName);
        continue;
      }

      if (teams.has(teamClass)) {
        warnings.push(
          `Deux onglets d’équipe pour la classe ${teamClass} : seul « ${teams.get(teamClass)!.sheet} » est utilisé.`
        );
        ignoredSheets.push(sheetName);
        continue;
      }

      teams.set(teamClass, {
        sheet: sheetName,
        teachers: parseTeam(sheetName, rows, warnings),
      });
      continue;
    }

    if (!studentsByClass && isStudentsSheetName(sheetName)) {
      const parsed = parseStudents(sheetName, rows, notes, warnings);
      if (parsed) {
        studentsByClass = parsed;
        studentsSheet = sheetName;
        continue;
      }
    }

    const sheetWords = simple.split(' ');

    if (!codes && (sheetWords.includes('code') || sheetWords.includes('codes'))) {
      codes = parseAccessCodes(sheetName, rows, warnings);
      notes.push(`Codes de déverrouillage lus dans l’onglet « ${sheetName} » (${codes.size}).`);
      continue;
    }

    if (!direction && simple === 'direction') {
      direction = parseDirection(rows);
      notes.push(`Direction lue dans l’onglet « ${sheetName} » (${direction.length} personne(s)).`);
      continue;
    }

    ignoredSheets.push(sheetName);
  }

  /* 2. Pas d'onglet « élèves » au nom évident : on cherche
   *    parmi les onglets ignorés celui qui a les bonnes colonnes. */
  if (!studentsByClass) {
    for (const sheetName of [...ignoredSheets]) {
      const rows = readRows(workbook.Sheets[sheetName]);
      const found = findHeaderRow(rows, [
        [isLastNameHeader, isFullNameHeader],
        [isClassHeader],
      ]);

      if (found) {
        studentsByClass = parseStudents(sheetName, rows, notes, warnings);
        studentsSheet = sheetName;
        ignoredSheets.splice(ignoredSheets.indexOf(sheetName), 1);
        break;
      }
    }
  }

  if (!studentsByClass) {
    warnings.push(
      'Aucun onglet de liste d’élèves trouvé (colonnes Nom, Prénom et Classe/Division) : les élèves ne pourront pas être importés.'
    );
  }

  if (!codes) {
    // Situation normale : les codes sont saisis par le GIPE
    // dans Configuration → Gérer les classes.
    notes.push(
      'Pas d’onglet de codes : les codes déjà saisis sont conservés (à gérer dans Configuration → Gérer les classes).'
    );
  }

  if (!direction) {
    warnings.push(
      'Aucun onglet « direction » : les informations de direction existantes seront conservées.'
    );
  }

  /* 3. Assemblage : toutes les classes vues, que ce soit
   *    dans la liste d'élèves ou dans un onglet d'équipe. */
  const classNames = new Set<string>([
    ...teams.keys(),
    ...(studentsByClass ? studentsByClass.keys() : []),
  ]);

  const classes: ImportedClass[] = [];

  for (const name of [...classNames].sort(sortClasses)) {
    if (simplify(name) === 'test') continue;

    const team = teams.get(name);
    const students = uniqueStudents(studentsByClass?.get(name) ?? []);

    if (!team) {
      warnings.push(
        `Classe ${name} : aucun onglet d’équipe pédagogique trouvé (élèves importés, sans professeurs).`
      );
    }

    if (studentsByClass && students.length === 0) {
      warnings.push(
        `Classe ${name} : aucun élève trouvé dans « ${studentsSheet} ».`
      );
    }

    if (levelFromClassName(name) === 'Autre') {
      notes.push(`Classe ${name} : niveau non reconnu, classée dans « Autre ».`);
    }

    classes.push({
      name,
      level: levelFromClassName(name),
      accessCode: codes?.get(name) ?? null,
      teachers: uniqueTeachers(team?.teachers ?? []),
      students,
    });
  }

  if (classes.length === 0) {
    warnings.push('Aucune classe réelle exploitable n’a été détectée dans le fichier.');
  }

  return {
    classes,
    direction: direction ?? [],
    ignoredSheets,
    warnings,
    notes,
    totalStudents: classes.reduce((sum, c) => sum + c.students.length, 0),
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
    teachers: new Set(
      data.classes.flatMap((item) =>
        item.teachers.map((teacher) => simplify(teacher.displayName))
      )
    ).size,
    direction: data.direction.length,
    levels: Array.from(levels.entries()).map(([level, count]) => ({ level, count })),
    ignoredSheets: data.ignoredSheets,
    warnings: data.warnings,
  };
}
