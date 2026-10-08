import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const FULL_PERMISSIONS = [
  'dashboard',
  'schooling',
  'members',
  'treasury',
  'website',
  'agenda',
  'drive',
  'configuration',
  'office_members',
];

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          authorized: false,
          role: null,
        },
        { status: 401 }
      );
    }

    const email =
      user.email?.trim().toLowerCase() || null;

    const adminClient =
      createAdminClient();

    /*
     * Les anciens comptes présents dans gipe_admins
     * restent autorisés.
     */
    const { data: adminRow } =
      await adminClient
        .from('gipe_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (adminRow) {
      return NextResponse.json({
        authorized: true,
        role: 'Administrateur',
        isSuperAdmin: false,
        isPresident: false,
        permissions: FULL_PERMISSIONS,
      });
    }

    /*
     * SUPER ADMIN
     */
    const { data: superAdmins } =
      await adminClient
        .from('office_super_admin')
        .select(
          'user_id, email, active'
        )
        .eq('active', true);

    const superAdmin =
      superAdmins?.find(
        (item) =>
          item.user_id === user.id ||
          (
            email &&
            item.email
              ?.trim()
              .toLowerCase() === email
          )
      );

    if (superAdmin) {
      return NextResponse.json({
        authorized: true,
        role: 'SUPER ADMIN',
        isSuperAdmin: true,
        isPresident: false,
        permissions: FULL_PERMISSIONS,
      });
    }

    /*
     * Membre du bureau
     */
    const { data: member } =
      await adminClient
        .from('office_position_members')
        .select(`
          user_id,
          email,
          position_id,
          active,
          office_positions (
            id,
            name,
            active
          )
        `)
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle();

    if (!member) {
      return NextResponse.json({
        authorized: false,
        role: null,
      });
    }

    const position =
      Array.isArray(
        member.office_positions
      )
        ? member.office_positions[0]
        : member.office_positions;

    if (
      !position ||
      !position.active
    ) {
      return NextResponse.json({
        authorized: false,
        role: null,
      });
    }

    /*
     * Président = tous les droits
     */
    if (
      position.name === 'Président'
    ) {
      return NextResponse.json({
        authorized: true,
        role: 'Président',
        isSuperAdmin: false,
        isPresident: true,
        permissions: FULL_PERMISSIONS,
      });
    }

    /*
     * Permissions du poste
     */
    const {
      data: permissionLinks,
    } =
      await adminClient
        .from('office_position_permissions')
        .select(`
          permission_id,
          office_permissions (
            code
          )
        `)
        .eq(
          'position_id',
          position.id
        );

    const permissions =
      (permissionLinks || [])
        .map((link) => {
          const permission =
            Array.isArray(
              link.office_permissions
            )
              ? link.office_permissions[0]
              : link.office_permissions;

          return permission?.code || null;
        })
        .filter(
          (code): code is string =>
            Boolean(code)
        );

    return NextResponse.json({
      authorized: true,
      role: position.name,
      isSuperAdmin: false,
      isPresident: false,
      permissions,
    });
  } catch (error) {
    console.error(
      'Erreur récupération accès utilisateur:',
      error
    );

    return NextResponse.json(
      {
        authorized: false,
        role: null,
      },
      { status: 500 }
    );
  }
}
