import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib';

export type AnnualReportData = {
  schoolYear: string;
  totalAdherents: number;
  adherentsByClass: Record<string, number>;

  initialBalance: number;
  totalRecettes: number;
  totalDepenses: number;
  solde: number;

  financialByCategory: {
    category: string;
    recettes: number;
    depenses: number;
  }[];

  closedAt: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN_LEFT = 45;
const MARGIN_RIGHT = 45;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const DARK = rgb(0.12, 0.12, 0.16);
const GREY = rgb(0.45, 0.45, 0.48);
const LIGHT_GREY = rgb(0.93, 0.93, 0.95);
const BORDER = rgb(0.78, 0.78, 0.82);
const BURGUNDY = rgb(0.45, 0.05, 0.12);
const GREEN = rgb(0.08, 0.42, 0.20);
const RED = rgb(0.65, 0.08, 0.08);

function euro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function dateFr(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: any,
  color = DARK
) {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });
}

function drawHeader(
  page: PDFPage,
  regular: any,
  bold: any,
  report: AnnualReportData
) {
  drawText(
    page,
    'GIPE VILLEMANDEUR',
    MARGIN_LEFT,
    PAGE_HEIGHT - 48,
    16,
    bold,
    BURGUNDY
  );

  drawText(
    page,
    'RAPPORT ANNUEL',
    MARGIN_LEFT,
    PAGE_HEIGHT - 70,
    10,
    bold,
    GREY
  );

  drawText(
    page,
    `Exercice ${report.schoolYear}`,
    PAGE_WIDTH - MARGIN_RIGHT - 150,
    PAGE_HEIGHT - 58,
    10,
    regular,
    GREY
  );

  page.drawLine({
    start: {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 88,
    },
    end: {
      x: PAGE_WIDTH - MARGIN_RIGHT,
      y: PAGE_HEIGHT - 88,
    },
    thickness: 1,
    color: BORDER,
  });
}

function drawFooter(page: PDFPage, regular: any) {
  page.drawLine({
    start: {
      x: MARGIN_LEFT,
      y: 35,
    },
    end: {
      x: PAGE_WIDTH - MARGIN_RIGHT,
      y: 35,
    },
    thickness: 0.7,
    color: BORDER,
  });

  drawText(
    page,
    'Rapport annuel GIPE Villemandeur',
    MARGIN_LEFT,
    20,
    8,
    regular,
    GREY
  );
}

function addReportPage(
  pdf: PDFDocument,
  regular: any,
  bold: any,
  report: AnnualReportData
) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  drawHeader(page, regular, bold, report);

  return page;
}

function drawSectionTitle(
  page: PDFPage,
  title: string,
  y: number,
  bold: any
) {
  drawText(page, title, MARGIN_LEFT, y, 15, bold, DARK);

  page.drawLine({
    start: {
      x: MARGIN_LEFT,
      y: y - 7,
    },
    end: {
      x: PAGE_WIDTH - MARGIN_RIGHT,
      y: y - 7,
    },
    thickness: 1,
    color: BURGUNDY,
  });

  return y - 30;
}

function drawMetricBox(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  regular: any,
  bold: any,
  valueColor = DARK
) {
  const height = 58;

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    color: LIGHT_GREY,
    borderColor: BORDER,
    borderWidth: 0.8,
  });

  drawText(page, label, x + 10, y - 18, 8.5, regular, GREY);

  drawText(page, value, x + 10, y - 42, 14, bold, valueColor);
}

