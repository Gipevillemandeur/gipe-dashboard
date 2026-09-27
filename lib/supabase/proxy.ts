import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    request.cookies.set({ name, value, ...options });
  });

  supabaseResponse = NextResponse.next({ request });

  cookiesToSet.forEach(({ name, value, options }) => {
    supabaseResponse.cookies.set(name, value, options);
  });
},
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return { response: supabaseResponse, authenticated: false, admin: false };
  }

  // RLS on gipe_admins permits an authenticated user to read only their own row.
  const { data: adminRow } = await supabase
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    response: supabaseResponse,
    authenticated: true,
    admin: Boolean(adminRow),
  };
}
