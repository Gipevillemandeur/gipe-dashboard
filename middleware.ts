import {
  type NextRequest,
  NextResponse,
} from 'next/server';

import { updateSession } from '@/lib/supabase/proxy';
import {
  firstAllowedPage,
  permissionForPage,
} from '@/lib/access-core';

/*
 * GARDE D'ENTRÉE DU SITE
 *
 * - Pages publiques : laissées passer.
 * - API : il faut être connecté ; chaque route vérifie
 *   ensuite elle-même les autorisations.
 * - Pages : il faut être connecté, autorisé, ET avoir
 *   l'autorisation correspondant à la page.
 */

const PUBLIC_PATHS = new Set([
  '/login',
  '/auth/callback',
  '/set-password',
  '/api/agenda/cleanup-cron',
  '/api/conseils/public',
  '/api/conseils/send-pdf',
  '/favicon.ico',
]);

const PUBLIC_PREFIXES = [
  '/_next/',
  '/images/',
  '/icons/',
];

export async function middleware(
  request: NextRequest
) {
  const pathname = request.nextUrl.pathname;

  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    )
  ) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith('/api/');

  const { response, access } = await updateSession(
    request,
    !isApi
  );

  if (!access.authenticated) {
    if (isApi) {
      return NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (isApi) {
    return response;
  }

  if (!access.authorized) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'unauthorized');

    return NextResponse.redirect(loginUrl);
  }

  const required = permissionForPage(pathname);

  if (
    required &&
    !access.permissions.includes(required)
  ) {
    const fallback = firstAllowedPage(
      access.permissions
    );

    if (fallback && fallback !== pathname) {
      return NextResponse.redirect(
        new URL(fallback, request.url)
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'unauthorized');

    return NextResponse.redirect(loginUrl);
  }

  return response;
}
