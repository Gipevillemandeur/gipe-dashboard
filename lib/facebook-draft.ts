'use client';

/*
 * Brouillon transmis à la page Facebook (ex. depuis l'Agenda) :
 * gardé le temps d'ouvrir la page, puis effacé.
 */

export type FacebookDraft = {
  message: string;
  imageUrl?: string | null;
  source?: string;
};

const KEY = 'gipe-facebook-draft';

export function saveFacebookDraft(draft: FacebookDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function takeFacebookDraft(): FacebookDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return typeof draft?.message === 'string' ? draft : null;
  } catch {
    return null;
  }
}

/*
 * Texte proposé pour un événement de l'agenda.
 */
export function eventToFacebookText(event: {
  title: string | null;
  description: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
}) {
  const lines: string[] = [];

  if (event.title) lines.push(`📅 ${event.title}`);

  if (event.event_date) {
    const date = new Date(`${event.event_date}T00:00:00`);
    let when = Number.isNaN(date.getTime())
      ? event.event_date
      : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    when = when.charAt(0).toUpperCase() + when.slice(1);

    if (event.start_time) {
      const hour = (value: string) => value.slice(0, 5).replace(':', 'h').replace(/^0(\d)/, '$1');
      when += ` à ${hour(event.start_time)}`;
      if (event.end_time) when += ` – ${hour(event.end_time)}`;
    }

    lines.push(`🗓️ ${when}`);
  }

  if (event.location) lines.push(`📍 ${event.location}`);

  if (event.description) {
    lines.push('');
    lines.push(event.description.trim());
  }

  return lines.join('\n');
}
