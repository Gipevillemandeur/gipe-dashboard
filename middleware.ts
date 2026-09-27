import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function middleware(request: NextRequest) {
  // API publique utilisée par appconseils
  // Elle ne doit pas être redirigée vers /login.
  if (request.nextUrl.pathname === '/api/conseils/public') {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  const { response, authenticated, admin } = await updateSession(request);

  if (!authenticated || !admin) {
    const loginUrl = new URL('/login', request.url);
    if (authenticated && !admin) loginUrl.searchParams.set('error', 'unauthorized');
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
