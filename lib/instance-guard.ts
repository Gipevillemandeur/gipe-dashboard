import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * Vérifie qu'une réunion existe ET appartient à l'année
 * scolaire en cours. Les réunions des années clôturées sont
 * figées (elles ont été archivées dans le Drive).
 *
 * Renvoie la réunion, ou une réponse d'erreur prête à renvoyer.
 */
export async function requireEditableMeeting(
  admin: SupabaseClient,
  meetingId: string
): Promise<
  | { meeting: { id: string; school_year_id: string; meeting_date: string } }
  | { error: NextResponse }
> {
  const { data: meeting, error } = await admin
    .from('instance_meetings')
    .select('id,school_year_id,meeting_date')
    .eq('id', meetingId)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        { error: `Impossible de vérifier la réunion : ${error.message}` },
        { status: 500 }
      ),
    };
  }

  if (!meeting) {
    return {
      error: NextResponse.json({ error: 'Réunion introuvable.' }, { status: 404 }),
    };
  }

  const { data: year, error: yearError } = await admin
    .from('school_years')
    .select('is_active')
    .eq('id', meeting.school_year_id)
    .maybeSingle();

  if (yearError) {
    return {
      error: NextResponse.json(
        { error: `Impossible de vérifier l’année : ${yearError.message}` },
        { status: 500 }
      ),
    };
  }

  if (!year?.is_active) {
    return {
      error: NextResponse.json(
        {
          error:
            'Cette réunion appartient à une année clôturée : elle est archivée et ne peut plus être modifiée.',
        },
        { status: 409 }
      ),
    };
  }

  return { meeting };
}
