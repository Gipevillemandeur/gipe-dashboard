import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOfficePermission, type OfficeAccess } from '@/lib/office-auth';
import { logActivity, quote } from '@/lib/activity';
import {
  DEFAULT_RECEIPT_TEMPLATE,
  DAILY_LIMIT,
  type ReceiptTemplate,
  EMAIL_PATTERN,
  isEmailConfigured,
  messageEmail,
  quotaDayStart,
  receiptEmail,
  sendBatch,
  type OutgoingEmail,
} from '@/lib/email';

/*
 * E-MAILS AUX ADHÉRENTS
 *
 * GET  → quota du jour, reçus déjà envoyés, historique des envois.
 * POST → { action: 'send', kind: 'message', audience, subject, body }
 *        { action: 'send', kind: 'receipt', membershipIds }
 *        { action: 'resume', messageId }   (suite d'un envoi)
 *        { action: 'test', subject, body } (à soi-même)
 *
 * Rien ne part automatiquement : chaque envoi est demandé
 * par un clic.
 */

export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;

type Audience =
  | { type: 'all' }
  | { type: 'ca' }
  | { type: 'bureau' }
  | { type: 'volunteers' }
  | { type: 'class'; classId: string };

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'tous les adhérents',
  ca: 'les membres du CA',
  bureau: 'les membres du bureau',
  volunteers: 'les volontaires des conseils',
  class: 'les parents d’une classe',
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function requireAccess(): Promise<{ admin: Admin; access: OfficeAccess } | NextResponse> {
  try {
    const access = await requireOfficePermission('members');
    return { admin: createAdminClient(), access };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'AUTHENTICATION_REQUIRED') {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    if (message === 'OFFICE_ACCESS_DENIED' || message === 'OFFICE_PERMISSION_DENIED') {
      return NextResponse.json({ error: 'Compte non autorisé.' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Erreur de contrôle des accès.' }, { status: 500 });
  }
}

async function activeYear(admin: Admin) {
  const { data, error } = await admin
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Aucune année scolaire active.');
  return data as { id: string; label: string };
}

async function sentToday(admin: Admin) {
  const { count, error } = await admin
    .from('gipe_email_recipients')
    .select('message_id', { count: 'exact', head: true })
    .gte('sent_at', quotaDayStart());

  if (error) throw new Error(error.message);
  return count || 0;
}

type MembershipRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  amount: number | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  paymentReceived: boolean;
  boardMember: boolean;
  caMember: boolean;
  council: string;
  children: { firstName: string; lastName: string; className: string; classId: string }[];
};

async function loadMemberships(admin: Admin, yearId: string): Promise<MembershipRow[]> {
  const { data, error } = await admin
    .from('gipe_memberships')
    .select(`
      id,
      payment_received,
      payment_date,
      payment_method,
      amount,
      board_member,
      ca_member,
      council_participation,
      gipe_adherents ( first_name, last_name, email ),
      gipe_membership_children (
        gipe_children ( first_name, last_name ),
        classes ( id, name )
      )
    `)
    .eq('school_year_id', yearId);

  if (error) throw new Error(error.message);

  return (data || []).map((m: any) => {
    const adherent = one<any>(m.gipe_adherents) || {};

    return {
      id: m.id,
      email: String(adherent.email || '').trim().toLowerCase(),
      firstName: adherent.first_name || '',
      lastName: adherent.last_name || '',
      amount: m.amount === null ? null : Number(m.amount),
      paymentDate: m.payment_date,
      paymentMethod: m.payment_method,
      paymentReceived: Boolean(m.payment_received),
      boardMember: Boolean(m.board_member),
      caMember: Boolean(m.ca_member),
      council: m.council_participation || 'no',
      children: (m.gipe_membership_children || []).map((link: any) => {
        const child = one<any>(link.gipe_children) || {};
        const cls = one<any>(link.classes) || {};
        return {
          firstName: child.first_name || '',
          lastName: child.last_name || '',
          className: cls.name || '',
          classId: cls.id || '',
        };
      }),
    };
  });
}

function pickAudience(rows: MembershipRow[], audience: Audience) {
  switch (audience.type) {
    case 'ca':
      return rows.filter((r) => r.caMember || r.boardMember);
    case 'bureau':
      return rows.filter((r) => r.boardMember);
    case 'volunteers':
      return rows.filter((r) => r.council !== 'no');
    case 'class':
      return rows.filter((r) => r.children.some((c) => c.classId === audience.classId));
    default:
      return rows;
  }
}

/* Texte du reçu : version modifiée si elle existe, sinon l'original. */
async function loadReceiptTemplate(admin: Admin): Promise<ReceiptTemplate & { customized: boolean; updatedAt?: string; updatedBy?: string | null }> {
  const { data, error } = await admin
    .from('gipe_email_templates')
    .select('subject,body,updated_at,updated_by')
    .eq('key', 'receipt')
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_RECEIPT_TEMPLATE, customized: false };
  }

  return {
    subject: data.subject,
    body: data.body,
    customized: true,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

/* Une seule fois par adresse (deux parents peuvent partager une boîte). */
function uniqueByEmail(rows: MembershipRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!EMAIL_PATTERN.test(row.email) || seen.has(row.email)) return false;
    seen.add(row.email);
    return true;
  });
}

