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
        { header: 'Type', width: 1.1 },
        { header: 'Compte', width: 1.4 },
        { header: 'Catégorie', width: 1.5 },
        { header: 'Libellé', width: 3 },
        { header: 'Mode', width: 1.1 },
        { header: 'Montant', width: 1.3, align: 'right' },
      ],
      rows.map((t) => [
        dateFr(t.date),
        txKind(t),
        txAccount(t),
        t.category,
        t.note ? `${t.label}\n${t.note}` : t.label,
        paymentLabel(t.paymentMethod),
        t.type === 'transfer'
          ? euro(t.amount)
          : `${isIncome(t.type) ? '+' : '-'} ${euro(t.amount)}`,
      ]),
      { size: 8 }
    );
  }

  builder.subTitle('Répartition banque / caisse');
  builder.table(
    [
      { header: 'Compte', width: 2 },
      { header: 'Solde de départ', width: 1.5, align: 'right' },
      { header: report.isClosed ? 'Solde final' : 'Solde actuel', width: 1.5, align: 'right' },
    ],
    [
      ['Banque', euro(report.accounts.bank.initial), euro(report.accounts.bank.final)],
      ['Caisse', euro(report.accounts.cash.initial), euro(report.accounts.cash.final)],
      ...(report.accounts.cheques.final
        ? [['Chèques à remettre', '-', euro(report.accounts.cheques.final)]]
        : []),
      ['Total', euro(report.initialBalance), euro(report.solde)],
    ],
    { boldLastRow: true }
  );

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


const ACCOUNT_NAMES = { bank: 'Banque', cash: 'Caisse', cheques: 'Chèques à remettre' } as const;

function txKind(t: TransactionRow) {
  if (t.type === 'transfer') return 'Mouvement';
  return isIncome(t.type) ? 'Recette' : 'Dépense';
}

function txAccount(t: TransactionRow) {
  return t.type === 'transfer' && t.transferTo
    ? `${ACCOUNT_NAMES[t.account]} → ${ACCOUNT_NAMES[t.transferTo]}`
    : ACCOUNT_NAMES[t.account];
}

/* Montant signé pour les tableaux (un mouvement n'a pas de signe). */
function txSigned(t: TransactionRow) {
  if (t.type === 'transfer') return t.amount;
  return isIncome(t.type) ? t.amount : -t.amount;
}

/* Journal d'un compte : opérations du compte avec le solde après chaque ligne. */
function accountJournal(rows: TransactionRow[], account: 'bank' | 'cash', initial: number) {
  let balance = initial;
  // Un chèque compte à la banque à sa date de remise.
  const when = (t: TransactionRow) => (account === 'bank' && t.depositedAt ? t.depositedAt : t.date);
  return rows
    .filter((t) => t.account === account || (t.type === 'transfer' && t.transferTo === account))
    .sort((a, b) => when(a).localeCompare(when(b)))
    .map((t) => {
      const delta =
        t.type === 'transfer'
          ? t.account === account
            ? -t.amount
            : t.amount
          : isIncome(t.type)
            ? t.amount
            : -t.amount;
      balance = Math.round((balance + delta) * 100) / 100;
      return { t, delta, balance };
    });
}

export function buildTreasuryXlsx(
  report: AnnualReport,
  rows: TransactionRow[]
) {
  return xlsxBytes([
    {
      name: 'Opérations',
      widths: [12, 11, 18, 20, 36, 16, 12, 12, 30],
      rows: [
        ['Date', 'Type', 'Compte', 'Catégorie', 'Libellé', 'Mode', 'Montant', 'Justificatif', 'Note'],
        ...rows.map((t) => [
          dateFr(t.date),
          txKind(t),
          txAccount(t),
          t.category,
          t.label,
          paymentLabel(t.paymentMethod),
          txSigned(t),
          t.hasReceipt ? 'oui' : 'non',
          t.note,
        ]),
      ],
    },
    {
      name: 'Journal banque',
      widths: [12, 36, 14, 14, 14],
      rows: [
        ['Date', 'Libellé', 'Entrée', 'Sortie', 'Solde'],
        ['', 'Solde de départ', null, null, report.accounts.bank.initial],
        ...accountJournal(rows, 'bank', report.accounts.bank.initial).map(({ t, delta, balance }) => [
          dateFr(t.depositedAt || t.date),
          t.depositedAt ? `${t.label} (chèque remis le ${dateFr(t.depositedAt)})` : t.label,
          delta > 0 ? delta : null,
          delta < 0 ? -delta : null,
          balance,
        ]),
      ],
    },
    {
      name: 'Journal de caisse',
      widths: [12, 36, 14, 14, 14],
      rows: [
        ['Date', 'Libellé', 'Entrée', 'Sortie', 'Solde'],
        ['', 'Solde de départ', null, null, report.accounts.cash.initial],
        ...accountJournal(rows, 'cash', report.accounts.cash.initial).map(({ t, delta, balance }) => [
          dateFr(t.date),
          t.label,
          delta > 0 ? delta : null,
          delta < 0 ? -delta : null,
          balance,
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
        ['  dont banque', report.accounts.bank.final, null],
        ['  dont caisse', report.accounts.cash.final, null],
        ['  dont chèques à remettre', report.accounts.cheques.final, null],
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
