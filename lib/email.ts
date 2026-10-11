/*
 * Envoi d'e-mails aux adhérents (via Resend).
 *
 * - Chaque adhérent reçoit SON e-mail (personne ne voit
 *   l'adresse des autres).
 * - Quota : l'offre gratuite de Resend autorise 100 e-mails par
 *   jour (remis à zéro à minuit, heure UTC). On s'arrête à 90 pour
 *   laisser de la place aux comptes rendus de l'app des conseils.
 */

export const DAILY_LIMIT = 90;

export const REPLY_TO = 'contact@gipevillemandeur.com';

export function fromAddress() {
  return (
    process.env.ADHERENTS_FROM_EMAIL ||
    process.env.CONSEILS_FROM_EMAIL ||
    'GIPE Villemandeur <noreply@gipevillemandeur.com>'
  );
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Minuit UTC du jour (remise à zéro du quota Resend). */
export function quotaDayStart() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/*
 * Envoie jusqu'à 100 e-mails en un appel.
 * Renvoie, pour chaque e-mail, null (parti) ou un message d'erreur.
 */
export async function sendBatch(emails: OutgoingEmail[]): Promise<(string | null)[]> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return emails.map(() => 'Envoi d’e-mails non configuré (RESEND_API_KEY absente).');
  }

  if (emails.length === 0) return [];

  try {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(
        emails.map((email) => ({
          from: fromAddress(),
          to: [email.to],
          reply_to: REPLY_TO,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }))
      ),
    });

    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      data?: { id?: string }[];
    };

    if (!response.ok) {
      const message = data?.message || `Resend a refusé l’envoi (code ${response.status}).`;
      return emails.map(() => message);
    }

    return emails.map(() => null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur réseau pendant l’envoi.';
    return emails.map(() => message);
  }
}

/* ---------------------------------------------------------
 * Mise en page commune
 * --------------------------------------------------------- */

function layout(innerHtml: string, footer: string) {
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#fff8f0;font-family:Arial,Helvetica,sans-serif;color:#241c1b;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #eadfd5;border-radius:12px;overflow:hidden;">
    <div style="padding:18px 24px;background:#8f211c;color:#ffffff;">
      <div style="font-size:18px;font-weight:bold;">GIPE Villemandeur</div>
      <div style="font-size:12px;opacity:.85;">Groupement Indépendant de Parents d’Élèves – Collège Lucie Aubrac</div>
    </div>
    <div style="padding:24px;font-size:15px;line-height:1.6;">
      ${innerHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #eadfd5;font-size:12px;color:#756a67;line-height:1.5;">
      ${footer}
    </div>
  </div>
</body>
</html>`;
}

function paragraphs(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`
    )
    .join('\n');
}

const PAYMENT_LABELS: Record<string, string> = {
  cheque: 'chèque',
  cash: 'espèces',
  transfer: 'virement',
  online: 'paiement en ligne',
  other: 'autre moyen',
};

function euros(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function dateFr(value: string | null | undefined) {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
}

/* ---------------------------------------------------------
 * Reçu d'adhésion
 * --------------------------------------------------------- */

export type ReceiptData = {
  firstName: string;
  lastName: string;
  schoolYear: string;
  amount: number | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  children: { firstName: string; lastName: string; className: string }[];
};

export function receiptEmail(data: ReceiptData) {
  const subject = `Votre adhésion au GIPE Villemandeur – ${data.schoolYear}`;

  const payment = [
    data.amount ? `Cotisation : ${euros(data.amount)}` : '',
    data.paymentDate ? `reçue le ${dateFr(data.paymentDate)}` : '',
    data.paymentMethod ? `(${PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const children = data.children.map((child) =>
    `${child.firstName} ${child.lastName}${child.className ? ` – ${child.className}` : ''}`.trim()
  );

  const text = [
    `Bonjour ${data.firstName},`,
    '',
    `Merci pour votre adhésion au GIPE Villemandeur pour l’année scolaire ${data.schoolYear}. Elle est bien enregistrée.`,
    '',
    payment,
    children.length ? `Enfant(s) : ${children.join(', ')}` : '',
    '',
    'Votre soutien nous permet de représenter les parents auprès du collège, notamment lors des conseils de classe.',
    '',
    'Pour toute question, il suffit de répondre à ce message.',
    '',
    'Le bureau du GIPE Villemandeur',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');

  const html = layout(
    `<p style="margin:0 0 14px;">Bonjour ${escapeHtml(data.firstName)},</p>
     <p style="margin:0 0 14px;">Merci pour votre adhésion au <strong>GIPE Villemandeur</strong> pour l’année scolaire <strong>${escapeHtml(data.schoolYear).replace(/-/g, '&#8209;')}</strong>. Elle est bien enregistrée.</p>
     <div style="margin:0 0 16px;padding:12px 14px;background:#fff7ee;border:1px solid #eadfd5;border-radius:10px;">
       ${payment ? `<div>${escapeHtml(payment)}</div>` : ''}
       ${children.length ? `<div style="margin-top:4px;">Enfant(s) : ${escapeHtml(children.join(', '))}</div>` : ''}
     </div>
     <p style="margin:0 0 14px;">Votre soutien nous permet de représenter les parents auprès du collège, notamment lors des conseils de classe.</p>
     <p style="margin:0 0 14px;">Pour toute question, il suffit de répondre à ce message.</p>
     <p style="margin:0;">Le bureau du GIPE Villemandeur</p>`,
    `Vous recevez cet e-mail car vous avez adhéré au GIPE Villemandeur pour l’année ${escapeHtml(data.schoolYear)}.`
  );

  return { subject, html, text };
}

/* ---------------------------------------------------------
 * Message à un groupe
 * --------------------------------------------------------- */

export function messageEmail(input: {
  subject: string;
  body: string;
  firstName: string | null;
  schoolYear: string;
}) {
  const greeting = input.firstName ? `Bonjour ${input.firstName},` : 'Bonjour,';

  const text = `${greeting}\n\n${input.body.trim()}\n\n—\nGIPE Villemandeur\nRépondre à ce message : ${REPLY_TO}`;

  const html = layout(
    `<p style="margin:0 0 14px;">${escapeHtml(greeting)}</p>
     ${paragraphs(input.body)}`,
    `Vous recevez cet e-mail car vous êtes adhérent(e) du GIPE Villemandeur pour l’année ${escapeHtml(input.schoolYear)}. Pour nous écrire, répondez simplement à ce message.`
  );

  return { subject: input.subject.trim(), html, text };
}
