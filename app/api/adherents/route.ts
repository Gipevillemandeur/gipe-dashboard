import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();

  const { data: authData } =
    await supabase.auth.getClaims();

  const userId = authData?.claims?.sub;

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('gipe_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        {
          error:
            'Impossible de vérifier les droits administrateur.',
        },
        { status: 500 }
      ),
    };
  }

  if (!data) {
    return {
      error: NextResponse.json(
        { error: 'Compte non autorisé.' },
        { status: 403 }
      ),
    };
  }

  return { admin };
}


function isValidCouncilParticipation(value: string) {
  return [
    'no',
    'child_class',
    'all_classes',
  ].includes(value);
}


function isValidPaymentMethod(value: string) {
  return [
    'cheque',
    'cash',
    'transfer',
    'online',
    'other',
  ].includes(value);
}


function cleanNullableString(value: unknown) {
  const result = String(value || '').trim();
  return result || null;
}


export async function GET() {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const { data: year, error: yearError } =
    await admin
      .from('school_years')
      .select('id,label')
      .eq('is_active', true)
      .maybeSingle();

  if (yearError) {
    return NextResponse.json(
      { error: yearError.message },
      { status: 500 }
    );
  }

  if (!year) {
    return NextResponse.json({
      schoolYear: null,
      total: 0,
      byClass: [],
      members: [],
    });
  }

  const { data: memberships, error } =
    await admin
      .from('gipe_memberships')
      .select(`
        id,
        adherent_id,
        renewal,
        council_participation,
        board_member,
        ca_member,
        payment_received,
        payment_date,
        payment_method,
        cheque_number,
        amount,
        gipe_adherents (
          id,
          last_name,
          first_name,
          address,
          phone,
          email
        ),
        gipe_membership_children (
          id,
          gipe_children (
            id,
            last_name,
            first_name
          ),
          classes (
            id,
            name
          )
        )
      `)
      .eq('school_year_id', year.id)
      .order('created_at', {
        ascending: false,
      });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const members = (memberships || []).map(
    (membership: any) => ({
      id: membership.id,
      adherentId: membership.adherent_id,

      lastName:
        membership.gipe_adherents?.last_name || '',

      firstName:
        membership.gipe_adherents?.first_name || '',

      address:
        membership.gipe_adherents?.address || '',

      phone:
        membership.gipe_adherents?.phone || '',

      email:
        membership.gipe_adherents?.email || '',

      renewal:
        membership.renewal,

      councilParticipation:
        membership.council_participation,

      boardMember:
        membership.board_member,

      caMember:
        membership.ca_member,

      paymentReceived:
        membership.payment_received,

      paymentDate:
        membership.payment_date,

      paymentMethod:
        membership.payment_method,

      chequeNumber:
        membership.cheque_number,

      amount:
        membership.amount,

      children:
        (membership.gipe_membership_children || []).map(
          (link: any) => ({
            id: link.gipe_children?.id,
            lastName:
              link.gipe_children?.last_name || '',
            firstName:
              link.gipe_children?.first_name || '',
            classId:
              link.classes?.id || '',
            className:
              link.classes?.name || '',
          })
        ),
    })
  );

  const classCounts: Record<string, number> = {};

  for (const member of members) {
    for (const child of member.children) {
      if (!child.className) continue;

      classCounts[child.className] =
        (classCounts[child.className] || 0) + 1;
    }
  }

  const byClass = Object.entries(classCounts)
    .map(([className, count]) => ({
      className,
      count,
    }))
    .sort((a, b) =>
      a.className.localeCompare(
        b.className,
        'fr',
        { numeric: true }
      )
    );

  return NextResponse.json({
    schoolYear: year.label,
    total: members.length,
    byClass,
    members,
  });
}


