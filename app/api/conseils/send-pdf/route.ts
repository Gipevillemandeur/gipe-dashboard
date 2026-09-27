import { NextResponse } from 'next/server';

const ALLOWED_ORIGIN =
  process.env.CONSEILS_ALLOWED_ORIGIN ||
  'https://gipevillemandeur.github.io';

const TO_EMAIL = 'contact@gipevillemandeur.com';

const FROM_EMAIL =
  process.env.CONSEILS_FROM_EMAIL ||
  'GIPE Villemandeur <noreply@gipevillemandeur.com>';

function corsHeaders(origin: string | null) {
  const allowed =
    origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  if (origin && origin !== ALLOWED_ORIGIN) {
    return NextResponse.json(
      {
        error: 'Origine non autorisée.',
      },
      {
        status: 403,
        headers: corsHeaders(origin),
      }
    );
  }

  try {
    const body = await request.json();

    const pdfBase64 =
      typeof body?.pdfBase64 === 'string'
        ? body.pdfBase64.trim()
        : '';

    const filename =
      typeof body?.filename === 'string' &&
      body.filename.trim()
        ? body.filename.trim()
        : 'compte-rendu-conseil.pdf';

    const classe =
      typeof body?.classe === 'string'
        ? body.classe.trim()
        : '';

    const trimestre =
      typeof body?.trimestre === 'string'
        ? body.trimestre.trim()
        : '';

    if (!pdfBase64) {
      return NextResponse.json(
        {
          error: 'PDF manquant.',
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // Limite de sécurité : environ 9 Mo de PDF décodé.
    if (pdfBase64.length > 12000000) {
      return NextResponse.json(
        {
          error: 'PDF trop volumineux.',
        },
        {
          status: 413,
          headers: corsHeaders(origin),
        }
      );
    }

    // Un PDF Base64 commence normalement par JVBERi0.
    if (!pdfBase64.startsWith('JVBERi0')) {
      return NextResponse.json(
        {
          error: 'Le fichier transmis ne semble pas être un PDF valide.',
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error('RESEND_API_KEY est absente.');

      return NextResponse.json(
        {
          error: 'Service d’envoi non configuré.',
        },
        {
          status: 500,
          headers: corsHeaders(origin),
        }
      );
    }

    const subjectParts = [
      'Compte rendu conseil de classe',
      classe,
      trimestre,
    ].filter(Boolean);

    const subject =
      subjectParts.join(' – ') ||
      'Compte rendu conseil de classe';

    const html = `
      <p>Bonjour,</p>

      <p>
        Veuillez trouver en pièce jointe le compte rendu du conseil de classe.
      </p>

      ${
        classe
          ? `<p><strong>Classe :</strong> ${escapeHtml(classe)}</p>`
          : ''
      }

      ${
        trimestre
          ? `<p><strong>Trimestre :</strong> ${escapeHtml(trimestre)}</p>`
          : ''
      }

      <p>
        Envoi automatique depuis l'application GIPE Conseils de classe.
      </p>
    `;

    const resendResponse = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [TO_EMAIL],
          subject,
          html,
          attachments: [
            {
              filename,
              content: pdfBase64,
              content_type: 'application/pdf',
            },
          ],
        }),
      }
    );

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error(
        'Erreur Resend:',
        resendData
      );

      return NextResponse.json(
        {
          error: 'Resend a refusé l’envoi du PDF.',
          details:
            typeof resendData?.message === 'string'
              ? resendData.message
              : undefined,
        },
        {
          status: 502,
          headers: corsHeaders(origin),
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Compte rendu envoyé au GIPE.',
        id: resendData?.id ?? null,
      },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error) {
    console.error(
      'Erreur API envoi PDF:',
      error
    );

    return NextResponse.json(
      {
        error: 'Erreur serveur lors de l’envoi du PDF.',
      },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
