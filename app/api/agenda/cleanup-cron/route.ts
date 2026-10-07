import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function getParisDate() {
  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).format(new Date());
}

async function deleteSupabaseImage(
  admin: ReturnType<typeof createAdminClient>,
  imageUrl: string | null | undefined
) {
  if (
    !imageUrl ||
    !imageUrl.includes(
      '/storage/v1/object/public/images/'
    )
  ) {
    return;
  }

  const marker =
    '/storage/v1/object/public/images/';

  const index =
    imageUrl.indexOf(marker);

  if (index === -1) {
    return;
  }

  const path = decodeURIComponent(
    imageUrl.slice(
      index + marker.length
    )
  );

  if (!path) {
    return;
  }

  const { error } = await admin.storage
    .from('images')
    .remove([path]);

  if (error) {
    console.error(
      'Erreur suppression image :',
      error
    );
  }
}

export async function GET(
  request: Request
) {
  try {
    const authHeader =
      request.headers.get(
        'authorization'
      );

    const cronSecret =
      process.env.CRON_SECRET;

    if (
      !cronSecret ||
      authHeader !==
        `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          error:
            'Non autorisé.',
        },
        { status: 401 }
      );
    }

    const admin =
      createAdminClient();

    /*
     * La date utilisée pour le nettoyage est
     * toujours celle de la France.
     *
     * Exemple :
     * à 00:01 le 07/10/2026 en France,
     * today vaut bien 2026-10-07,
     * même si le serveur fonctionne encore
     * sur la date UTC du 06/10.
     */
    const today =
      getParisDate();

    // ---------------------------------------------------------
    // 1. Événements publics expirés
    // ---------------------------------------------------------
    const {
      data: publicEvents,
      error: publicEventsError,
    } = await admin
      .from('events')
      .select(
        'id,title,date,image_url'
      )
      .lt('date', today);

    if (publicEventsError) {
      console.error(
        'Erreur récupération événements publics :',
        publicEventsError
      );

      return NextResponse.json(
        {
          error:
            publicEventsError.message,
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 2. Suppression événements publics
    // ---------------------------------------------------------
    let deletedPublic = 0;

    for (
      const event of
        publicEvents || []
    ) {
      const { error } =
        await admin
          .from('events')
          .delete()
          .eq('id', event.id);

      if (error) {
        console.error(
          `Erreur suppression événement public ${event.id}:`,
          error
        );
        continue;
      }

      deletedPublic++;

      if (event.image_url) {
        await deleteSupabaseImage(
          admin,
          event.image_url
        );
      }
    }

    // ---------------------------------------------------------
    // 3. Événements internes expirés
    // ---------------------------------------------------------
    const {
      data: internalEvents,
      error: internalEventsError,
    } = await admin
      .from('internal_agenda_events')
      .select(
        'id,title,event_date,image_url'
      )
      .lt('event_date', today);

    if (internalEventsError) {
      console.error(
        'Erreur récupération événements internes :',
        internalEventsError
      );

      return NextResponse.json(
        {
          error:
            internalEventsError.message,
          deletedPublic,
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 4. Suppression événements internes
    // ---------------------------------------------------------
    let deletedInternal = 0;

    for (
      const event of
        internalEvents || []
    ) {
      const { error } =
        await admin
          .from('internal_agenda_events')
          .delete()
          .eq('id', event.id);

      if (error) {
        console.error(
          `Erreur suppression événement interne ${event.id}:`,
          error
        );
        continue;
      }

      deletedInternal++;

      if (event.image_url) {
        await deleteSupabaseImage(
          admin,
          event.image_url
        );
      }
    }

    console.log(
      `Nettoyage Agenda : ${deletedPublic} événement(s) public(s), ${deletedInternal} événement(s) interne(s), date France : ${today}.`
    );

    return NextResponse.json({
      ok: true,
      today,
      deleted: {
        public: deletedPublic,
        internal: deletedInternal,
      },
    });
  } catch (error) {
    console.error(
      'Erreur nettoyage automatique Agenda :',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors du nettoyage automatique.',
      },
      { status: 500 }
    );
  }
}