/*
 * Envoie les destinataires encore en attente d'un envoi,
 * dans la limite du quota du jour.
 */
async function deliver(admin: Admin, messageId: string) {
  const { data: message, error: messageError } = await admin
    .from('gipe_email_messages')
    .select('id,kind,subject,body,school_year_id,school_years(label)')
    .eq('id', messageId)
    .maybeSingle();

  if (messageError) throw new Error(messageError.message);
  if (!message) throw new Error('Envoi introuvable.');

  const schoolYear = (one<any>((message as any).school_years) || {}).label || '';

  const { data: pending, error: pendingError } = await admin
    .from('gipe_email_recipients')
    .select('membership_id,email')
    .eq('message_id', messageId)
    .is('sent_at', null);

  if (pendingError) throw new Error(pendingError.message);

  const remainingQuota = Math.max(0, DAILY_LIMIT - (await sentToday(admin)));
  const batch = (pending || []).slice(0, remainingQuota);

  let memberships = new Map<string, MembershipRow>();

  if (batch.some((r) => r.membership_id) && message.school_year_id) {
    memberships = new Map(
      (await loadMemberships(admin, message.school_year_id)).map((m) => [m.id, m])
    );
  }

  const receiptTemplate =
    message.kind === 'receipt' ? await loadReceiptTemplate(admin) : DEFAULT_RECEIPT_TEMPLATE;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);

    const emails: OutgoingEmail[] = chunk.map((recipient) => {
      const member = recipient.membership_id
        ? memberships.get(recipient.membership_id)
        : undefined;

      const content =
        message.kind === 'receipt' && member
          ? receiptEmail(
              {
                firstName: member.firstName,
                lastName: member.lastName,
                schoolYear,
                amount: member.amount,
                paymentDate: member.paymentDate,
                paymentMethod: member.paymentMethod,
                children: member.children,
              },
              receiptTemplate
            )
          : messageEmail({
              subject: message.subject,
              body: message.body || '',
              firstName: member?.firstName || null,
              schoolYear,
            });

      return { to: recipient.email, ...content };
    });

    const results = await sendBatch(emails);
    const now = new Date().toISOString();

    const okEmails = chunk.filter((_, index) => !results[index]).map((r) => r.email);
    const errors = chunk
      .map((r, index) => ({ email: r.email, error: results[index] }))
      .filter((r) => r.error);

    if (okEmails.length > 0) {
      await admin
        .from('gipe_email_recipients')
        .update({ sent_at: now, error: null })
        .eq('message_id', messageId)
        .in('email', okEmails);

      if (message.kind === 'receipt') {
        const ids = chunk
          .filter((r) => okEmails.includes(r.email) && r.membership_id)
          .map((r) => r.membership_id as string);

        if (ids.length > 0) {
          await admin
            .from('gipe_memberships')
            .update({ receipt_sent_at: now })
            .in('id', ids);
        }
      }
    }

    for (const item of errors) {
      await admin
        .from('gipe_email_recipients')
        .update({ error: String(item.error).slice(0, 300) })
        .eq('message_id', messageId)
        .eq('email', item.email);
    }

    sent += okEmails.length;
    failed += errors.length;

    // Erreur générale (clé absente, quota Resend…) : inutile d'insister.
    if (okEmails.length === 0 && errors.length > 0) break;
  }

  const stillPending = (pending || []).length - sent;

  return {
    messageId,
    sent,
    failed,
    pending: stillPending,
    firstError: null as string | null,
  };
}

/* ---------------------------------------------------------
 * GET
 * --------------------------------------------------------- */

