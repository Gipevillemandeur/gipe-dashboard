import { NextResponse } from 'next/server'
import { requireOfficePermission } from '@/lib/office-auth'
import {
  driveErrorResponse,
  getDriveConnectionInfo,
} from '@/lib/google-drive'

/*
 * Indique si le Google Drive de l'association est relié,
 * avec quel compte, et si l'utilisateur peut le (re)connecter.
 */
export async function GET() {
  try {
    const access = await requireOfficePermission('drive')
    const info = await getDriveConnectionInfo()

    return NextResponse.json({
      ...info,
      canManage: access.isPresident || access.isSuperAdmin,
    })
  } catch (error) {
    return driveErrorResponse(
      error,
      'Impossible de vérifier la connexion Google Drive.'
    )
  }
}
