import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOfficePermission } from '@/lib/office-auth';

async function requireAgendaAccess() {
  try {
    await requireOfficePermission('agenda');

    return {
      admin: createAdminClient(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        'AUTHENTICATION_REQUIRED'
      ) {
        return {
          error: NextResponse.json(
            {
              error:
                'Non authentifié.',
            },
            {
              status: 401,
            }
          ),
        };
      }

      if (
        error.message ===
          'OFFICE_ACCESS_DENIED' ||
        error.message ===
          'OFFICE_PERMISSION_DENIED'
      ) {
        return {
          error: NextResponse.json(
            {
              error:
                'Compte non autorisé.',
            },
            {
              status: 403,
            }
          ),
        };
      }
    }

    console.error(
      'Erreur contrôle accès agenda:',
      error
    );

    return {
      error: NextResponse.json(
        {
          error:
            'Erreur de contrôle des accès.',
        },
        {
          status: 500,
        }
      ),
    };
  }
}

async function deleteSupabaseImage(
  admin: ReturnType<
    typeof createAdminClient
  >,
  imageUrl:
    | string
    | null
    | undefined
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

  const path =
    decodeURIComponent(
      imageUrl.slice(
        index + marker.length
      )
    );

  if (!path) {
    return;
  }

  const { error } =
    await admin.storage
      .from('images')
      .remove([path]);

  if (error) {
    console.error(
      'Erreur suppression image :',
      error
    );
  }
}

export async function GET() {
  const auth =
    await requireAgendaAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } =
    auth;

  try {
    /*
     * La date de référence est celle du serveur.
     * Les événements dont la date est strictement
     * antérieure à aujourd'hui sont considérés comme expirés.
     */
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    // ---------------------------------------------------------
    // 1. Récupération des événements publics expirés
    // ---------------------------------------------------------
    const {
      data: publicEvents,
      error:
        publicEventsError,
    } = await admin
      .from('events')
      .select(
        'id,title,date,image_url'
      )
      .lt(
        'date',
        today
      )
      .order(
        'date',
        {
          ascending: true,
        }
      );

    if (publicEventsError) {
      return NextResponse.json(
        {
          error:
            `Impossible de récupérer les événements publics expirés : ${publicEventsError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 2. Récupération des événements internes expirés
    // ---------------------------------------------------------
    const {
      data: internalEvents,
      error:
        internalEventsError,
    } = await admin
      .from(
        'internal_agenda_events'
      )
      .select(
        'id,title,event_date,image_url,published_on_site,site_event_id'
      )
      .lt(
        'event_date',
        today
      )
      .order(
        'event_date',
        {
          ascending: true,
        }
      );

    if (internalEventsError) {
      return NextResponse.json(
        {
          error:
            `Impossible de récupérer les événements internes expirés : ${internalEventsError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      today,
      publicEvents:
        publicEvents || [],
      internalEvents:
        internalEvents || [],
      counts: {
        public:
          publicEvents?.length ||
          0,
        internal:
          internalEvents?.length ||
          0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de préparer le nettoyage de l’agenda.',
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST() {
  const auth =
    await requireAgendaAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } =
    auth;

  try {
    /*
     * Un événement daté avant aujourd'hui est expiré.
     * Un événement daté aujourd'hui reste donc présent
     * jusqu'au prochain nettoyage.
     */
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    // ---------------------------------------------------------
    // 1. Récupération des événements publics expirés
    // ---------------------------------------------------------
    const {
      data: publicEvents,
      error:
        publicEventsError,
    } = await admin
      .from('events')
      .select(
        'id,title,date,image_url'
      )
      .lt(
        'date',
        today
      )
      .order(
        'date',
        {
          ascending: true,
        }
      );

    if (publicEventsError) {
      return NextResponse.json(
        {
          error:
            `Impossible de récupérer les événements publics expirés : ${publicEventsError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 2. Suppression des événements publics expirés
    // ---------------------------------------------------------
    const deletedPublic:
      string[] = [];

    const publicErrors:
      string[] = [];

    for (
      const event of
        publicEvents || []
    ) {
      const { error } =
        await admin
          .from('events')
          .delete()
          .eq(
            'id',
            event.id
          );

      if (error) {
        publicErrors.push(
          `${event.title} : ${error.message}`
        );

        continue;
      }

      deletedPublic.push(
        event.id
      );

      if (
        event.image_url
      ) {
        await deleteSupabaseImage(
          admin,
          event.image_url
        );
      }
    }

    // ---------------------------------------------------------
    // 3. Récupération des événements internes expirés
    // ---------------------------------------------------------
    const {
      data: internalEvents,
      error:
        internalEventsError,
    } = await admin
      .from(
        'internal_agenda_events'
      )
      .select(
        'id,title,event_date,image_url,published_on_site,site_event_id'
      )
      .lt(
        'event_date',
        today
      )
      .order(
        'event_date',
        {
          ascending: true,
        }
      );

    if (internalEventsError) {
      return NextResponse.json(
        {
          error:
            `Les événements publics ont été traités, mais impossible de récupérer les événements internes expirés : ${internalEventsError.message}`,

          deletedPublic,

          publicErrors,
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 4. Suppression des événements internes expirés
    // ---------------------------------------------------------
    const deletedInternal:
      string[] = [];

    const internalErrors:
      string[] = [];

    for (
      const event of
        internalEvents || []
    ) {
      const { error } =
        await admin
          .from(
            'internal_agenda_events'
          )
          .delete()
          .eq(
            'id',
            event.id
          );

      if (error) {
        internalErrors.push(
          `${event.title} : ${error.message}`
        );

        continue;
      }

      deletedInternal.push(
        event.id
      );

      if (
        event.image_url
      ) {
        await deleteSupabaseImage(
          admin,
          event.image_url
        );
      }
    }

    return NextResponse.json({
      ok:
        publicErrors.length ===
          0 &&
        internalErrors.length ===
          0,

      today,

      deleted: {
        public:
          deletedPublic.length,

        internal:
          deletedInternal.length,
      },

      publicErrors,

      internalErrors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de nettoyer automatiquement l’agenda.',
      },
      {
        status: 500,
      }
    );
  }
}