function drawFinancialTable(
  page: PDFPage,
  report: AnnualReportData,
  regular: any,
  bold: any,
  startY: number
) {
  let y = startY;

  const categoryWidth = 270;
  const depensesWidth = 105;
  const recettesWidth = CONTENT_WIDTH - categoryWidth - depensesWidth;

  const xCategory = MARGIN_LEFT;
  const xDepenses = xCategory + categoryWidth;
  const xRecettes = xDepenses + depensesWidth;

  const headerHeight = 28;
  const rowHeight = 24;

  // En-tête
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: BURGUNDY,
  });

  drawText(
    page,
    'Catégorie',
    xCategory + 8,
    y - 18,
    9,
    bold,
    rgb(1, 1, 1)
  );

  drawText(
    page,
    'Dépenses',
    xDepenses + 8,
    y - 18,
    9,
    bold,
    rgb(1, 1, 1)
  );

  drawText(
    page,
    'Recettes',
    xRecettes + 8,
    y - 18,
    9,
    bold,
    rgb(1, 1, 1)
  );

  y -= headerHeight;

  const rows = [...report.financialByCategory];

  for (const row of rows) {
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: y - rowHeight,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderColor: BORDER,
      borderWidth: 0.5,
    });

    drawText(
      page,
      row.category || 'Sans catégorie',
      xCategory + 8,
      y - 16,
      8.5,
      regular,
      DARK
    );

    drawText(
      page,
      euro(row.depenses),
      xDepenses + 8,
      y - 16,
      8.5,
      regular,
      row.depenses > 0 ? RED : GREY
    );

    drawText(
      page,
      euro(row.recettes),
      xRecettes + 8,
      y - 16,
      8.5,
      regular,
      row.recettes > 0 ? GREEN : GREY
    );

    y -= rowHeight;
  }

  // Ligne de total
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - rowHeight,
    width: CONTENT_WIDTH,
    height: rowHeight,
    color: LIGHT_GREY,
    borderColor: BORDER,
    borderWidth: 0.8,
  });

  drawText(
    page,
    'TOTAL',
    xCategory + 8,
    y - 16,
    8.5,
    bold,
    DARK
  );

  drawText(
    page,
    euro(report.totalDepenses),
    xDepenses + 8,
    y - 16,
    8.5,
    bold,
    RED
  );

  drawText(
    page,
    euro(report.totalRecettes),
    xRecettes + 8,
    y - 16,
    8.5,
    bold,
    GREEN
  );

  y -= rowHeight;

  return y;
}

