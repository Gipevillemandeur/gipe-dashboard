/*
 * Fichiers d'archives de fin d'année :
 * - liste des adhérents (PDF + Excel)
 * - journal de trésorerie (PDF + Excel)
 */

import * as XLSX from 'xlsx';

import {
  isIncome,
  paymentLabel,
  type AdherentRow,
  type AnnualReport,
  type TransactionRow,
} from '@/lib/annual-report';
import { COLORS, PdfBuilder, dateFr, euro } from '@/lib/pdf-kit';

function xlsxBytes(
  sheets: { name: string; rows: (string | number | null)[][]; widths: number[] }[]
) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    worksheet['!cols'] = sheet.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const buffer = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  }) as ArrayBuffer;

  return new Uint8Array(buffer);
}

/* ---------------------------------------------------------
 * ADHÉRENTS
 * --------------------------------------------------------- */

function childrenText(row: AdherentRow) {
  return row.children
    .map((c) => (c.className ? `${c.name} (${c.className})` : c.name))
    .join(', ');
}

export async function buildAdherentsPdf(
  report: AnnualReport,
  rows: AdherentRow[]
) {
  const builder = await PdfBuilder.create(
    'Liste des adhérents',
    `Année scolaire ${report.schoolYear}`
  );

  builder.sectionTitle(`Adhérents ${report.schoolYear}`);
  builder.metrics([
    { label: 'Adhérents', value: String(rows.length) },
    {
      label: 'Cotisations reçues',
      value: String(rows.filter((r) => r.paymentReceived).length),
    },
    {
      label: 'Renouvellements',
      value: String(rows.filter((r) => r.renewal).length),
    },
  ]);

  if (rows.length === 0) {
    builder.paragraph('Aucun adhérent cette année.', { color: COLORS.grey });
  } else {
    builder.table(
      [
        { header: 'Nom', width: 2.2 },
        { header: 'Enfant(s) et classe', width: 3.2 },
        { header: 'Contact', width: 3 },
        { header: 'Cotisation', width: 1.5, align: 'right' },
      ],
      rows.map((r) => [
        `${r.lastName.toUpperCase()} ${r.firstName}`.trim(),
        childrenText(r),
        [r.email, r.phone].filter(Boolean).join('\n'),
        r.amount !== null
          ? `${euro(r.amount)}${r.paymentReceived ? '' : '\n(non reçue)'}`
          : r.paymentReceived
            ? 'Reçue'
            : '-',
      ]),
      { size: 8.5 }
    );
  }

  builder.sectionTitle('Répartition par classe');
  builder.table(
    [
      { header: 'Classe', width: 3 },
      { header: 'Adhérents', width: 1, align: 'right' },
    ],
    report.adherentsByClass.map((c) => [c.className, String(c.count)])
  );

  return builder.save();
}

export function buildAdherentsXlsx(
  report: AnnualReport,
  rows: AdherentRow[]
) {
  return xlsxBytes([
    {
      name: 'Adhérents',
      widths: [18, 18, 28, 16, 34, 40, 12, 10, 16, 14],
      rows: [
        [
          'Nom',
          'Prénom',
          'E-mail',
          'Téléphone',
          'Adresse',
          'Enfant(s) et classe',
          'Montant',
          'Reçue',
          'Mode de paiement',
          'Renouvellement',
        ],
        ...rows.map((r) => [
          r.lastName,
          r.firstName,
          r.email,
          r.phone,
          r.address,
          childrenText(r),
          r.amount,
          r.paymentReceived ? 'Oui' : 'Non',
          paymentLabel(r.paymentMethod),
          r.renewal ? 'Oui' : 'Non',
        ]),
      ],
    },
    {
      name: 'Par classe',
      widths: [20, 12],
      rows: [
        ['Classe', 'Adhérents'],
        ...report.adherentsByClass.map((c) => [c.className, c.count]),
        ['Total adhérents', report.totalAdherents],
      ],
    },
  ]);
}

/* ---------------------------------------------------------
 * TRÉSORERIE
 * --------------------------------------------------------- */

export async function buildTreasuryPdf(
  report: AnnualReport,
  rows: TransactionRow[]
) {
  const builder = await PdfBuilder.create(
    'Journal de trésorerie',
    `Année scolaire ${report.schoolYear}`
  );

  builder.sectionTitle(`Trésorerie ${report.schoolYear}`);
  builder.metrics([
    { label: 'Solde initial', value: euro(report.initialBalance) },
    { label: 'Recettes', value: euro(report.totalRecettes), color: COLORS.green },
    { label: 'Dépenses', value: euro(report.totalDepenses), color: COLORS.red },
    {
      label: report.isClosed ? 'Solde final' : 'Solde actuel',
      value: euro(report.solde),
      color: report.solde < 0 ? COLORS.red : COLORS.dark,
    },
  ]);

  builder.subTitle(`Toutes les opérations (${rows.length})`);

  if (rows.length === 0) {
    builder.paragraph('Aucune opération cette année.', { color: COLORS.grey });
  } else {
    builder.table(
      [
        { header: 'Date', width: 1.1 },
        { header: 'Type', width: 1 },
        { header: 'Catégorie', width: 1.6 },
        { header: 'Libellé', width: 3.2 },
        { header: 'Mode', width: 1.3 },
        { header: 'Montant', width: 1.4, align: 'right' },
      ],
      rows.map((t) => [
        dateFr(t.date),
        isIncome(t.type) ? 'Recette' : 'Dépense',
        t.category,
        t.note ? `${t.label}\n${t.note}` : t.label,
        paymentLabel(t.paymentMethod),
        `${isIncome(t.type) ? '+' : '-'} ${euro(t.amount)}`,
      ]),
      { size: 8.5 }
    );
  }

  builder.subTitle('Récapitulatif par catégorie');
  builder.table(
    [
      { header: 'Catégorie', width: 3 },
      { header: 'Recettes', width: 1.3, align: 'right' },
      { header: 'Dépenses', width: 1.3, align: 'right' },
    ],
    [
      ...report.financialByCategory.map((c) => [
        c.category,
        c.recettes ? euro(c.recettes) : '-',
        c.depenses ? euro(c.depenses) : '-',
      ]),
      ['Total', euro(report.totalRecettes), euro(report.totalDepenses)],
    ],
    { boldLastRow: true }
  );

  return builder.save();
}

export function buildTreasuryXlsx(
  report: AnnualReport,
  rows: TransactionRow[]
) {
  return xlsxBytes([
    {
      name: 'Opérations',
      widths: [12, 10, 20, 36, 16, 12, 30],
      rows: [
        ['Date', 'Type', 'Catégorie', 'Libellé', 'Mode', 'Montant', 'Note'],
        ...rows.map((t) => [
          dateFr(t.date),
          isIncome(t.type) ? 'Recette' : 'Dépense',
          t.category,
          t.label,
          paymentLabel(t.paymentMethod),
          isIncome(t.type) ? t.amount : -t.amount,
          t.note,
        ]),
      ],
    },
    {
      name: 'Bilan',
      widths: [28, 14, 14],
      rows: [
        ['Solde initial', report.initialBalance, null],
        ['Total recettes', report.totalRecettes, null],
        ['Total dépenses', report.totalDepenses, null],
        [report.isClosed ? 'Solde final' : 'Solde actuel', report.solde, null],
        [null, null, null],
        ['Catégorie', 'Recettes', 'Dépenses'],
        ...report.financialByCategory.map((c) => [
          c.category,
          c.recettes,
          c.depenses,
        ]),
      ],
    },
  ]);
}
