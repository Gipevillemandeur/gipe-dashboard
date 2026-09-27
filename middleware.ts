import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function middleware(request: NextRequest) {
  // APIs publiques utilisées par appconseils
  // Elles ne doivent pas être redirigées vers /login.
  if (
    request.nextUrl.pathname === '/api/conseils/public' ||
    request.nextUrl.pathname === '/api/conseils/send-pdf'
  ) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  const { response, authenticated, admin } = await updateSession(request);

  if (!authenticated || !admin) {
    const loginUrl = new URL('/login', request.url);

    if (authenticated && !admin) {
      loginUrl.searchParams.set('error', 'unauthorized');
    }

    loginUrl.searchParams.set('next', request.nextUrl.pathname);

    return NextResponse.redirect(loginUrl);
  }

  return response;
}