export async function GET() {
  const auth = await requireAccess();
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const year = await activeYear(admin);

    const [receiptsResult, messagesResult] = await Promise.all([
      admin
        .from('gipe_memberships')
        .select('id,receipt_sent_at')
        .eq('school_year_id', year.id)
        .not('receipt_sent_at', 'is', null),
      admin
        .from('gipe_email_messages')
        .select('id,created_at,created_by,kind,audience,subject,gipe_email_recipients(sent_at,error)')
        .eq('school_year_id', year.id)
        .neq('kind', 'test')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    // Tables pas encore créées : le reste du dashboard fonctionne.
    if (receiptsResult.error || messagesResult.error) {
      return NextResponse.json({
        ready: false,
        configured: isEmailConfigured(),
        quota: { limit: DAILY_LIMIT, sentToday: 0, remaining: DAILY_LIMIT },
        receipts: {},
        history: [],
      });
    }

    const today = await sentToday(admin);
    const template = await loadReceiptTemplate(admin);

    return NextResponse.json({
      ready: true,
      receiptTemplate: template,
      configured: isEmailConfigured(),
      quota: {
        limit: DAILY_LIMIT,
        sentToday: today,
        remaining: Math.max(0, DAILY_LIMIT - today),
      },
      receipts: Object.fromEntries(
        (receiptsResult.data || []).map((row: any) => [row.id, row.receipt_sent_at])
      ),
      history: (messagesResult.data || []).map((m: any) => {
        const recipients = (m.gipe_email_recipients || []) as {
          sent_at: string | null;
          error: string | null;
        }[];

        return {
          id: m.id,
          createdAt: m.created_at,
          createdBy: m.created_by,
          kind: m.kind,
          audience: m.audience,
          subject: m.subject,
          total: recipients.length,
          sent: recipients.filter((r) => r.sent_at).length,
          failed: recipients.filter((r) => !r.sent_at && r.error).length,
          pending: recipients.filter((r) => !r.sent_at).length,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de chargement.' },
      { status: 500 }
    );
  }
}

/* ---------------------------------------------------------
 * POST
 * --------------------------------------------------------- */

export async function POST(request: Request) {
  const auth = await requireAccess();
  if (auth instanceof NextResponse) return auth;
  const { admin, access } = auth;

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'L’envoi d’e-mails n’est pas configuré (clé RESEND_API_KEY absente sur Vercel).' },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as any;

  if (!body?.action) {
    return NextResponse.json({ error: 'Demande invalide.' }, { status: 400 });
  }

  try {
    const year = await activeYear(admin);
    const createdBy = access.positionName || access.email || null;

    /*
     * Texte du reçu : enregistrer ou revenir à l'original.
     */
    if (body.action === 'save-template') {
      const subject = String(body.subject || '').trim();
      const text = String(body.body || '').replace(/\r\n/g, '\n').trim();

      if (!subject || !text) {
        return NextResponse.json({ error: 'Le sujet et le texte sont obligatoires.' }, { status: 400 });
      }

      if (subject.length > 200 || text.length > 5000) {
        return NextResponse.json({ error: 'Le sujet ou le texte est trop long.' }, { status: 400 });
      }

      const { error } = await admin.from('gipe_email_templates').upsert(
        {
          key: 'receipt',
          subject,
          body: text,
          updated_at: new Date().toISOString(),
          updated_by: createdBy,
        },
        { onConflict: 'key' }
      );

      if (error) {
        return NextResponse.json(
          {
            error: error.message.includes('gipe_email_templates')
              ? 'Lance d’abord migration_emails_v2.sql dans Supabase.'
              : `Enregistrement impossible : ${error.message}`,
          },
          { status: 500 }
        );
      }

      await logActivity('Adhérents', 'a modifié le texte du reçu d’adhésion', access);
      return NextResponse.json({ ok: true, receiptTemplate: await loadReceiptTemplate(admin) });
    }

    if (body.action === 'reset-template') {
      await admin.from('gipe_email_templates').delete().eq('key', 'receipt');
      return NextResponse.json({ ok: true, receiptTemplate: await loadReceiptTemplate(admin) });
    }

    /*
     * Suite d'un envoi interrompu par le quota du jour.
     */
    if (body.action === 'resume') {
      const messageId = String(body.messageId || '');
      const result = await deliver(admin, messageId);

      if (result.sent > 0) {
        await logActivity('Adhérents', `a repris un envoi d’e-mails (${result.sent} envoyé${result.sent > 1 ? 's' : ''})`, access);
      }

      return NextResponse.json({ ok: true, ...result });
    }

    /*
     * Test : le message part uniquement à la personne connectée.
     */
    if (body.action === 'test') {
      const subject = String(body.subject || '').trim();
      const text = String(body.body || '').trim();

      if (!subject || !text) {
        return NextResponse.json({ error: 'Le sujet et le message sont obligatoires.' }, { status: 400 });
      }

      if (!access.email || !EMAIL_PATTERN.test(access.email)) {
        return NextResponse.json({ error: 'Ton adresse e-mail est introuvable.' }, { status: 400 });
      }

      if ((await sentToday(admin)) >= DAILY_LIMIT) {
        return NextResponse.json({ error: 'Le quota d’e-mails du jour est atteint. Réessaie demain.' }, { status: 429 });
      }

      const { data: message, error } = await admin
        .from('gipe_email_messages')
        .insert({
          created_by: createdBy,
          school_year_id: year.id,
          kind: 'test',
          audience: 'test',
          subject: `[TEST] ${subject}`,
          body: text,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await admin
        .from('gipe_email_recipients')
        .insert({ message_id: message.id, membership_id: null, email: access.email });

      const result = await deliver(admin, message.id);

      if (result.sent === 0) {
        const { data: failedRow } = await admin
          .from('gipe_email_recipients')
          .select('error')
          .eq('message_id', message.id)
          .maybeSingle();

        return NextResponse.json(
          { error: failedRow?.error || 'Le test n’est pas parti.' },
          { status: 502 }
        );
      }

      return NextResponse.json({ ok: true, sentTo: access.email });
    }

    if (body.action !== 'send') {
      return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }

    const memberships = await loadMemberships(admin, year.id);
    let recipients: MembershipRow[];
    let subject: string;
    let text: string | null = null;
    let audienceLabel: string;

    if (body.kind === 'receipt') {
      const ids = new Set<string>(
        (Array.isArray(body.membershipIds) ? body.membershipIds : []).map(String)
      );

      recipients = uniqueByEmail(
        memberships.filter((m) => ids.has(m.id) && m.paymentReceived)
      );

      if (recipients.length === 0) {
        return NextResponse.json(
          { error: 'Aucun reçu à envoyer : l’adhésion doit être payée et avoir une adresse e-mail valide.' },
          { status: 400 }
        );
      }

      subject = `Votre adhésion au GIPE Villemandeur – ${year.label}`;
      audienceLabel = 'receipt';
    } else if (body.kind === 'message') {
      subject = String(body.subject || '').trim();
      text = String(body.body || '').trim();

      if (!subject || !text) {
        return NextResponse.json({ error: 'Le sujet et le message sont obligatoires.' }, { status: 400 });
      }

      if (subject.length > 150 || text.length > 10000) {
        return NextResponse.json({ error: 'Le sujet ou le message est trop long.' }, { status: 400 });
      }

      const audience = (body.audience || { type: 'all' }) as Audience;

      if (!AUDIENCE_LABELS[audience.type]) {
        return NextResponse.json({ error: 'Destinataires invalides.' }, { status: 400 });
      }

      recipients = uniqueByEmail(pickAudience(memberships, audience));

      if (recipients.length === 0) {
        return NextResponse.json(
          { error: 'Aucun destinataire avec une adresse e-mail valide dans ce groupe.' },
          { status: 400 }
        );
      }

      audienceLabel = audience.type;
    } else {
      return NextResponse.json({ error: 'Type d’envoi inconnu.' }, { status: 400 });
    }

    const { data: message, error: insertError } = await admin
      .from('gipe_email_messages')
      .insert({
        created_by: createdBy,
        school_year_id: year.id,
        kind: body.kind,
        audience: audienceLabel,
        subject,
        body: text,
      })
      .select('id')
      .single();

    if (insertError) throw new Error(insertError.message);

    const { error: recipientsError } = await admin
      .from('gipe_email_recipients')
      .insert(
        recipients.map((r) => ({
          message_id: message.id,
          membership_id: r.id,
          email: r.email,
        }))
      );

    if (recipientsError) throw new Error(recipientsError.message);

    const result = await deliver(admin, message.id);

    if (result.sent > 0) {
      await logActivity(
        'Adhérents',
        body.kind === 'receipt'
          ? `a envoyé ${result.sent} reçu${result.sent > 1 ? 's' : ''} d’adhésion par e-mail`
          : `a envoyé le message ${quote(subject)} à ${result.sent} adhérent${result.sent > 1 ? 's' : ''}`,
        access
      );
    }

    let firstError: string | null = null;

    if (result.failed > 0) {
      const { data: failedRow } = await admin
        .from('gipe_email_recipients')
        .select('error')
        .eq('message_id', message.id)
        .not('error', 'is', null)
        .limit(1)
        .maybeSingle();

      firstError = failedRow?.error || null;
    }

    return NextResponse.json({
      ok: true,
      ...result,
      total: recipients.length,
      firstError,
    });
  } catch (error) {
    console.error('Erreur envoi e-mails adhérents :', error);

    const message = error instanceof Error ? error.message : 'Envoi impossible.';

    return NextResponse.json(
      {
        error: message.includes('gipe_email')
          ? 'Les e-mails ne sont pas encore installés : lance migration_emails_v1.sql dans Supabase.'
          : message,
      },
      { status: 500 }
    );
  }
}
