import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ---------------------------------------------------------
  // Vercel Cron
  // ---------------------------------------------------------
  // Cette route possède sa propre protection avec CRON_SECRET.
  // Elle ne doit donc pas passer par l'authentification
  // normale du dashboard.
  if (
    pathname === '/api/agenda/cleanup-cron'
  ) {
    return NextResponse.next();
  }

  // ---------------------------------------------------------
  // Ressources Next.js et fichiers statiques
  // ---------------------------------------------------------
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }

  // ---------------------------------------------------------
  // APIs publiques utilisées par appconseils
  // ---------------------------------------------------------
  if (
    pathname === '/api/conseils/public' ||
    pathname === '/api/conseils/send-pdf'
  ) {
    return NextResponse.next();
  }

  // ---------------------------------------------------------
  // Page de connexion
  // ---------------------------------------------------------
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // ---------------------------------------------------------
  // Authentification normale du dashboard
  // ---------------------------------------------------------
  const {
    response,
    authenticated,
    admin,
  } = await updateSession(request);

  if (!authenticated || !admin) {
    const loginUrl =
      new URL(
        '/login',
        request.url
      );

    if (
      authenticated &&
      !admin
    ) {
      loginUrl.searchParams.set(
        'error',
        'unauthorized'
      );
    }

    loginUrl.searchParams.set(
      'next',
      pathname
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  return response;
}
