import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getExtensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/)

    return match?.[1]?.toLowerCase() || 'jpg'
  } catch {
    return 'jpg'
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  try {
    // ---------------------------------------------------------
    // Vérification de l'utilisateur connecté
    // ---------------------------------------------------------
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims()

    if (claimsError || !claimsData?.claims?.sub) {
      return NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      )
    }

    const userId = claimsData.claims.sub

    // ---------------------------------------------------------
    // Vérification administrateur
    // ---------------------------------------------------------
    const { data: adminUser, error: adminError } = await admin
      .from('gipe_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (adminError) {
      console.error(
        'Erreur vérification administrateur:',
        adminError
      )

      return NextResponse.json(
        {
          error:
            'Impossible de vérifier les droits administrateur.',
        },
        { status: 500 }
      )
    }

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Accès refusé.' },
        { status: 403 }
      )
    }

    // ---------------------------------------------------------
    // Lecture de la demande
    // ---------------------------------------------------------
    const body = await request.json()

    const id =
      typeof body?.id === 'string'
        ? body.id.trim()
        : ''

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Identifiant de l’événement manquant.',
        },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------
    // Récupération de l'événement interne
    // ---------------------------------------------------------
    const {
      data: internalEvent,
      error: internalError,
    } = await admin
      .from('internal_agenda_events')
      .select(`
        id,
        school_year_id,
        title,
        description,
        event_date,
        start_time,
        location,
        image_url,
        category,
        published_on_site,
        site_event_id
      `)
      .eq('id', id)
      .maybeSingle()

    if (internalError) {
      console.error(
        'Erreur récupération événement interne:',
        internalError
      )

      return NextResponse.json(
        {
          error:
            'Impossible de récupérer l’événement.',
        },
        { status: 500 }
      )
    }

    if (!internalEvent) {
      return NextResponse.json(
        {
          error: 'Événement introuvable.',
        },
        { status: 404 }
      )
    }

    // ---------------------------------------------------------
    // Éviter un double envoi
    // ---------------------------------------------------------
    if (
      internalEvent.published_on_site === true ||
      internalEvent.site_event_id
    ) {
      return NextResponse.json(
        {
          error:
            'Cet événement a déjà été envoyé sur le site.',
          siteEventId:
            internalEvent.site_event_id,
        },
        { status: 409 }
      )
    }

    // ---------------------------------------------------------
    // Copie de l'image vers l'Agenda public
    //
    // On crée une copie dans events/ afin que l'image
    // interne reste indépendante de l'image publique.
    // ---------------------------------------------------------
    let publicImageUrl: string | null = null
    let copiedImagePath: string | null = null

    if (internalEvent.image_url) {
      try {
        const imageResponse = await fetch(
          internalEvent.image_url
        )

        if (!imageResponse.ok) {
          throw new Error(
            `Téléchargement image impossible (${imageResponse.status})`
          )
        }

        const imageBuffer =
          await imageResponse.arrayBuffer()

        const contentType =
          imageResponse.headers.get(
            'content-type'
          ) || 'image/jpeg'

        const extension =
          getExtensionFromUrl(
            internalEvent.image_url
          )

        const imageId = crypto.randomUUID()

        copiedImagePath =
          `events/${imageId}.${extension}`

        const {
          error: uploadError,
        } = await admin.storage
          .from('images')
          .upload(
            copiedImagePath,
            imageBuffer,
            {
              contentType,
              upsert: false,
            }
          )

        if (uploadError) {
          throw uploadError
        }

        const {
          data: publicUrlData,
        } = admin.storage
          .from('images')
          .getPublicUrl(
            copiedImagePath
          )

        publicImageUrl =
          publicUrlData.publicUrl
      } catch (error) {
        console.error(
          'Erreur copie image Agenda interne → site:',
          error
        )

        return NextResponse.json(
          {
            error:
              'Impossible de copier l’image de l’événement vers le site.',
          },
          { status: 500 }
        )
      }
    }

    // ---------------------------------------------------------
    // Création de l'événement dans l'Agenda public
    //
    // ATTENTION :
    // La table events utilise "date" et "time",
    // contrairement à internal_agenda_events qui utilise
    // "event_date" et "start_time".
    // ---------------------------------------------------------
    const {
      data: publicEvent,
      error: publicEventError,
    } = await admin
      .from('events')
      .insert({
        title: internalEvent.title,
        description:
          internalEvent.description || null,
        date:
          internalEvent.event_date,
        time:
          internalEvent.start_time || null,
        location:
          internalEvent.location || null,
        image_url:
          publicImageUrl,
        category:
          internalEvent.category || null,
      })
      .select('id')
      .single()

    if (
      publicEventError ||
      !publicEvent
    ) {
      console.error(
        'Erreur création événement public:',
        publicEventError
      )

      // Nettoyage de l'image copiée
      if (copiedImagePath) {
        await admin.storage
          .from('images')
          .remove([
            copiedImagePath,
          ])
      }

      return NextResponse.json(
        {
          error:
            'Impossible de créer l’événement dans l’Agenda du site.',
          details:
            publicEventError?.message ||
            null,
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------
    // Marquage de l'événement interne comme envoyé
    // ---------------------------------------------------------
    const {
      error: updateError,
    } = await admin
      .from('internal_agenda_events')
      .update({
        published_on_site: true,
        site_event_id:
          publicEvent.id,
      })
      .eq(
        'id',
        internalEvent.id
      )

    if (updateError) {
      console.error(
        'Erreur mise à jour événement interne:',
        updateError
      )

      // Suppression de l'événement public
      await admin
        .from('events')
        .delete()
        .eq(
          'id',
          publicEvent.id
        )

      // Suppression de l'image copiée
      if (copiedImagePath) {
        await admin.storage
          .from('images')
          .remove([
            copiedImagePath,
          ])
      }

      return NextResponse.json(
        {
          error:
            'L’événement a été créé mais son marquage interne a échoué. L’opération a été annulée.',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------
    // Succès
    // ---------------------------------------------------------
    return NextResponse.json({
      success: true,
      siteEventId:
        publicEvent.id,
      message:
        'Événement envoyé sur le site.',
    })
  } catch (error) {
    console.error(
      'Erreur API /api/agenda/publish:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Une erreur inattendue est survenue.',
      },
      { status: 500 }
    )
  }
}
