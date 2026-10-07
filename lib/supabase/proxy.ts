import { createServerClient } from '@supabase/ssr';
import {
  type NextRequest,
  NextResponse,
} from 'next/server';

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(cookiesToSet) {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                request.cookies.set({
                  name,
                  value,
                  ...options,
                });
              }
            );

            supabaseResponse =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
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

  const { data } =
    await supabase.auth.getClaims();

  const userId =
    data?.claims?.sub;

  if (!userId) {
    return {
      response: supabaseResponse,
      authenticated: false,
      authorized: false,
      admin: false,
    };
  }

  /*
   * Les anciens administrateurs du dashboard
   * restent autorisés.
   */
  const { data: adminRow } =
    await supabase
      .from('gipe_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

  if (adminRow) {
    return {
      response: supabaseResponse,
      authenticated: true,
      authorized: true,
      admin: true,
    };
  }

  /*
   * Vérification des membres du bureau.
   *
   * La fonction SQL est SECURITY DEFINER :
   * elle peut donc consulter les tables du bureau
   * même si les politiques RLS de ces tables
   * restent réservées aux administrateurs historiques.
   */
  const { data: officeAccess, error } =
    await supabase.rpc(
      'get_my_office_access'
    );

  if (error) {
    console.error(
      'Erreur vérification accès bureau:',
      error
    );

    return {
      response: supabaseResponse,
      authenticated: true,
      authorized: false,
      admin: false,
    };
  }

  const hasOfficeAccess =
    Array.isArray(officeAccess) &&
    officeAccess.length > 0;

  return {
    response: supabaseResponse,
    authenticated: true,
    authorized: hasOfficeAccess,
    admin: false,
  };
}
