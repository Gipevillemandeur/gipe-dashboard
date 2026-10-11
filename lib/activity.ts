import { createAdminClient } from '@/lib/supabase/admin';
import { getOfficeAccess, type OfficeAccess } from '@/lib/office-auth';

/*
 * Journal des modifications (« Dernières modifications »
 * sur le tableau de bord).
 *
 * Ne bloque JAMAIS l'action : si l'écriture du journal
 * échoue (table absente…), on l'ignore simplement.
 */

const KEEP_DAYS = 180;

type Actor = Pick<OfficeAccess, 'userId' | 'email' | 'positionName'>;

export async function logActivity(
  area: string,
  summary: string,
  actor?: Actor | null
) {
  try {
    const who = actor ?? (await getOfficeAccess());

    if (!who?.userId && !who?.email) return;

    const admin = createAdminClient();

    await admin.from('gipe_activity_log').insert({
      user_id: who.userId,
      actor_email: who.email,
      actor_position: who.positionName,
      area,
      summary: summary.slice(0, 300),
    });

    // Petit ménage : on ne garde que les derniers mois.
    await admin
      .from('gipe_activity_log')
      .delete()
      .lt(
        'created_at',
        new Date(Date.now() - KEEP_DAYS * 24 * 3600 * 1000).toISOString()
      );
  } catch (error) {
    console.error('Journal des modifications :', error);
  }
}

export function euros(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function quote(value: unknown, max = 60) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return `« ${text.length > max ? `${text.slice(0, max - 1)}…` : text} »`;
}
