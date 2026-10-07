import {
  type NextRequest,
  NextResponse,
} from 'next/server';

import { updateSession } from '@/lib/supabase/proxy';

export async function middleware(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  if (
    pathname ===
    '/api/agenda/cleanup-cron'
  ) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }

  if (
    pathname ===
      '/api/conseils/public' ||
    pathname ===
      '/api/conseils/send-pdf'
  ) {
    return NextResponse.next();
  }

  if (
    pathname === '/login' ||
    pathname === '/auth/callback' ||
    pathname === '/set-password'
  ) {
    return NextResponse.next();
  }

  const {
    response,
    authenticated,
    authorized,
  } = await updateSession(
    request
  );

  if (
    !authenticated ||
    !authorized
  ) {
    const loginUrl =
      new URL(
        '/login',
        request.url
      );

    if (
      authenticated &&
      !authorized
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
