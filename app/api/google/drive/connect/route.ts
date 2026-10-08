import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'

export async function GET(request: Request) {
  try {
    await requireOfficePermission('drive')
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'AUTHENTICATION_REQUIRED') {
        return NextResponse.redirect(
          new URL('/login', request.url)
        )
      }

      if (
        error.message === 'OFFICE_ACCESS_DENIED' ||
        error.message === 'OFFICE_PERMISSION_DENIED'
      ) {
        return NextResponse.json(
          {
            error: 'Compte non autorisé.',
          },
          { status: 403 }
        )
      }
    }

    console.error(
      'Erreur contrôle accès Google Drive:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Erreur de contrôle des accès.',
      },
      { status: 500 }
    )
  }

  try {
    const clientId =
      process.env.GOOGLE_CLIENT_ID

    if (!clientId) {
      return NextResponse.json(
        {
          error:
            'GOOGLE_CLIENT_ID est absent de la configuration.',
        },
        { status: 500 }
      )
    }

    const redirectUri =
      `${new URL(request.url).origin}` +
      '/api/google/drive/callback'

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope:
        'https://www.googleapis.com/auth/drive',
    })

    const googleUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.redirect(
      googleUrl
    )
  } catch (error) {
    console.error(
      'Erreur connexion Google Drive:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Impossible de démarrer la connexion Google Drive.',
      },
      { status: 500 }
    )
  }
}
