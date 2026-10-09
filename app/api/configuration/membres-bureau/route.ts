import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOfficePermission } from '@/lib/office-auth'
import { isPresidentName } from '@/lib/access-core'

const APP_URL = 'https://admin.gipevillemandeur.com'

async function requireConfigurationAccess() {
  try {
    const access =
      await requireOfficePermission('office_members')

    return {
      access,
    }
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        'AUTHENTICATION_REQUIRED'
      ) {
        return {
          error: NextResponse.json(
            {
              error:
                'Non authentifié.',
            },
            { status: 401 }
          ),
        }
      }

      if (
        error.message ===
          'OFFICE_ACCESS_DENIED' ||
        error.message ===
          'OFFICE_PERMISSION_DENIED'
      ) {
        return {
          error: NextResponse.json(
            {
              error:
                'Compte non autorisé.',
            },
            { status: 403 }
          ),
        }
      }
    }

    console.error(
      'Erreur contrôle accès configuration :',
      error
    )

    return {
      error: NextResponse.json(
        {
          error:
            'Erreur de contrôle des accès.',
        },
        { status: 500 }
      ),
    }
  }
}

export async function GET() {
  try {
    const auth =
      await requireConfigurationAccess()

    if ('error' in auth) {
      return auth.error
    }

    const supabase =
      createAdminClient()

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
    ])

    const firstError =
      positionsResult.error ||
      permissionsResult.error ||
      membersResult.error ||
      linksResult.error ||
      superAdminResult.error

    if (firstError) {
      console.error(
        'Erreur chargement membres du bureau:',
        firstError
      )

      return NextResponse.json(
        {
          error:
            'Impossible de charger la configuration du bureau.',
        },
        { status: 500 }
      )
    }

    const positions =
      positionsResult.data || []

    const permissions =
      permissionsResult.data || []

    const members =
      membersResult.data || []

    const links =
      linksResult.data || []

    const memberByPosition =
      new Map(
        members.map((member) => [
          member.position_id,
          member,
        ])
      )

    const permissionIdToCode =
      new Map(
        permissions.map(
          (permission) => [
            permission.id,
            permission.code,
          ]
        )
      )

    const permissionCodesByPosition =
      new Map<string, string[]>()

    for (const link of links) {
      const code =
        permissionIdToCode.get(
          link.permission_id
        )

      if (!code) continue

      const current =
        permissionCodesByPosition.get(
          link.position_id
        ) || []

      current.push(code)

      permissionCodesByPosition.set(
        link.position_id,
        current
      )
    }

    return NextResponse.json({
      positions:
        positions.map(
          (position) => {
            const member =
              memberByPosition.get(
                position.id
              )

            return {
              ...position,
              email:
                member?.email || null,
              permissions:
                permissionCodesByPosition.get(
                  position.id
                ) || [],
            }
          }
        ),
      permissions,
      superAdminEmail:
        superAdminResult.data
          ?.email || null,
    })
  } catch (error) {
    console.error(
      'Erreur API membres du bureau:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Une erreur est survenue.',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request
) {
  try {
    const auth =
      await requireConfigurationAccess()

    if ('error' in auth) {
      return auth.error
    }

    const supabase =
      createAdminClient()

    const body =
      await request.json()

    const type =
      body?.type

    /*
     * Le compte SUPER ADMIN est intouchable depuis
     * le dashboard : il se modifie uniquement dans
     * Supabase (table office_super_admin).
     */
    if (type === 'super-admin') {
      return NextResponse.json(
        {
          error:
            'Le compte SUPER ADMIN ne peut pas être modifié depuis le dashboard.',
        },
        { status: 403 }
      )
    }

    if (type !== 'position') {
      return NextResponse.json(
        {
          error:
            'Type de modification invalide.',
        },
        { status: 400 }
      )
    }

    const positionId =
      typeof body.positionId ===
      'string'
        ? body.positionId
        : ''

    if (!positionId) {
      return NextResponse.json(
        {
          error:
            'Le poste est obligatoire.',
        },
        { status: 400 }
      )
    }

    const email =
      typeof body.email ===
        'string' &&
      body.email.trim()
        ? body.email
            .trim()
            .toLowerCase()
        : null

    const requestedPermissions =
      Array.isArray(
        body.permissions
      )
        ? body.permissions.filter(
            (
              item: unknown
            ): item is string =>
              typeof item ===
              'string'
          )
        : []

    const {
      data: position,
    } =
      await supabase
        .from('office_positions')
        .select(
          'id, name, active'
        )
        .eq(
          'id',
          positionId
        )
        .maybeSingle()

    if (
      !position ||
      !position.active
    ) {
      return NextResponse.json(
        {
          error:
            'Poste introuvable.',
        },
        { status: 404 }
      )
    }

    /*
     * Seuls le SUPER ADMIN et le Président peuvent
     * modifier ou inviter le poste de Président.
     */
    if (
      isPresidentName(position.name) &&
      !auth.access.isSuperAdmin &&
      !auth.access.isPresident
    ) {
      return NextResponse.json(
        {
          error:
            'Seul le Président (ou le SUPER ADMIN) peut modifier ce poste.',
        },
        { status: 403 }
      )
    }


    const {
      data: validPermissions,
    } =
      await supabase
        .from(
          'office_permissions'
        )
        .select(
          'id, code'
        )
        .in(
          'code',
          requestedPermissions
        )

    const permissionRows =
      validPermissions || []

    const {
      data: existingMember,
    } =
      await supabase
        .from(
          'office_position_members'
        )
        .select(
          'id, email'
        )
        .eq(
          'position_id',
          positionId
        )
        .eq(
          'active',
          true
        )
        .maybeSingle()

    const currentEmail =
      existingMember?.email
        ?.trim()
        .toLowerCase() ||
      null

    if (existingMember) {
      if (
        currentEmail !==
        email
      ) {
        const {
          error:
            deactivateError,
        } =
          await supabase
            .from(
              'office_position_members'
            )
            .update({
              active: false,
              deactivated_at:
                new Date().toISOString(),
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              existingMember.id
            )

        if (deactivateError) {
          console.error(
            'Erreur désactivation ancien titulaire:',
            deactivateError
          )

          return NextResponse.json(
            {
              error:
                'Impossible de désactiver l’ancien titulaire.',
            },
            { status: 500 }
          )
        }

        if (email) {
          const {
            error:
              insertError,
          } =
            await supabase
              .from(
                'office_position_members'
              )
              .insert({
                position_id:
                  positionId,
                email,
                active: true,
                assigned_at:
                  new Date().toISOString(),
                deactivated_at:
                  null,
              })

          if (insertError) {
            console.error(
              'Erreur création nouveau titulaire:',
              insertError
            )

            return NextResponse.json(
              {
                error:
                  'Impossible d’enregistrer le nouveau titulaire.',
              },
              { status: 500 }
            )
          }
        }
      }
    } else if (email) {
      const {
        error:
          insertError,
      } =
        await supabase
          .from(
            'office_position_members'
          )
          .insert({
            position_id:
              positionId,
            email,
            active: true,
            assigned_at:
              new Date().toISOString(),
            deactivated_at:
              null,
          })

      if (insertError) {
        console.error(
          'Erreur création titulaire:',
          insertError
        )

        return NextResponse.json(
          {
            error:
              'Impossible d’enregistrer le titulaire.',
          },
          { status: 500 }
        )
      }
    }

    const {
      error:
        deleteLinksError,
    } =
      await supabase
        .from(
          'office_position_permissions'
        )
        .delete()
        .eq(
          'position_id',
          positionId
        )

    if (deleteLinksError) {
      console.error(
        'Erreur suppression permissions:',
        deleteLinksError
      )

      return NextResponse.json(
        {
          error:
            'Impossible de mettre à jour les permissions.',
        },
        { status: 500 }
      )
    }

    if (
      permissionRows.length >
      0
    ) {
      const rows =
        permissionRows.map(
          (permission) => ({
            position_id:
              positionId,
            permission_id:
              permission.id,
          })
        )

      const {
        error:
          insertLinksError,
      } =
        await supabase
          .from(
            'office_position_permissions'
          )
          .insert(rows)

      if (insertLinksError) {
        console.error(
          'Erreur ajout permissions:',
          insertLinksError
        )

        return NextResponse.json(
          {
            error:
              'Impossible d’enregistrer les permissions.',
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error(
      'Erreur PUT membres du bureau:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Une erreur est survenue.',
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request
) {
  try {
    const auth =
      await requireConfigurationAccess()

    if ('error' in auth) {
      return auth.error
    }

    const adminClient =
      createAdminClient()

    const body =
      await request.json()

    const positionId =
      typeof body?.positionId ===
      'string'
        ? body.positionId
        : ''

    if (!positionId) {
      return NextResponse.json(
        {
          error:
            'Le poste est obligatoire.',
        },
        { status: 400 }
      )
    }

    const {
      data: position,
      error:
        positionError,
    } =
      await adminClient
        .from(
          'office_positions'
        )
        .select(
          'id, name, active'
        )
        .eq(
          'id',
          positionId
        )
        .maybeSingle()

    if (
      positionError ||
      !position ||
      !position.active
    ) {
      return NextResponse.json(
        {
          error:
            'Poste introuvable.',
        },
        { status: 404 }
      )
    }

    /*
     * Seuls le SUPER ADMIN et le Président peuvent
     * modifier ou inviter le poste de Président.
     */
    if (
      isPresidentName(position.name) &&
      !auth.access.isSuperAdmin &&
      !auth.access.isPresident
    ) {
      return NextResponse.json(
        {
          error:
            'Seul le Président (ou le SUPER ADMIN) peut modifier ce poste.',
        },
        { status: 403 }
      )
    }


    const {
      data: member,
      error:
        memberError,
    } =
      await adminClient
        .from(
          'office_position_members'
        )
        .select(
          'id, email, active, user_id'
        )
        .eq(
          'position_id',
          positionId
        )
        .eq(
          'active',
          true
        )
        .maybeSingle()

    if (memberError) {
      console.error(
        'Erreur recherche titulaire:',
        memberError
      )

      return NextResponse.json(
        {
          error:
            'Impossible de retrouver le titulaire.',
        },
        { status: 500 }
      )
    }

    if (!member?.email) {
      return NextResponse.json(
        {
          error:
            'Aucune adresse e-mail n’est renseignée pour ce poste.',
        },
        { status: 400 }
      )
    }

    const email =
      member.email
        .trim()
        .toLowerCase()

    const redirectTo =
      `${APP_URL}/auth/callback?next=/set-password`

    let existingUser:
      | {
          id: string
          email?:
            | string
            | null
        }
      | null = null

    let page = 1
    const perPage = 1000

    while (!existingUser) {
      const {
        data: usersData,
        error: usersError,
      } =
        await adminClient.auth.admin.listUsers({
          page,
          perPage,
        })

      if (usersError) {
        console.error(
          'Erreur recherche utilisateur Supabase:',
          usersError
        )

        return NextResponse.json(
          {
            error:
              'Impossible de rechercher le compte utilisateur.',
          },
          { status: 500 }
        )
      }

      const found =
        usersData.users.find(
          (candidate) =>
            candidate.email
              ?.trim()
              .toLowerCase() ===
            email
        )

      if (found) {
        existingUser = {
          id: found.id,
          email: found.email,
        }
        break
      }

      if (
        !usersData.users ||
        usersData.users.length <
          perPage
      ) {
        break
      }

      page += 1
    }

    if (existingUser) {
      const {
        error:
          resetError,
      } =
        /*
         * Envoi via le client « serveur » (clé secrète).
         *
         * Avant, l'envoi passait par la session du
         * Président : Supabase rangeait alors une clé
         * secrète dans le navigateur du Président, et
         * le lien reçu par le destinataire ne pouvait
         * fonctionner QUE sur le navigateur du Président.
         */
        await adminClient.auth.resetPasswordForEmail(
          email,
          {
            redirectTo,
          }
        )

      if (resetError) {
        console.error(
          'Erreur envoi récupération mot de passe:',
          resetError
        )

        return NextResponse.json(
          {
            error:
              resetError.message ||
              'Impossible d’envoyer le mail d’accès.',
          },
          { status: 400 }
        )
      }

      const {
        error:
          updateMemberError,
      } =
        await adminClient
          .from(
            'office_position_members'
          )
          .update({
            user_id:
              existingUser.id,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            member.id
          )

      if (updateMemberError) {
        console.error(
          'Erreur association utilisateur / poste:',
          updateMemberError
        )

        return NextResponse.json(
          {
            error:
              'Le mail a été envoyé mais l’association du compte au poste a échoué.',
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        mode: 'existing',
      })
    }

    const {
      data: invitationData,
      error:
        invitationError,
    } =
      await adminClient.auth.admin
        .inviteUserByEmail(
          email,
          {
            data: {
              office_position_id:
                position.id,
              office_position_name:
                position.name,
            },
            redirectTo,
          }
        )

    if (invitationError) {
      console.error(
        'Erreur invitation nouveau titulaire:',
        invitationError
      )

      return NextResponse.json(
        {
          error:
            invitationError.message ||
            'Impossible d’envoyer l’invitation.',
        },
        { status: 400 }
      )
    }

    if (
      invitationData?.user?.id
    ) {
      const {
        error:
          updateMemberError,
      } =
        await adminClient
          .from(
            'office_position_members'
          )
          .update({
            user_id:
              invitationData.user.id,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            member.id
          )

      if (updateMemberError) {
        console.error(
          'Erreur association utilisateur / poste:',
          updateMemberError
        )
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'new',
    })
  } catch (error) {
    console.error(
      'Erreur POST accès bureau:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Une erreur est survenue.',
      },
      { status: 500 }
    )
  }
}
