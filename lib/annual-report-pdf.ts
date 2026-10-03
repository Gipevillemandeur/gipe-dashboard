import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from 'pdf-lib';

export type AnnualReportData = {
  schoolYear: string;
  totalAdherents: number;
  adherentsByClass: Array<{
    className: string;
    count: number;
  }>;
  totalRecettes: number | null;
  totalDepenses: number | null;
  solde: number | null;
  closedAt?: string | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const BURGUNDY = rgb(0.49, 0.125, 0.105);
const CREAM = rgb(0.985, 0.97, 0.94);
const CREAM_BORDER = rgb(0.91, 0.86, 0.80);
const TEXT = rgb(0.18, 0.20, 0.24);
const MUTED = rgb(0.38, 0.41, 0.46);
const LIGHT = rgb(0.965, 0.97, 0.975);
const WHITE = rgb(1, 1, 1);

function currency(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-';

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

function drawHeader(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  year: string
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 122,
    width: PAGE_WIDTH,
    height: 122,
    color: BURGUNDY,
  });

  page.drawText('GIPE VILLEMANDEUR', {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 45,
    size: 11,
    font: bold,
    color: WHITE,
  });

  page.drawText('BILAN ANNUEL', {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 78,
    size: 24,
    font: bold,
    color: WHITE,
  });

  page.drawText(year, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 103,
    size: 12,
    font: regular,
    color: WHITE,
  });
}

function drawSectionLabel(
  page: PDFPage,
  bold: PDFFont,
  text: string,
  x: number,
  y: number
) {
  page.drawText(text, {
    x,
    y,
    size: 9.5,
    font: bold,
    color: MUTED,
  });
}

function addFooter(
  page: PDFPage,
  regular: PDFFont,
  dateLabel: string,
  year: string
) {
  page.drawLine({
    start: { x: MARGIN_X, y: 44 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 44 },
    thickness: 0.6,
    color: CREAM_BORDER,
  });

  page.drawText(`Document prepare le ${dateLabel}`, {
    x: MARGIN_X,
    y: 28,
    size: 7.5,
    font: regular,
    color: MUTED,
  });

  page.drawText(`GIPE Villemandeur - ${year}`, {
    x: PAGE_WIDTH - MARGIN_X - 145,
    y: 28,
    size: 7.5,
    font: regular,
    color: MUTED,
  });
}

export async function buildAnnualReportPdf(
  data: AnnualReportData
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const dateLabel = data.closedAt
    ? new Date(data.closedAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 156;

  drawHeader(page, regular, bold, data.schoolYear);

  page.drawText("Bilan de l'annee scolaire cloturee", {
    x: MARGIN_X,
    y,
    size: 10.5,
    font: regular,
    color: TEXT,
  });

  y -= 30;

  // Total des adhérents
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 88,
    width: PAGE_WIDTH - 2 * MARGIN_X,
    height: 88,
    color: CREAM,
    borderColor: CREAM_BORDER,
    borderWidth: 1,
  });

  drawSectionLabel(
    page,
    bold,
    'TOTAL DES ADHERENTS',
    MARGIN_X + 18,
    y - 23
  );

  page.drawText(String(data.totalAdherents), {
    x: MARGIN_X + 18,
    y: y - 64,
    size: 30,
    font: bold,
    color: BURGUNDY,
  });

  page.drawText(
    'Un adherent compte une seule fois, quel que soit le nombre de ses enfants.',
    {
      x: MARGIN_X + 110,
      y: y - 59,
      size: 8.5,
      font: regular,
      color: MUTED,
      maxWidth: 360,
    }
  );

  y -= 118;

  // Répartition
  drawSectionLabel(
    page,
    bold,
    'REPARTITION DES ADHERENTS PAR CLASSE',
    MARGIN_X,
    y
  );

  y -= 18;

  const columns = 3;
  const gap = 9;
  const boxWidth =
    (PAGE_WIDTH - 2 * MARGIN_X - gap * (columns - 1)) /
    columns;
  const boxHeight = 31;
  const rowsPerPage = 8;

  for (let i = 0; i < data.adherentsByClass.length; i += 1) {
    if (i > 0 && i % (columns * rowsPerPage) === 0) {
      addFooter(page, regular, dateLabel, data.schoolYear);
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeader(page, regular, bold, data.schoolYear);
      y = PAGE_HEIGHT - 156;

      drawSectionLabel(
        page,
        bold,
        'REPARTITION DES ADHERENTS PAR CLASSE (SUITE)',
        MARGIN_X,
        y
      );

      y -= 18;
    }

    const indexOnPage = i % (columns * rowsPerPage);
    const col = indexOnPage % columns;
    const row = Math.floor(indexOnPage / columns);
    const x = MARGIN_X + col * (boxWidth + gap);
    const rowTop = y - row * (boxHeight + gap);

    page.drawRectangle({
      x,
      y: rowTop - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: CREAM,
      borderColor: CREAM_BORDER,
      borderWidth: 1,
    });

    page.drawText(data.adherentsByClass[i].className, {
      x: x + 11,
      y: rowTop - 20,
      size: 9,
      font: bold,
      color: TEXT,
    });

    page.drawText(String(data.adherentsByClass[i].count), {
      x: x + boxWidth - 26,
      y: rowTop - 20,
      size: 9.5,
      font: bold,
      color: BURGUNDY,
    });
  }

  const countOnLastPage =
    data.adherentsByClass.length === 0
      ? 0
      : ((data.adherentsByClass.length - 1) % (columns * rowsPerPage)) + 1;

  const usedRows =
    countOnLastPage === 0
      ? 0
      : Math.ceil(countOnLastPage / columns);

  y -= usedRows * (boxHeight + gap) + 10;

  page.drawText(
    "Un meme adherent peut apparaitre dans plusieurs classes s'il a des enfants dans plusieurs classes.",
    {
      x: MARGIN_X,
      y: y - 2,
      size: 7.8,
      font: regular,
      color: MUTED,
      maxWidth: PAGE_WIDTH - 2 * MARGIN_X,
    }
  );

  y -= 28;

  // Bilan financier
  if (y - 108 < 65) {
    addFooter(page, regular, dateLabel, data.schoolYear);
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, regular, bold, data.schoolYear);
    y = PAGE_HEIGHT - 156;
  }

  page.drawRectangle({
    x: MARGIN_X,
    y: y - 104,
    width: PAGE_WIDTH - 2 * MARGIN_X,
    height: 104,
    color: LIGHT,
  });

  page.drawText('BILAN FINANCIER', {
    x: MARGIN_X + 16,
    y: y - 22,
    size: 10.5,
    font: bold,
    color: TEXT,
  });

  const financials = [
    ['Recettes', currency(data.totalRecettes)],
    ['Depenses', currency(data.totalDepenses)],
    ['Solde', currency(data.solde)],
  ];

  financials.forEach(([label, value], index) => {
    const x = MARGIN_X + 16 + index * 166;

    page.drawText(label, {
      x,
      y: y - 49,
      size: 8.5,
      font: regular,
      color: MUTED,
    });

    page.drawText(value, {
      x,
      y: y - 70,
      size: 12,
      font: bold,
      color: TEXT,
    });
  });

  if (
    data.totalRecettes === null &&
    data.totalDepenses === null &&
    data.solde === null
  ) {
    page.drawText('La tresorerie sera integree ulterieurement.', {
      x: MARGIN_X + 16,
      y: y - 91,
      size: 7.8,
      font: regular,
      color: MUTED,
    });
  }

  addFooter(page, regular, dateLabel, data.schoolYear);

  return pdf.save();
}
