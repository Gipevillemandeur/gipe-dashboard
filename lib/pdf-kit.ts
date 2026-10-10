/*
 * Petit moteur de mise en page PDF (pdf-lib), partagé par
 * le bilan annuel et les listes d'archives.
 *
 * - passage automatique à la page suivante ;
 * - texte multi-lignes avec retour à la ligne ;
 * - tableaux avec en-tête répété sur chaque page ;
 * - caractères non imprimables remplacés (évite les plantages
 *   de pdf-lib sur les emojis, flèches, etc.).
 */

import { GIPE_LOGO_PNG_BASE64 } from '@/lib/pdf-logo';
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from 'pdf-lib';

export const COLORS = {
  dark: rgb(0.12, 0.12, 0.16),
  grey: rgb(0.45, 0.45, 0.48),
  light: rgb(0.95, 0.94, 0.93),
  border: rgb(0.82, 0.79, 0.76),
  burgundy: rgb(0.49, 0.13, 0.1),
  green: rgb(0.08, 0.42, 0.2),
  red: rgb(0.65, 0.08, 0.08),
  white: rgb(1, 1, 1),
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 45;
const HEADER_HEIGHT = 74;
const TOP = PAGE_HEIGHT - HEADER_HEIGHT - 30;
const BOTTOM = 60;

export type TableColumn = {
  header: string;
  width: number; // proportion (sera ramenée à la largeur utile)
  align?: 'left' | 'right' | 'center';
};

export class PdfBuilder {
  pdf!: PDFDocument;
  regular!: PDFFont;
  bold!: PDFFont;
  logo: PDFImage | null = null;
  page!: PDFPage;
  y = TOP;
  private charset = new Set<number>();
  private pages: PDFPage[] = [];

  readonly width = PAGE_WIDTH - MARGIN_X * 2;
  readonly left = MARGIN_X;

  constructor(
    private title: string,
    private subtitle: string
  ) {}

  static async create(title: string, subtitle: string) {
    const builder = new PdfBuilder(title, subtitle);

    builder.pdf = await PDFDocument.create();
    builder.pdf.setTitle(`${title} — ${subtitle}`);
    builder.pdf.setAuthor('GIPE Villemandeur');
    builder.regular = await builder.pdf.embedFont(StandardFonts.Helvetica);
    builder.bold = await builder.pdf.embedFont(StandardFonts.HelveticaBold);
    builder.charset = new Set(builder.regular.getCharacterSet());

    try {
      builder.logo = await builder.pdf.embedPng(
        Buffer.from(GIPE_LOGO_PNG_BASE64, 'base64')
      );
    } catch {
      builder.logo = null; // le PDF reste valable sans logo
    }

    builder.newPage();

    return builder;
  }

  /*
   * Remplace les caractères que la police ne sait pas
   * dessiner (sinon pdf-lib plante).
   */
  clean(text: string) {
    const normalized = String(text ?? '')
      .replace(/\r/g, '')
      .replace(/\t/g, '    ')
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”«»]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/[→⇒]/g, '->')
      .replace(/ | /g, ' ');

    let out = '';

    for (const char of normalized) {
      const code = char.codePointAt(0)!;
      out += char === '\n' || this.charset.has(code) ? char : '?';
    }

    return out;
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(this.page);

    /*
     * En-tête : logo + nom de l'association + titre du document,
     * souligné d'un filet bordeaux.
     */
    let textX = MARGIN_X;

    if (this.logo) {
      const size = 50;
      const ratio = this.logo.width / this.logo.height;

      this.page.drawImage(this.logo, {
        x: MARGIN_X,
        y: PAGE_HEIGHT - 12 - size,
        width: size * ratio,
        height: size,
      });

      textX = MARGIN_X + size * ratio + 12;
    }

    this.page.drawText(this.clean('GIPE Villemandeur'), {
      x: textX,
      y: PAGE_HEIGHT - 34,
      size: 14,
      font: this.bold,
      color: COLORS.burgundy,
    });

    this.page.drawText(this.clean(`${this.title} — ${this.subtitle}`), {
      x: textX,
      y: PAGE_HEIGHT - 51,
      size: 9.5,
      font: this.regular,
      color: COLORS.grey,
    });

    this.page.drawLine({
      start: { x: MARGIN_X, y: PAGE_HEIGHT - HEADER_HEIGHT },
      end: { x: PAGE_WIDTH - MARGIN_X, y: PAGE_HEIGHT - HEADER_HEIGHT },
      thickness: 1.5,
      color: COLORS.burgundy,
    });

    this.y = TOP;
  }

  /* Garantit `height` points libres, sinon nouvelle page. */
  ensure(height: number) {
    if (this.y - height < BOTTOM) {
      this.newPage();
    }
  }

  space(height: number) {
    this.y -= height;
  }

  textWidth(text: string, size: number, bold = false) {
    return (bold ? this.bold : this.regular).widthOfTextAtSize(
      this.clean(text),
      size
    );
  }

  wrap(text: string, size: number, maxWidth: number, bold = false) {
    const font = bold ? this.bold : this.regular;
    const lines: string[] = [];

    for (const paragraph of this.clean(text).split('\n')) {
      const words = paragraph.split(/ +/);
      let line = '';

      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;

        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
          continue;
        }

        if (line) lines.push(line);

        // Mot plus long que la ligne : on le coupe.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > maxWidth) {
          let cut = rest.length;
          while (
            cut > 1 &&
            font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth
          ) {
            cut--;
          }
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }

      lines.push(line);
    }

    return lines;
  }

  drawLine(
    text: string,
    x: number,
    y: number,
    size: number,
    options: { bold?: boolean; color?: RGB } = {}
  ) {
    this.page.drawText(this.clean(text), {
      x,
      y,
      size,
      font: options.bold ? this.bold : this.regular,
      color: options.color || COLORS.dark,
    });
  }

  /* Paragraphe avec retours à la ligne et sauts de page. */
  paragraph(
    text: string,
    options: { size?: number; bold?: boolean; color?: RGB; indent?: number } = {}
  ) {
    const size = options.size ?? 10;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.45;

    for (const line of this.wrap(text, size, this.width - indent, options.bold)) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.drawLine(line, this.left + indent, this.y + 3, size, options);
    }
  }

  /*
   * `keepTogether` : place minimale à garder sous le titre ;
   * sinon la section commence sur une nouvelle page.
   */
  sectionTitle(title: string, keepTogether = 60) {
    this.ensure(keepTogether);
    this.y -= 26;
    this.drawLine(title, this.left, this.y, 15, { bold: true, color: COLORS.burgundy });
    this.y -= 8;
    this.page.drawLine({
      start: { x: this.left, y: this.y },
      end: { x: this.left + this.width, y: this.y },
      thickness: 1,
      color: COLORS.burgundy,
    });
    this.y -= 6;
  }

  subTitle(title: string, keepTogether = 40) {
    this.ensure(keepTogether);
    this.y -= 20;
    this.drawLine(title, this.left, this.y, 11.5, { bold: true });
    this.y -= 4;
  }

  /* Rangée de cases « chiffre clé ». */
  metrics(items: { label: string; value: string; color?: RGB }[]) {
    const gap = 10;
    const boxWidth = (this.width - gap * (items.length - 1)) / items.length;
    const height = 54;

    this.ensure(height + 14);
    this.y -= 10;

    items.forEach((item, index) => {
      const x = this.left + index * (boxWidth + gap);

      this.page.drawRectangle({
        x,
        y: this.y - height,
        width: boxWidth,
        height,
        color: COLORS.light,
        borderColor: COLORS.border,
        borderWidth: 0.7,
      });

      this.drawLine(item.label, x + 9, this.y - 17, 8, { color: COLORS.grey });
      this.drawLine(item.value, x + 9, this.y - 40, 13.5, {
        bold: true,
        color: item.color || COLORS.dark,
      });
    });

    this.y -= height + 4;
  }

  /*
   * Tableau : retour à la ligne dans les cellules,
   * en-tête répété après chaque saut de page.
   */
  table(
    columns: TableColumn[],
    rows: string[][],
    options: {
      size?: number;
      boldLastRow?: boolean;
      // lignes « sous-total » mises en valeur (index des lignes)
      highlightRows?: number[];
    } = {}
  ) {
    const size = options.size ?? 9;
    const padding = 5;
    const lineHeight = size * 1.35;
    const total = columns.reduce((sum, c) => sum + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * this.width);

    const drawHeader = () => {
      const height = lineHeight + padding * 2;
      this.ensure(height + lineHeight + padding * 2);

      this.page.drawRectangle({
        x: this.left,
        y: this.y - height,
        width: this.width,
        height,
        color: COLORS.burgundy,
      });

      let x = this.left;
      columns.forEach((column, i) => {
        this.cell(column.header, x, widths[i], this.y - padding - size, size, {
          bold: true,
          color: COLORS.white,
          align: column.align,
        });
        x += widths[i];
      });

      this.y -= height;
    };

    this.y -= 6;
    drawHeader();

    rows.forEach((row, rowIndex) => {
      const isLast = rowIndex === rows.length - 1;
      const highlighted = Boolean(options.highlightRows?.includes(rowIndex));
      const bold = Boolean(options.boldLastRow && isLast) || highlighted;

      const wrapped = row.map((value, i) =>
        this.wrap(value ?? '', size, widths[i] - padding * 2, bold)
      );
      const lines = Math.max(1, ...wrapped.map((w) => w.length));
      const height = lines * lineHeight + padding * 2;

      if (this.y - height < BOTTOM) {
        this.newPage();
        drawHeader();
      }

      if (rowIndex % 2 === 1 || bold) {
        this.page.drawRectangle({
          x: this.left,
          y: this.y - height,
          width: this.width,
          height,
          color: highlighted
            ? rgb(0.97, 0.94, 0.91)
            : bold
              ? rgb(0.93, 0.89, 0.86)
              : COLORS.light,
        });
      }

      let x = this.left;
      wrapped.forEach((cellLines, i) => {
        cellLines.forEach((line, lineIndex) => {
          this.cell(
            line,
            x,
            widths[i],
            this.y - padding - size - lineIndex * lineHeight,
            size,
            { bold, align: columns[i].align }
          );
        });
        x += widths[i];
      });

      this.y -= height;

      this.page.drawLine({
        start: { x: this.left, y: this.y },
        end: { x: this.left + this.width, y: this.y },
        thickness: 0.4,
        color: COLORS.border,
      });
    });
  }

  private cell(
    text: string,
    x: number,
    width: number,
    y: number,
    size: number,
    options: { bold?: boolean; color?: RGB; align?: 'left' | 'right' | 'center' }
  ) {
    const padding = 5;
    const textWidth = this.textWidth(text, size, options.bold);
    let drawX = x + padding;

    if (options.align === 'right') drawX = x + width - padding - textWidth;
    if (options.align === 'center') drawX = x + (width - textWidth) / 2;

    this.drawLine(text, drawX, y, size, options);
  }

  /* Encadré avec lignes vides pour écrire à la main. */
  writingArea(lines: number) {
    const lineGap = 22;

    for (let i = 0; i < lines; i++) {
      this.ensure(lineGap);
      this.y -= lineGap;
      this.page.drawLine({
        start: { x: this.left, y: this.y },
        end: { x: this.left + this.width, y: this.y },
        thickness: 0.5,
        color: COLORS.border,
      });
    }
  }

  async save() {
    const count = this.pages.length;

    this.pages.forEach((page, index) => {
      const label = this.clean(`Page ${index + 1} / ${count}`);
      const width = this.regular.widthOfTextAtSize(label, 8);

      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN_X - width,
        y: 30,
        size: 8,
        font: this.regular,
        color: COLORS.grey,
      });

      page.drawText(this.clean('GIPE Villemandeur — document généré par le centre de gestion'), {
        x: MARGIN_X,
        y: 30,
        size: 8,
        font: this.regular,
        color: COLORS.grey,
      });
    });

    return this.pdf.save();
  }
}

export function euro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  })
    .format(value)
    .replace(/ | /g, ' ');
}

export function dateFr(value: string | null | undefined) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(value);
}

export function dateTimeFr(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(date);
}
