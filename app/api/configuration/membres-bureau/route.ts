import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAuthenticatedClient() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
    };
  }

  const { data: admin, error: adminError } =
    await supabase
      .from('gipe_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

  if (adminError || !admin) {
    return {
      supabase,
      user: null,
    };
  }

  return {
    supabase,
    user,
  };
}

export async function GET() {
  try {
    const { supabase, user } =
      await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { error: 'Accès non autorisé.' },
        { status: 401 }
      );
    }

    const [
      positionsResult,
      permissionsResult,
      membersResult,
      linksResult,
      superAdminResult,
    ] = await Promise.all([
      supabase
        .from('office_positions')
        .select(
          'id, name, is_default, active'
        )
        .eq('active', true)
        .order('is_default', {
          ascending: false,
        })
        .order('name', {
          ascending: true,
        }),

      supabase
        .from('office_permissions')
        .select(
          'id, code, label'
        )
        .order('label', {
          ascending: true,
        }),

      supabase
        .from('office_position_members')
        .select(
          'position_id, email, active'
        )
        .eq('active', true),

      supabase
        .from('office_position_permissions')
        .select(
          'position_id, permission_id'
        ),

      supabase
        .from('office_super_admin')
        .select(
          'email, active'
        )
        .eq('active', true)
        .maybeSingle(),
    ]);

    const firstError =
      positionsResult.error ||
      permissionsResult.error ||
      membersResult.error ||
      linksResult.error ||
      superAdminResult.error;

    if (firstError) {
      console.error(
        'Erreur chargement membres du bureau:',
        firstError
      );

      return NextResponse.json(
        {
          error:
            'Impossible de charger la configuration du bureau.',
        },
        { status: 500 }
      );
    }

    const positions =
      positionsResult.data || [];
    const permissions =
      permissionsResult.data || [];
    const members =
      membersResult.data || [];
    const links =
      linksResult.data || [];

    const memberByPosition =
      new Map(
        members.map((member) => [
          member.position_id,
          member,
        ])
      );

    const permissionIdToCode =
      new Map(
        permissions.map((permission) => [
          permission.id,
          permission.code,
        ])
      );

    const permissionCodesByPosition =
      new Map<string, string[]>();

    for (const link of links) {
      const code =
        permissionIdToCode.get(
          link.permission_id
        );

      if (!code) continue;

      const current =
        permissionCodesByPosition.get(
          link.position_id
        ) || [];

      current.push(code);

      permissionCodesByPosition.set(
        link.position_id,
        current
      );
    }

    return NextResponse.json({
      positions: positions.map(
        (position) => {
          const member =
            memberByPosition.get(
              position.id
            );

          return {
            ...position,
            email:
              member?.email || null,
            permissions:
              permissionCodesByPosition.get(
                position.id
              ) || [],
          };
        }
      ),
      permissions,
      superAdminEmail:
        superAdminResult.data?.email ||
        null,
    });
  } catch (error) {
    console.error(
      'Erreur API membres du bureau:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Une erreur est survenue.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request
) {
  try {
    const { supabase, user } =
      await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { error: 'Accès non autorisé.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const type = body?.type;

    if (type === 'super-admin') {
      const email =
        typeof body.email === 'string' &&
        body.email.trim()
          ? body.email.trim().toLowerCase()
          : null;

      const { data: existing } =
        await supabase
          .from('office_super_admin')
          .select('id')
          .eq('active', true)
          .maybeSingle();

      if (existing) {
        const { error } =
          await supabase
            .from('office_super_admin')
            .update({
              email,
              updated_at:
                new Date().toISOString(),
            })
            .eq('id', existing.id);

        if (error) {
          console.error(
            'Erreur mise à jour SUPER ADMIN:',
            error
          );

          return NextResponse.json(
            {
              error:
                'Impossible d’enregistrer le compte SUPER ADMIN.',
            },
            { status: 500 }
          );
        }
      } else {
        const { error } =
          await supabase
            .from('office_super_admin')
            .insert({
              email,
              active: true,
            });

        if (error) {
          console.error(
            'Erreur création SUPER ADMIN:',
            error
          );

          return NextResponse.json(
            {
              error:
                'Impossible de créer le compte SUPER ADMIN.',
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
      });
    }

    if (type !== 'position') {
      return NextResponse.json(
        {
          error:
            'Type de modification invalide.',
        },
        { status: 400 }
      );
    }

    const positionId =
      typeof body.positionId === 'string'
        ? body.positionId
        : '';

    if (!positionId) {
      return NextResponse.json(
        {
          error:
            'Le poste est obligatoire.',
        },
        { status: 400 }
      );
    }

    const email =
      typeof body.email === 'string' &&
      body.email.trim()
        ? body.email.trim().toLowerCase()
        : null;

    const requestedPermissions =
      Array.isArray(body.permissions)
        ? body.permissions.filter(
            (item: unknown): item is string =>
              typeof item === 'string'
          )
        : [];

    const { data: position } =
      await supabase
        .from('office_positions')
        .select(
          'id, name, active'
        )
        .eq('id', positionId)
        .maybeSingle();

    if (!position || !position.active) {
      return NextResponse.json(
        {
          error:
            'Poste introuvable.',
        },
        { status: 404 }
      );
    }

    const { data: validPermissions } =
      await supabase
        .from('office_permissions')
        .select(
          'id, code'
        )
        .in(
          'code',
          requestedPermissions
        );

    const permissionRows =
      validPermissions || [];

    const { data: existingMember } =
      await supabase
        .from('office_position_members')
        .select('id, email')
        .eq('position_id', positionId)
        .eq('active', true)
        .maybeSingle();

    const currentEmail =
      existingMember?.email
        ?.trim()
        .toLowerCase() || null;

    if (existingMember) {
      if (currentEmail !== email) {
        const { error: deactivateError } =
          await supabase
            .from('office_position_members')
            .update({
              active: false,
              deactivated_at:
                new Date().toISOString(),
              updated_at:
                new Date().toISOString(),
            })
            .eq('id', existingMember.id);

        if (deactivateError) {
          console.error(
            'Erreur désactivation ancien titulaire:',
            deactivateError
          );

          return NextResponse.json(
            {
              error:
                'Impossible de désactiver l’ancien titulaire.',
            },
            { status: 500 }
          );
        }

        if (email) {
          const { error: insertError } =
            await supabase
              .from('office_position_members')
              .insert({
                position_id: positionId,
                email,
                active: true,
                assigned_at:
                  new Date().toISOString(),
                deactivated_at: null,
              });

          if (insertError) {
            console.error(
              'Erreur création nouveau titulaire:',
              insertError
            );

            return NextResponse.json(
              {
                error:
                  'Impossible d’enregistrer le nouveau titulaire.',
              },
              { status: 500 }
            );
          }
        }
      }
    } else if (email) {
      const { error: insertError } =
        await supabase
          .from('office_position_members')
          .insert({
            position_id: positionId,
            email,
            active: true,
            assigned_at:
              new Date().toISOString(),
            deactivated_at: null,
          });

      if (insertError) {
        console.error(
          'Erreur création titulaire:',
          insertError
        );

        return NextResponse.json(
          {
            error:
              'Impossible d’enregistrer le titulaire.',
          },
          { status: 500 }
        );
      }
    }

    const { error: deleteLinksError } =
      await supabase
        .from('office_position_permissions')
        .delete()
        .eq(
          'position_id',
          positionId
        );

    if (deleteLinksError) {
      console.error(
        'Erreur suppression permissions:',
        deleteLinksError
      );

      return NextResponse.json(
        {
          error:
            'Impossible de mettre à jour les permissions.',
        },
        { status: 500 }
      );
    }

    if (permissionRows.length > 0) {
      const rows =
        permissionRows.map(
          (permission) => ({
            position_id: positionId,
            permission_id:
              permission.id,
          })
        );

      const { error: insertLinksError } =
        await supabase
          .from('office_position_permissions')
          .insert(rows);

      if (insertLinksError) {
        console.error(
          'Erreur ajout permissions:',
          insertLinksError
        );

        return NextResponse.json(
          {
            error:
              'Impossible d’enregistrer les permissions.',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      'Erreur PUT membres du bureau:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Une erreur est survenue.',
      },
      { status: 500 }
    );
  }
}
