/*
 * PDF du bilan annuel :
 * 1. Bilan des adhésions (+ évolution)
 * 2. Bilan financier
 * 3. Bilan moral (texte + instances de l'année)
 * 4. Perspectives
 * 5. Remarques
 * + informations de clôture
 */

import type { AnnualReport } from '@/lib/annual-report';
import {
  COLORS,
  PdfBuilder,
  dateFr,
  dateTimeFr,
  euro,
} from '@/lib/pdf-kit';

function evolutionText(current: number, previous: number) {
  const diff = current - previous;
  const sign = diff > 0 ? '+' : '';

  if (previous === 0) {
    return `${sign}${diff}`;
  }

  const percent = Math.round((diff / previous) * 100);
  return `${sign}${diff} (${sign}${percent} %)`;
}

/* Texte saisi, ou lignes vides pour écrire à la main. */
function freeText(builder: PdfBuilder, text: string, emptyLines: number) {
  if (text.trim()) {
    builder.space(4);
    builder.paragraph(text, { size: 10.5 });
  } else {
    builder.space(4);
    builder.paragraph('À compléter :', {
      size: 9.5,
      color: COLORS.grey,
    });
    builder.writingArea(emptyLines);
  }
}

/*
 * Tableau détaillé : chaque catégorie (ligne de sous-total),
 * puis ses libellés regroupés avec le nombre d'opérations.
 */
function detailTable(
  builder: PdfBuilder,
  title: string,
  details: AnnualReport['incomeDetails'],
  total: number,
  totalLabel: string
) {
  if (details.length === 0) return;

  const rows: string[][] = [];
  const highlightRows: number[] = [];

  for (const category of details) {
    highlightRows.push(rows.length);
    rows.push([category.category, '', '', euro(category.total)]);

    for (const item of category.items) {
      rows.push(['', item.label, String(item.count), euro(item.amount)]);
    }
  }

  rows.push([totalLabel, '', '', euro(total)]);

  builder.subTitle(title, 90);
  builder.table(
    [
      { header: 'Catégorie', width: 1.6 },
      { header: 'Détail', width: 3.4 },
      { header: 'Nb', width: 0.6, align: 'center' },
      { header: 'Montant', width: 1.4, align: 'right' },
    ],
    rows,
    { highlightRows, boldLastRow: true }
  );
}