export async function POST(request: Request) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const body = await request
    .json()
    .catch(() => null) as any;

  if (!body) {
    return NextResponse.json(
      { error: 'Données invalides.' },
      { status: 400 }
    );
  }

  const {
    lastName,
    firstName,
    address,
    phone,
    email,
    renewal,
    councilParticipation,
    boardMember,
    caMember,
    paymentReceived,
    paymentDate,
    paymentMethod,
    chequeNumber,
    amount,
    children,
  } = body;

  if (
    !String(lastName || '').trim() ||
    !String(firstName || '').trim()
  ) {
    return NextResponse.json(
      {
        error:
          'Le nom et le prénom sont obligatoires.',
      },
      { status: 400 }
    );
  }

  if (
    !isValidCouncilParticipation(
      councilParticipation || 'no'
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Choix de participation aux conseils invalide.',
      },
      { status: 400 }
    );
  }

  if (
    paymentMethod &&
    !isValidPaymentMethod(paymentMethod)
  ) {
    return NextResponse.json(
      {
        error: 'Mode de paiement invalide.',
      },
      { status: 400 }
    );
  }

  if (
    chequeNumber &&
    paymentMethod !== 'cheque'
  ) {
    return NextResponse.json(
      {
        error:
          'Le numéro de chèque nécessite un paiement par chèque.',
      },
      { status: 400 }
    );
  }

  const { data: year, error: yearError } =
    await admin
      .from('school_years')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

  if (yearError || !year) {
    return NextResponse.json(
      {
        error:
          yearError?.message ||
          'Aucune année scolaire active.',
      },
      { status: 409 }
    );
  }

  const { data: adherent, error: adherentError } =
    await admin
      .from('gipe_adherents')
      .insert({
        last_name:
          String(lastName).trim(),

        first_name:
          String(firstName).trim(),

        address:
          cleanNullableString(address),

        phone:
          cleanNullableString(phone),

        email:
          cleanNullableString(email),
      })
      .select('id')
      .single();

  if (adherentError || !adherent) {
    return NextResponse.json(
      {
        error:
          adherentError?.message ||
          'Impossible de créer l’adhérent.',
      },
      { status: 500 }
    );
  }

  const { data: membership, error: membershipError } =
    await admin
      .from('gipe_memberships')
      .insert({
        adherent_id: adherent.id,
        school_year_id: year.id,

        renewal:
          Boolean(renewal),

        council_participation:
          councilParticipation || 'no',

        board_member:
          Boolean(boardMember),

        ca_member:
          Boolean(caMember),

        payment_received:
          Boolean(paymentReceived),

        payment_date:
          paymentDate || null,

        payment_method:
          paymentMethod || null,

        cheque_number:
          chequeNumber || null,

        amount:
          amount === '' ||
          amount === null ||
          amount === undefined
            ? null
            : Number(amount),
      })
      .select('id')
      .single();

  if (membershipError || !membership) {
    await admin
      .from('gipe_adherents')
      .delete()
      .eq('id', adherent.id);

    return NextResponse.json(
      {
        error:
          membershipError?.message ||
          'Impossible de créer l’adhésion.',
      },
      { status: 500 }
    );
  }

  const childList =
    Array.isArray(children)
      ? children
      : [];

  for (const child of childList) {
    if (
      !String(child.lastName || '').trim() ||
      !String(child.firstName || '').trim()
    ) {
      continue;
    }

    const { data: createdChild, error: childError } =
      await admin
        .from('gipe_children')
        .insert({
          last_name:
            String(child.lastName).trim(),

          first_name:
            String(child.firstName).trim(),
        })
        .select('id')
        .single();

    if (childError || !createdChild) {
      return NextResponse.json(
        {
          error:
            childError?.message ||
            'Impossible de créer un enfant.',
        },
        { status: 500 }
      );
    }

    const { error: linkError } =
      await admin
        .from('gipe_membership_children')
        .insert({
          membership_id:
            membership.id,

          child_id:
            createdChild.id,

          class_id:
            child.classId || null,
        });

    if (linkError) {
      return NextResponse.json(
        {
          error:
            linkError.message,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    {
      success: true,
      membershipId:
        membership.id,
    },
    { status: 201 }
  );
}


export async function PUT(request: Request) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const body = await request
    .json()
    .catch(() => null) as any;

  if (!body) {
    return NextResponse.json(
      { error: 'Données invalides.' },
      { status: 400 }
    );
  }

  const {
    id,
    lastName,
    firstName,
    address,
    phone,
    email,
    renewal,
    councilParticipation,
    boardMember,
    caMember,
    paymentReceived,
    paymentDate,
    paymentMethod,
    chequeNumber,
    amount,
    children,
  } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Adhérent introuvable.' },
      { status: 400 }
    );
  }

  if (
    !String(lastName || '').trim() ||
    !String(firstName || '').trim()
  ) {
    return NextResponse.json(
      {
        error:
          'Le nom et le prénom sont obligatoires.',
      },
      { status: 400 }
    );
  }

  if (
    !isValidCouncilParticipation(
      councilParticipation || 'no'
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Choix de participation aux conseils invalide.',
      },
      { status: 400 }
    );
  }

  if (
    paymentMethod &&
    !isValidPaymentMethod(paymentMethod)
  ) {
    return NextResponse.json(
      {
        error: 'Mode de paiement invalide.',
      },
      { status: 400 }
    );
  }

  if (
    chequeNumber &&
    paymentMethod !== 'cheque'
  ) {
    return NextResponse.json(
      {
        error:
          'Le numéro de chèque nécessite un paiement par chèque.',
      },
      { status: 400 }
    );
  }

  const { data: year, error: yearError } =
    await admin
      .from('school_years')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

  if (yearError || !year) {
    return NextResponse.json(
      {
        error:
          yearError?.message ||
          'Aucune année scolaire active.',
      },
      { status: 409 }
    );
  }

  const { data: membership, error: membershipError } =
    await admin
      .from('gipe_memberships')
      .select(`
        id,
        adherent_id
      `)
      .eq('id', id)
      .eq('school_year_id', year.id)
      .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      {
        error:
          membershipError?.message ||
          'Adhésion introuvable pour cette année scolaire.',
      },
      { status: 404 }
    );
  }

  const { error: adherentError } =
    await admin
      .from('gipe_adherents')
      .update({
        last_name:
          String(lastName).trim(),

        first_name:
          String(firstName).trim(),

        address:
          cleanNullableString(address),

        phone:
          cleanNullableString(phone),

        email:
          cleanNullableString(email),

        updated_at:
          new Date().toISOString(),
      })
      .eq('id', membership.adherent_id);

  if (adherentError) {
    return NextResponse.json(
      {
        error:
          adherentError.message,
      },
      { status: 500 }
    );
  }

  const { error: updateMembershipError } =
    await admin
      .from('gipe_memberships')
      .update({
        renewal:
          Boolean(renewal),

        council_participation:
          councilParticipation || 'no',

        board_member:
          Boolean(boardMember),

        ca_member:
          Boolean(caMember),

        payment_received:
          Boolean(paymentReceived),

        payment_date:
          paymentDate || null,

        payment_method:
          paymentMethod || null,

        cheque_number:
          chequeNumber || null,

        amount:
          amount === '' ||
          amount === null ||
          amount === undefined
            ? null
            : Number(amount),

        updated_at:
          new Date().toISOString(),
      })
      .eq('id', membership.id);

  if (updateMembershipError) {
    return NextResponse.json(
      {
        error:
          updateMembershipError.message,
      },
      { status: 500 }
    );
  }

  /*
   * On reconstruit les liens enfants de cette adhésion.
   * Les anciennes lignes enfants ne sont pas supprimées
   * de gipe_children afin de ne pas casser d'éventuels
   * liens historiques.
   */
  const { error: deleteLinksError } =
    await admin
      .from('gipe_membership_children')
      .delete()
      .eq('membership_id', membership.id);

  if (deleteLinksError) {
    return NextResponse.json(
      {
        error:
          deleteLinksError.message,
      },
      { status: 500 }
    );
  }

  const childList =
    Array.isArray(children)
      ? children
      : [];

  for (const child of childList) {
    if (
      !String(child.lastName || '').trim() ||
      !String(child.firstName || '').trim()
    ) {
      continue;
    }

    let childId =
      String(child.id || '').trim();

    if (childId) {
      const { error: childUpdateError } =
        await admin
          .from('gipe_children')
          .update({
            last_name:
              String(child.lastName).trim(),

            first_name:
              String(child.firstName).trim(),

            updated_at:
              new Date().toISOString(),
          })
          .eq('id', childId);

      if (childUpdateError) {
        return NextResponse.json(
          {
            error:
              childUpdateError.message,
          },
          { status: 500 }
        );
      }
    } else {
      const { data: createdChild, error: childError } =
        await admin
          .from('gipe_children')
          .insert({
            last_name:
              String(child.lastName).trim(),

            first_name:
              String(child.firstName).trim(),
          })
          .select('id')
          .single();

      if (childError || !createdChild) {
        return NextResponse.json(
          {
            error:
              childError?.message ||
              'Impossible de créer un enfant.',
          },
          { status: 500 }
        );
      }

      childId = createdChild.id;
    }

    const { error: linkError } =
      await admin
        .from('gipe_membership_children')
        .insert({
          membership_id:
            membership.id,

          child_id:
            childId,

          class_id:
            child.classId || null,
        });

    if (linkError) {
      return NextResponse.json(
        {
          error:
            linkError.message,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    membershipId:
      membership.id,
  });
}
