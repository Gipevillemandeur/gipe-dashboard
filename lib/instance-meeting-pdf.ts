import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from 'pdf-lib'

export type InstanceMeetingPdfDocument = {
  fileName: string
}

export type InstanceMeetingPdfData = {
  schoolYear: string
  type: string
  subject: string
  meetingDate: string
  meetingTime?: string | null
  location?: string | null
  summary?: string | null
  documents?: InstanceMeetingPdfDocument[]
  closedAt?: string | null
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89

const MARGIN_X = 48
const CONTENT_WIDTH =
  PAGE_WIDTH - MARGIN_X * 2

const BURGUNDY = rgb(0.49, 0.125, 0.105)
const CREAM = rgb(0.985, 0.97, 0.94)
const CREAM_BORDER = rgb(0.91, 0.86, 0.80)
const TEXT = rgb(0.18, 0.20, 0.24)
const MUTED = rgb(0.38, 0.41, 0.46)
const WHITE = rgb(1, 1, 1)
const LIGHT = rgb(0.965, 0.97, 0.975)

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatTime(value?: string | null) {
  if (!value) return '—'

  return value.slice(0, 5)
}

function drawHeader(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  data: InstanceMeetingPdfData
) {
  const headerHeight = 138

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: BURGUNDY,
  })

  const centerX = PAGE_WIDTH / 2

  const title = 'FICHE DE RÉUNION'
  const association = 'GIPE VILLEMANDEUR'
  const year = data.schoolYear

  page.drawText(title, {
    x:
      centerX -
      bold.widthOfTextAtSize(title, 22) / 2,
    y: PAGE_HEIGHT - 48,
    size: 22,
    font: bold,
    color: WHITE,
  })

  page.drawText(association, {
    x:
      centerX -
      bold.widthOfTextAtSize(
        association,
        10.5
      ) /
        2,
    y: PAGE_HEIGHT - 76,
    size: 10.5,
    font: bold,
    color: WHITE,
  })

  page.drawText(year, {
    x:
      centerX -
      regular.widthOfTextAtSize(year, 11) / 2,
    y: PAGE_HEIGHT - 100,
    size: 11,
    font: regular,
    color: WHITE,
  })
}

function drawFooter(
  page: PDFPage,
  regular: PDFFont,
  data: InstanceMeetingPdfData
) {
  page.drawLine({
    start: {
      x: MARGIN_X,
      y: 42,
    },
    end: {
      x: PAGE_WIDTH - MARGIN_X,
      y: 42,
    },
    thickness: 0.6,
    color: CREAM_BORDER,
  })

  const dateLabel = data.closedAt
    ? new Date(
        data.closedAt
      ).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')

  const leftText =
    `Document archivé le ${dateLabel}`

  const rightText =
    `GIPE Villemandeur - ${data.schoolYear}`

  page.drawText(leftText, {
    x: MARGIN_X,
    y: 26,
    size: 7.5,
    font: regular,
    color: MUTED,
  })

  page.drawText(rightText, {
    x:
      PAGE_WIDTH -
      MARGIN_X -
      regular.widthOfTextAtSize(
        rightText,
        7.5
      ),
    y: 26,
    size: 7.5,
    font: regular,
    color: MUTED,
  })
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
) {
  const paragraphs = text.replace(
    /\r\n/g,
    '\n'
  ).split('\n')

  const lines: string[] = []

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()

    if (!trimmed) {
      lines.push('')
      continue
    }

    const words = trimmed.split(/\s+/)
    let current = ''

    for (const word of words) {
      const candidate = current
        ? `${current} ${word}`
        : word

      if (
        font.widthOfTextAtSize(
          candidate,
          fontSize
        ) <= maxWidth
      ) {
        current = candidate
        continue
      }

      if (current) {
        lines.push(current)
      }

      current = word
    }

    if (current) {
      lines.push(current)
    }
  }

  return lines
}

function drawSectionTitle(
  page: PDFPage,
  bold: PDFFont,
  title: string,
  y: number
) {
  page.drawText(title, {
    x: MARGIN_X,
    y,
    size: 10,
    font: bold,
    color: MUTED,
  })

  page.drawLine({
    start: {
      x: MARGIN_X,
      y: y - 6,
    },
    end: {
      x: PAGE_WIDTH - MARGIN_X,
      y: y - 6,
    },
    thickness: 0.7,
    color: CREAM_BORDER,
  })
}

function drawInfoBox(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  const height = 56

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    color: CREAM,
    borderColor: CREAM_BORDER,
    borderWidth: 1,
  })

  page.drawText(label, {
    x: x + 12,
    y: y - 18,
    size: 8,
    font: regular,
    color: MUTED,
  })

  const lines = wrapText(
    value || '—',
    bold,
    10,
    width - 24
  )

  page.drawText(lines[0] || '—', {
    x: x + 12,
    y: y - 38,
    size: 10,
    font: bold,
    color: TEXT,
  })

  return height
}

