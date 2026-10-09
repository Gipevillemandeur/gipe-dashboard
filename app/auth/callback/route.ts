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

    /*
     * On ne « consomme » PAS le lien ici.
     *
     * Les messageries (Hotmail, Outlook…) ouvrent
     * parfois les liens toutes seules pour les
     * vérifier. Le lien est donc transmis tel quel
     * à la page /set-password, qui ne l'utilise
     * qu'au clic sur « Créer mon mot de passe ».
     */
    if (type) {
      const target =
        new URL(
          '/set-password',
          origin
        );

      target.searchParams.set(
        'token_hash',
        tokenHash
      );

      target.searchParams.set(
        'type',
        type
      );

      return NextResponse.redirect(
        target
      );
    }
  }

  /*
   * Lien d'invitation ou de réinitialisation
   * « classique » de Supabase : la session arrive
   * après le # de l'adresse, que le serveur ne voit
   * pas. On envoie donc vers /set-password : le
   * navigateur conserve automatiquement la partie
   * après le #, et la page s'occupe de la lire.
   */
  if (next === '/set-password') {
    return NextResponse.redirect(
      `${origin}/set-password`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=invite`
  );
}
