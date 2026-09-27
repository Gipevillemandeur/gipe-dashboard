import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Ressources Next.js et fichiers statiques :
  // ils ne doivent jamais être redirigés vers /login.
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }

  // APIs publiques utilisées par appconseils.
  if (
    pathname === '/api/conseils/public' ||
    pathname === '/api/conseils/send-pdf'
  ) {
    return NextResponse.next();
  }

  // Page de connexion.
  if (pathname === '/login') {
    return NextResponse.next();
  }

  const { response, authenticated, admin } = await updateSession(request);

  if (!authenticated || !admin) {
    const loginUrl = new URL('/login', request.url);

    if (authenticated && !admin) {
      loginUrl.searchParams.set('error', 'unauthorized');
    }

    loginUrl.searchParams.set('next', pathname);

    return NextResponse.redirect(loginUrl);
  }

  return response;
}
