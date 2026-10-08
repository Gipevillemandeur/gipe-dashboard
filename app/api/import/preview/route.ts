import { NextResponse } from 'next/server';
import {
  requireOfficePermission,
} from '@/lib/office-auth';
import {
  parseCollegeWorkbook,
  summarizeImport,
} from '@/lib/college-import';

export const runtime = 'nodejs';

export async function POST(
  request: Request
) {
  try {
    await requireOfficePermission(
      'configuration'
    );
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        'AUTHENTICATION_REQUIRED'
      ) {
        return NextResponse.json(
          {
            error:
              'Non authentifié.',
          },
          {
            status: 401,
          }
        );
      }

      if (
        error.message ===
          'OFFICE_ACCESS_DENIED' ||
        error.message ===
          'OFFICE_PERMISSION_DENIED'
      ) {
        return NextResponse.json(
          {
            error:
              'Compte non autorisé.',
          },
          {
            status: 403,
          }
        );
      }
    }

    console.error(
      'Erreur contrôle accès import preview:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Erreur de contrôle des accès.',
      },
      {
        status: 500,
      }
    );
  }

  const formData =
    await request.formData();

  const file =
    formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error:
          'Aucun fichier reçu.',
      },
      {
        status: 400,
      }
    );
  }

  if (
    file.size >
    10 * 1024 * 1024
  ) {
    return NextResponse.json(
      {
        error:
          'Le fichier est trop volumineux (10 Mo maximum).',
      },
      {
        status: 413,
      }
    );
  }

  const allowed =
    /\.(xls|xlsx)$/i;

  if (
    !allowed.test(
      file.name
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Format non accepté. Utilise un fichier .xls ou .xlsx.',
      },
      {
        status: 415,
      }
    );
  }

  try {
    const parsed =
      parseCollegeWorkbook(
        await file.arrayBuffer()
      );

    return NextResponse.json({
      fileName:
        file.name,
      summary:
        summarizeImport(
          parsed
        ),
      parsed,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'Impossible de lire le fichier fourni.',
      },
      {
        status: 400,
      }
    );
  }
}