export async function buildAnnualReportPdf(report: AnnualReport) {
  const builder = await PdfBuilder.create(
    'Bilan annuel',
    `Année scolaire ${report.schoolYear}`
  );

  /*
   * Page de garde (en haut de la première page)
   */
  builder.space(30);
  builder.drawLine('Bilan annuel', builder.left, builder.y, 26, {
    bold: true,
    color: COLORS.burgundy,
  });
  builder.space(26);
  builder.drawLine(
    `Année scolaire ${report.schoolYear}`,
    builder.left,
    builder.y,
    14
  );
  builder.space(18);
  builder.drawLine(
    report.isClosed
      ? `Exercice clôturé le ${dateTimeFr(report.closedAt)}`
      : `Document provisoire — généré le ${dateTimeFr(new Date().toISOString())}`,
    builder.left,
    builder.y,
    9.5,
    { color: COLORS.grey }
  );
  builder.space(10);

  /*
   * 1. ADHÉSIONS
   */
  builder.sectionTitle('1. Bilan des adhésions');

  const metrics: { label: string; value: string; color?: typeof COLORS.dark }[] = [
    {
      label: 'Adhérents sur l’année',
      value: String(report.totalAdherents),
    },
  ];

  if (report.previousYear) {
    const diff = report.totalAdherents - report.previousYear.totalAdherents;

    metrics.push({
      label: `Évolution / ${report.previousYear.schoolYear}`,
      value: evolutionText(
        report.totalAdherents,
        report.previousYear.totalAdherents
      ),
      color:
        diff > 0 ? COLORS.green : diff < 0 ? COLORS.red : undefined,
    });
  } else {
    metrics.push({
      label: 'Évolution',
      value: 'Première année',
    });
  }

  builder.metrics(metrics);

  builder.subTitle('Répartition par classe');

  if (report.adherentsByClass.length === 0) {
    builder.paragraph('Aucun adhérent rattaché à une classe.', {
      color: COLORS.grey,
    });
  } else {
    builder.table(
      [
        { header: 'Classe', width: 3 },
        { header: 'Adhérents', width: 1, align: 'right' },
      ],
      report.adherentsByClass.map((row) => [
        row.className,
        String(row.count),
      ])
    );

    builder.space(4);
    builder.paragraph(
      'Un adhérent ayant des enfants dans plusieurs classes apparaît dans chacune d’elles ; il ne compte qu’une fois dans le total.',
      { size: 8, color: COLORS.grey }
    );
  }

  /*
   * 2. FINANCES
   */
  builder.sectionTitle(
    '2. Bilan financier',
    // titre + chiffres clés + tableau des catégories
    170 + (report.financialByCategory.length + 2) * 22
  );

  builder.metrics([
    { label: 'Solde initial', value: euro(report.initialBalance) },
    {
      label: 'Recettes',
      value: euro(report.totalRecettes),
      color: COLORS.green,
    },
    {
      label: 'Dépenses',
      value: euro(report.totalDepenses),
      color: COLORS.red,
    },
    {
      label: report.isClosed ? 'Solde final' : 'Solde actuel',
      value: euro(report.solde),
      color: report.solde < 0 ? COLORS.red : COLORS.dark,
    },
  ]);

  builder.subTitle('Recettes et dépenses par catégorie');

  if (report.financialByCategory.length === 0) {
    builder.paragraph('Aucune opération enregistrée.', {
      color: COLORS.grey,
    });
  } else {
    builder.table(
      [
        { header: 'Catégorie', width: 3 },
        { header: 'Recettes', width: 1.3, align: 'right' },
        { header: 'Dépenses', width: 1.3, align: 'right' },
      ],
      [
        ...report.financialByCategory.map((row) => [
          row.category,
          row.recettes ? euro(row.recettes) : '-',
          row.depenses ? euro(row.depenses) : '-',
        ]),
        ['Total', euro(report.totalRecettes), euro(report.totalDepenses)],
      ],
      { boldLastRow: true }
    );
  }

  detailTable(builder, 'Détail des recettes', report.incomeDetails, report.totalRecettes, 'Total recettes');
  detailTable(builder, 'Détail des dépenses', report.expenseDetails, report.totalDepenses, 'Total dépenses');

  /*
   * 3. BILAN MORAL
   */
  builder.newPage();
  builder.sectionTitle('3. Bilan moral');
  freeText(builder, report.moralReport, 14);

  builder.subTitle(`Instances de l’année (${report.meetings.length})`);

  if (report.meetings.length === 0) {
    builder.paragraph('Aucune réunion enregistrée cette année.', {
      color: COLORS.grey,
    });
  } else {
    builder.table(
      [
        { header: 'Date', width: 1.1 },
        { header: 'Type', width: 1.8 },
        { header: 'Objet', width: 3.2 },
        { header: 'Compte rendu', width: 1.1, align: 'center' },
      ],
      report.meetings.map((m) => [
        dateFr(m.date),
        m.type,
        m.subject,
        m.hasSummary ? 'Oui' : '-',
      ])
    );

    builder.space(4);
    builder.paragraph(
      'Les fiches et comptes rendus de chaque réunion sont archivés dans le dossier « Instances ».',
      { size: 8, color: COLORS.grey }
    );
  }

  /*
   * 4. PERSPECTIVES
   */
  builder.sectionTitle('4. Perspectives', 140);
  freeText(builder, report.perspectives, 10);

  /*
   * 5. REMARQUES (seulement si renseignées)
   */
  if (report.notes.trim()) {
    builder.sectionTitle('5. Remarques');
    freeText(builder, report.notes, 0);
  }

  /*
   * CLÔTURE
   */
  if (report.isClosed) {
    builder.sectionTitle('Clôture de l’exercice', 150);
    builder.paragraph(`Exercice clôturé : ${report.schoolYear}`);
    builder.paragraph(`Date de clôture : ${dateTimeFr(report.closedAt)}`);
    builder.metrics([
      {
        label: 'Solde transmis au nouvel exercice',
        value: euro(report.solde),
        color: report.solde < 0 ? COLORS.red : COLORS.green,
      },
    ]);
  }

  return builder.save();
}
