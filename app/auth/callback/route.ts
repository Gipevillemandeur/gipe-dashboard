import {
  type EmailOtpType,
} from '@supabase/supabase-js';
import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest
) {
  const { searchParams, origin } =
    new URL(request.url);

  const code =
    searchParams.get('code');

  const tokenHash =
    searchParams.get('token_hash');

  const typeParam =
    searchParams.get('type');

  let next =
    searchParams.get('next') || '/';

  if (
    !next.startsWith('/') ||
    next.startsWith('//')
  ) {
    next = '/';
  }

  const supabase =
    await createClient();

  /*
   * Flux PKCE classique.
   */
  if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(
        code
      );

    if (!error) {
      return NextResponse.redirect(
        `${origin}${next}`
      );
    }

    console.error(
      'Erreur échange code Supabase:',
      error
    );
  }

  /*
   * Flux email SSR :
   * invitation ou récupération de mot de passe.
   *
   * inviteUserByEmail() et les liens de
   * récupération utilisent un token_hash.
   */
  if (tokenHash) {
    const allowedTypes:
      | EmailOtpType[]
      = [
        'invite',
        'recovery',
      ];

    const type =
      allowedTypes.includes(
        typeParam as EmailOtpType
      )
        ? (typeParam as EmailOtpType)
        : null;

    if (type) {
      const { error } =
        await supabase.auth.verifyOtp({
          token_hash:
            tokenHash,
          type,
        });

      if (!error) {
        return NextResponse.redirect(
          `${origin}${next}`
        );
      }

      console.error(
        'Erreur vérification token Supabase:',
        error
      );
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=invite`
  );
}
