import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import {
  type NextRequest,
  NextResponse,
} from 'next/server';

import {
  anonymousAccess,
  resolveOfficeAccess,
  type OfficeAccess,
} from '@/lib/access-core';

/*
 * Rafraîchit la session (cookies) et calcule les droits
 * de la personne connectée, avec les mêmes règles que
 * le reste du site (lib/access-core.ts).
 *
 * `withAccess = false` : on vérifie seulement que la
 * personne est connectée (utilisé pour l'API, dont
 * chaque route vérifie elle-même les autorisations).
 */
export async function updateSession(
  request: NextRequest,
  withAccess = true
): Promise<{
  response: NextResponse;
  access: OfficeAccess;
}> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              supabaseResponse.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) {
    return {
      response: supabaseResponse,
      access: anonymousAccess(),
    };
  }

  const email =
    typeof data?.claims?.email === 'string'
      ? data.claims.email
      : null;

  if (!withAccess) {
    return {
      response: supabaseResponse,
      access: {
        ...anonymousAccess(),
        authenticated: true,
        userId,
        email,
      },
    };
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const access = await resolveOfficeAccess(
    admin,
    userId,
    email
  );

  return {
    response: supabaseResponse,
    access,
  };
}