export async function buildAnnualReportPdf(
  report: AnnualReportData
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  /*
   * PAGE 1
   * Bilan d'adhésion
   */
  let page = addReportPage(pdf, regular, bold, report);

  let y = PAGE_HEIGHT - 125;

  y = drawSectionTitle(
    page,
    "1. Bilan d'adhésion",
    y,
    bold
  );

  drawMetricBox(
    page,
    MARGIN_LEFT,
    y,
    CONTENT_WIDTH,
    "Nombre total d'adhérents",
    String(report.totalAdherents),
    regular,
    bold
  );

  y -= 85;

  drawText(
    page,
    'Répartition des adhérents par classe',
    MARGIN_LEFT,
    y,
    11,
    bold,
    DARK
  );

  y -= 25;

  const classes = Object.entries(report.adherentsByClass)
    .sort(([a], [b]) =>
      a.localeCompare(b, 'fr', {
        numeric: true,
        sensitivity: 'base',
      })
    );

  for (const [className, count] of classes) {
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: y - 23,
      width: CONTENT_WIDTH,
      height: 23,
      color: rgb(1, 1, 1),
      borderColor: BORDER,
      borderWidth: 0.5,
    });

    drawText(
      page,
      className,
      MARGIN_LEFT + 8,
      y - 15,
      9,
      regular,
      DARK
    );

    drawText(
      page,
      String(count),
      PAGE_WIDTH - MARGIN_RIGHT - 40,
      y - 15,
      9,
      bold,
      DARK
    );

    y -= 23;
  }

  drawFooter(page, regular);

  /*
   * PAGE 2
   * Bilan financier
   */
  page = addReportPage(pdf, regular, bold, report);

  y = PAGE_HEIGHT - 125;

  y = drawSectionTitle(
    page,
    "2. Bilan financier",
    y,
    bold
  );

  drawText(
    page,
    'Synthèse financière de l’exercice',
    MARGIN_LEFT,
    y,
    11,
    bold,
    DARK
  );

  y -= 20;

  const boxGap = 10;
  const boxWidth = (CONTENT_WIDTH - boxGap * 2) / 3;

  drawMetricBox(
    page,
    MARGIN_LEFT,
    y,
    boxWidth,
    'Solde initial',
    euro(report.initialBalance),
    regular,
    bold,
    DARK
  );

  drawMetricBox(
    page,
    MARGIN_LEFT + boxWidth + boxGap,
    y,
    boxWidth,
    'Total recettes',
    euro(report.totalRecettes),
    regular,
    bold,
    GREEN
  );

  drawMetricBox(
    page,
    MARGIN_LEFT + (boxWidth + boxGap) * 2,
    y,
    boxWidth,
    'Total dépenses',
    euro(report.totalDepenses),
    regular,
    bold,
    RED
  );

  y -= 85;

  drawMetricBox(
    page,
    MARGIN_LEFT,
    y,
    CONTENT_WIDTH,
    'Solde final de l’exercice',
    euro(report.solde),
    regular,
    bold,
    report.solde >= 0 ? GREEN : RED
  );

  y -= 90;

  drawText(
    page,
    'Détail par catégorie',
    MARGIN_LEFT,
    y,
    11,
    bold,
    DARK
  );

  y -= 20;

  y = drawFinancialTable(
    page,
    report,
    regular,
    bold,
    y
  );

  drawFooter(page, regular);

  /*
   * PAGE 3
   * Bilan moral
   *
   * Cette partie sera enrichie ensuite avec :
   * - instances / conseils
   * - actions menées
   * - projets
   * - événements
   * - communication
   * - etc.
   */
  page = addReportPage(pdf, regular, bold, report);

  y = PAGE_HEIGHT - 125;

  y = drawSectionTitle(
    page,
    "3. Bilan moral",
    y,
    bold
  );

  drawText(
    page,
    "Cette partie du rapport sera complétée avec le bilan des",
    MARGIN_LEFT,
    y,
    10,
    regular,
    DARK
  );

  y -= 18;

  drawText(
    page,
    "actions et des instances de l'association.",
    MARGIN_LEFT,
    y,
    10,
    regular,
    DARK
  );

  y -= 45;

  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - 180,
    width: CONTENT_WIDTH,
    height: 180,
    color: LIGHT_GREY,
    borderColor: BORDER,
    borderWidth: 0.8,
  });

  drawText(
    page,
    'Contenu à compléter',
    MARGIN_LEFT + 15,
    y - 25,
    10,
    bold,
    GREY
  );

  drawFooter(page, regular);

  /*
   * PAGE 4
   * Perspectives
   */
  page = addReportPage(pdf, regular, bold, report);

  y = PAGE_HEIGHT - 125;

  y = drawSectionTitle(
    page,
    "4. Perspectives",
    y,
    bold
  );

  drawText(
    page,
    "Cette partie permettra de présenter les projets,",
    MARGIN_LEFT,
    y,
    10,
    regular,
    DARK
  );

  y -= 18;

  drawText(
    page,
    "objectifs et orientations pour le nouvel exercice.",
    MARGIN_LEFT,
    y,
    10,
    regular,
    DARK
  );

  y -= 45;

  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - 180,
    width: CONTENT_WIDTH,
    height: 180,
    color: LIGHT_GREY,
    borderColor: BORDER,
    borderWidth: 0.8,
  });

  drawText(
    page,
    'Contenu à compléter',
    MARGIN_LEFT + 15,
    y - 25,
    10,
    bold,
    GREY
  );

  drawFooter(page, regular);

  /*
   * Informations de clôture
   */
  page = addReportPage(pdf, regular, bold, report);

  y = PAGE_HEIGHT - 125;

  y = drawSectionTitle(
    page,
    "Clôture de l'exercice",
    y,
    bold
  );

  drawText(
    page,
    `Exercice clôturé : ${report.schoolYear}`,
    MARGIN_LEFT,
    y,
    10,
    regular,
    DARK
  );

  y -= 22;

  drawText(
    page,
    `Date de clôture : ${dateFr(report.closedAt)}`,
    MARGIN_LEFT,
    y,
    10,
    regular,
    DARK
  );

  y -= 45;

  drawMetricBox(
    page,
    MARGIN_LEFT,
    y,
    CONTENT_WIDTH,
    'Solde transmis au nouvel exercice',
    euro(report.solde),
    regular,
    bold,
    report.solde >= 0 ? GREEN : RED
  );

  drawFooter(page, regular);

  return pdf.save();
}