export async function buildInstanceMeetingPdf(
  data: InstanceMeetingPdfData
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()

  const regular = await pdf.embedFont(
    StandardFonts.Helvetica
  )

  const bold = await pdf.embedFont(
    StandardFonts.HelveticaBold
  )

  let page = pdf.addPage([
    PAGE_WIDTH,
    PAGE_HEIGHT,
  ])

  drawHeader(
    page,
    bold,
    regular,
    data
  )

  let y = PAGE_HEIGHT - 170

  /*
   * TITRE DE LA RÉUNION
   */

  page.drawText(data.type || 'Réunion', {
    x: MARGIN_X,
    y,
    size: 10,
    font: bold,
    color: BURGUNDY,
  })

  y -= 24

  const subjectLines = wrapText(
    data.subject || 'Sans objet',
    bold,
    21,
    CONTENT_WIDTH
  )

  for (const line of subjectLines) {
    page.drawText(line, {
      x: MARGIN_X,
      y,
      size: 21,
      font: bold,
      color: TEXT,
    })

    y -= 25
  }

  y -= 8

  /*
   * INFORMATIONS
   */

  drawSectionTitle(
    page,
    bold,
    'INFORMATIONS DE LA RÉUNION',
    y
  )

  y -= 24

  const gap = 10
  const boxWidth =
    (CONTENT_WIDTH - gap) / 2

  drawInfoBox(
    page,
    regular,
    bold,
    'Date',
    formatDate(data.meetingDate),
    MARGIN_X,
    y,
    boxWidth
  )

  drawInfoBox(
    page,
    regular,
    bold,
    'Heure',
    formatTime(data.meetingTime),
    MARGIN_X + boxWidth + gap,
    y,
    boxWidth
  )

  y -= 68

  drawInfoBox(
    page,
    regular,
    bold,
    'Lieu',
    data.location || '—',
    MARGIN_X,
    y,
    CONTENT_WIDTH
  )

  y -= 70

  /*
   * RÉSUMÉ
   */

  drawSectionTitle(
    page,
    bold,
    'RÉSUMÉ / COMPTE RENDU',
    y
  )

  y -= 22

  const summary =
    data.summary?.trim() ||
    'Aucun résumé renseigné.'

  const summaryLines = wrapText(
    summary,
    regular,
    10,
    CONTENT_WIDTH - 24
  )

  const lineHeight = 15
  const minimumSummaryHeight = 70
  const summaryHeight = Math.max(
    minimumSummaryHeight,
    summaryLines.length *
      lineHeight +
      28
  )

  /*
   * Si le résumé est très long,
   * on passe sur une nouvelle page
   * avant de le dessiner.
   */
  if (
    y - summaryHeight <
    80
  ) {
    drawFooter(
      page,
      regular,
      data
    )

    page = pdf.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ])

    drawHeader(
      page,
      bold,
      regular,
      data
    )

    y = PAGE_HEIGHT - 170

    drawSectionTitle(
      page,
      bold,
      'RÉSUMÉ / COMPTE RENDU',
      y
    )

    y -= 22
  }

  page.drawRectangle({
    x: MARGIN_X,
    y: y - summaryHeight,
    width: CONTENT_WIDTH,
    height: summaryHeight,
    color: LIGHT,
    borderColor: CREAM_BORDER,
    borderWidth: 1,
  })

  let summaryY =
    y - 20

  for (const line of summaryLines) {
    page.drawText(
      line,
      {
        x: MARGIN_X + 12,
        y: summaryY,
        size: 10,
        font: regular,
        color: TEXT,
      }
    )

    summaryY -= lineHeight
  }

  y -= summaryHeight + 30

  /*
   * DOCUMENTS ASSOCIÉS
   */

  const documents =
    data.documents || []

  /*
   * Si la liste des documents arrive
   * en bas de page, on passe à la page suivante.
   */
  if (
    y - 100 <
    80
  ) {
    drawFooter(
      page,
      regular,
      data
    )

    page = pdf.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ])

    drawHeader(
      page,
      bold,
      regular,
      data
    )

    y = PAGE_HEIGHT - 170
  }

  drawSectionTitle(
    page,
    bold,
    'DOCUMENTS ASSOCIÉS',
    y
  )

  y -= 24

  if (documents.length === 0) {
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 48,
      width: CONTENT_WIDTH,
      height: 48,
      color: LIGHT,
      borderColor: CREAM_BORDER,
      borderWidth: 1,
    })

    page.drawText(
      'Aucun document associé à cette réunion.',
      {
        x: MARGIN_X + 12,
        y: y - 29,
        size: 9,
        font: regular,
        color: MUTED,
      }
    )

    y -= 68
  } else {
    for (
      let index = 0;
      index < documents.length;
      index += 1
    ) {
      const document =
        documents[index]

      const documentName =
        document.fileName ||
        `Document ${index + 1}`

      if (y - 32 < 70) {
        drawFooter(
          page,
          regular,
          data
        )

        page = pdf.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT,
        ])

        drawHeader(
          page,
          bold,
          regular,
          data
        )

        y = PAGE_HEIGHT - 170

        drawSectionTitle(
          page,
          bold,
          'DOCUMENTS ASSOCIÉS (SUITE)',
          y
        )

        y -= 24
      }

      page.drawRectangle({
        x: MARGIN_X,
        y: y - 30,
        width: CONTENT_WIDTH,
        height: 30,
        color:
          index % 2 === 0
            ? CREAM
            : WHITE,
        borderColor: CREAM_BORDER,
        borderWidth: 0.6,
      })

      page.drawText(
        `${index + 1}.`,
        {
          x: MARGIN_X + 10,
          y: y - 19,
          size: 9,
          font: bold,
          color: BURGUNDY,
        }
      )

      const nameLines =
        wrapText(
          documentName,
          regular,
          9,
          CONTENT_WIDTH - 42
        )

      page.drawText(
        nameLines[0] ||
          documentName,
        {
          x: MARGIN_X + 30,
          y: y - 19,
          size: 9,
          font: regular,
          color: TEXT,
        }
      )

      y -= 34
    }

    y -= 10
  }

  drawFooter(
    page,
    regular,
    data
  )

  return pdf.save()
}
