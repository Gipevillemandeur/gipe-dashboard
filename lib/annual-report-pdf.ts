import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
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
const SITE_LOGO_URL = 'https://gipevillemandeur.com/images/logogipe.png';

function currency(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-';

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

async function loadSiteLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    const response = await fetch(SITE_LOGO_URL, {
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    return await pdf.embedPng(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

function drawHeader(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  year: string,
  logo: PDFImage | null
) {
  const headerHeight = 135;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: BURGUNDY,
  });

  // Logo du site GIPE à gauche du bandeau.
  if (logo) {
    const logoSize = 84;
    page.drawImage(logo, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 110,
      width: logoSize,
      height: logoSize,
    });
  }

  // Bloc de titre parfaitement centré dans le bandeau.
  const centerX = PAGE_WIDTH / 2;

  const title = 'BILAN ANNUEL';
  const association = 'GIPE VILLEMANDEUR';
  const yearText = year;

  page.drawText(title, {
    x: centerX - bold.widthOfTextAtSize(title, 22) / 2,
    y: PAGE_HEIGHT - 48,
    size: 22,
    font: bold,
    color: WHITE,
  });

  page.drawText(association, {
    x: centerX - bold.widthOfTextAtSize(association, 10.5) / 2,
    y: PAGE_HEIGHT - 75,
    size: 10.5,
    font: bold,
    color: WHITE,
  });

  page.drawText(yearText, {
    x: centerX - regular.widthOfTextAtSize(yearText, 11) / 2,
    y: PAGE_HEIGHT - 99,
    size: 11,
    font: regular,
    color: WHITE,
  });
}

function drawSectionLabel(
  page: PDFPage,
  bold: PDFFont,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'center' = 'left'
) {
  const size = 9.5;
  const textWidth = bold.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: align === 'center' ? x - textWidth / 2 : x,
    y,
    size,
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

  const leftText = `Document prepare le ${dateLabel}`;
  const rightText = `GIPE Villemandeur - ${year}`;

  page.drawText(leftText, {
    x: MARGIN_X,
    y: 28,
    size: 7.5,
    font: regular,
    color: MUTED,
  });

  page.drawText(rightText, {
    x: PAGE_WIDTH - MARGIN_X - regular.widthOfTextAtSize(rightText, 7.5),
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
  const logo = await loadSiteLogo(pdf);

  const dateLabel = data.closedAt
    ? new Date(data.closedAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 164;

  drawHeader(page, regular, bold, data.schoolYear, logo);

  // Total des adhérents : contenu centré, sans texte explicatif.
  const totalBoxHeight = 122;

  page.drawRectangle({
    x: MARGIN_X,
    y: y - totalBoxHeight,
    width: PAGE_WIDTH - 2 * MARGIN_X,
    height: totalBoxHeight,
    color: CREAM,
    borderColor: CREAM_BORDER,
    borderWidth: 1,
  });

  const totalLabel = 'TOTAL DES ADHERENTS';
  drawSectionLabel(
    page,
    bold,
    totalLabel,
    PAGE_WIDTH / 2,
    y - 28,
    'center'
  );

  const totalText = String(data.totalAdherents);
  const totalSize = 34;

  page.drawText(totalText, {
    x: PAGE_WIDTH / 2 - bold.widthOfTextAtSize(totalText, totalSize) / 2,
    y: y - 82,
    size: totalSize,
    font: bold,
    color: BURGUNDY,
  });

  y -= totalBoxHeight + 30;

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
      drawHeader(page, regular, bold, data.schoolYear, logo);
      y = PAGE_HEIGHT - 164;

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

    const className = data.adherentsByClass[i].className;
    const classCount = String(data.adherentsByClass[i].count);
    const classNameWidth = regular.widthOfTextAtSize(className, 9);
    const countWidth = bold.widthOfTextAtSize(classCount, 9.5);

    page.drawText(className, {
      x: x + boxWidth / 2 - classNameWidth / 2,
      y: rowTop - 20,
      size: 9,
      font: bold,
      color: TEXT,
    });

    // La valeur reste visuellement associée à la classe,
    // légèrement décalée pour conserver une lecture compacte.
    page.drawText(classCount, {
      x: x + boxWidth - countWidth - 10,
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

  y -= usedRows * (boxHeight + gap) + 28;

  // Bilan financier : uniquement les trois indicateurs.
  if (y - 98 < 65) {
    addFooter(page, regular, dateLabel, data.schoolYear);
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, regular, bold, data.schoolYear, logo);
    y = PAGE_HEIGHT - 164;
  }

  page.drawRectangle({
    x: MARGIN_X,
    y: y - 98,
    width: PAGE_WIDTH - 2 * MARGIN_X,
    height: 98,
    color: LIGHT,
  });

  const financialTitle = 'BILAN FINANCIER';
  drawSectionLabel(
    page,
    bold,
    financialTitle,
    PAGE_WIDTH / 2,
    y - 22,
    'center'
  );

  const financials = [
    ['Recettes', currency(data.totalRecettes)],
    ['Depenses', currency(data.totalDepenses)],
    ['Solde', currency(data.solde)],
  ];

  financials.forEach(([label, value], index) => {
    const columnCenter = MARGIN_X + 83 + index * 166;
    const labelWidth = regular.widthOfTextAtSize(label, 8.5);
    const valueWidth = bold.widthOfTextAtSize(value, 12);

    page.drawText(label, {
      x: columnCenter - labelWidth / 2,
      y: y - 50,
      size: 8.5,
      font: regular,
      color: MUTED,
    });

    page.drawText(value, {
      x: columnCenter - valueWidth / 2,
      y: y - 72,
      size: 12,
      font: bold,
      color: TEXT,
    });
  });

  addFooter(page, regular, dateLabel, data.schoolYear);

  return pdf.save();
}

