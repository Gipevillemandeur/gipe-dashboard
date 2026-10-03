import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const CLOUDINARY_CLOUD_NAME = 'daxiqioga';
const CLOUDINARY_UPLOAD_PRESET = 'gipe_documents';

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  format?: string;
  resource_type?: string;
};

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

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return !Number.isNaN(date.getTime());
}

async function uploadPdfToCloudinary(file: File) {
  if (
    file.type !== 'application/pdf' &&
    !file.name.toLowerCase().endsWith('.pdf')
  ) {
    throw new Error(
      'Le document doit être au format PDF.'
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'Le PDF ne doit pas dépasser 8 Mo.'
    );
  }

  const formData = new FormData();

  formData.append('file', file);
  formData.append(
    'upload_preset',
    CLOUDINARY_UPLOAD_PRESET
  );
  formData.append(
    'folder',
    'documents'
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Erreur Cloudinary : ${text}`
    );
  }

  const data =
    (await response.json()) as CloudinaryUploadResponse;

  if (!data.secure_url) {
    throw new Error(
      'Cloudinary n’a pas retourné d’URL de document.'
    );
  }

  const thumbnailUrl =
    data.secure_url
      .replace(
        '/upload/',
        '/upload/f_jpg,pg_1,w_400,h_300,c_fill,q_auto/'
      )
      .replace(
        /\.pdf$/i,
        '.jpg'
      );

  return {
    fileUrl: data.secure_url,
    thumbnailUrl,
  };
}

export async function GET() {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const { data, error } = await admin
    .from('documents')
    .select(
      'id,title,description,file_url,thumbnail_url,date,category'
    )
    .order('date', {
      ascending: false,
    })
    .order('id', {
      ascending: false,
    });

  if (error) {
    return NextResponse.json(
      {
        error:
          `Impossible de charger les documents : ${error.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    documents: data || [],
  });
}

export async function POST(
  request: Request
) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  try {
    const formData =
      await request.formData();

    const title = cleanString(
      formData.get('title')
    );

    const description = cleanString(
      formData.get('description')
    );

    const date = cleanString(
      formData.get('date')
    );

    const category = cleanString(
      formData.get('category')
    );

    const file =
      formData.get('file');

    if (!title) {
      return NextResponse.json(
        {
          error:
            'Le titre est obligatoire.',
        },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        {
          error:
            'Le titre est trop long.',
        },
        { status: 400 }
      );
    }

    if (!validDate(date)) {
      return NextResponse.json(
        {
          error:
            'La date est invalide.',
        },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            'Veuillez sélectionner un fichier PDF.',
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          error:
            'Le fichier sélectionné est vide.',
        },
        { status: 400 }
      );
    }

    const uploaded =
      await uploadPdfToCloudinary(
        file
      );

    const { data, error } =
      await admin
        .from('documents')
        .insert({
          title,
          description:
            description || null,
          file_url:
            uploaded.fileUrl,
          thumbnail_url:
            uploaded.thumbnailUrl,
          date,
          category:
            category || null,
        })
        .select(
          'id,title,description,file_url,thumbnail_url,date,category'
        )
        .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible d’ajouter le document : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        document: data,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’ajouter le document.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request
) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  try {
    const formData =
      await request.formData();

    const id = cleanString(
      formData.get('id')
    );

    const title = cleanString(
      formData.get('title')
    );

    const description = cleanString(
      formData.get('description')
    );

    const date = cleanString(
      formData.get('date')
    );

    const category = cleanString(
      formData.get('category')
    );

    const file =
      formData.get('file');

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Document introuvable.',
        },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          error:
            'Le titre est obligatoire.',
        },
        { status: 400 }
      );
    }

    if (!validDate(date)) {
      return NextResponse.json(
        {
          error:
            'La date est invalide.',
        },
        { status: 400 }
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from('documents')
      .select(
        'id,file_url,thumbnail_url'
      )
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          error:
            'Document introuvable.',
        },
        { status: 404 }
      );
    }

    let fileUrl =
      existing.file_url || null;

    let thumbnailUrl =
      existing.thumbnail_url || null;

    if (
      file instanceof File &&
      file.size > 0
    ) {
      const uploaded =
        await uploadPdfToCloudinary(
          file
        );

      fileUrl =
        uploaded.fileUrl;

      thumbnailUrl =
        uploaded.thumbnailUrl;
    }

    const { data, error } =
      await admin
        .from('documents')
        .update({
          title,
          description:
            description || null,
          file_url:
            fileUrl,
          thumbnail_url:
            thumbnailUrl,
          date,
          category:
            category || null,
        })
        .eq('id', id)
        .select(
          'id,title,description,file_url,thumbnail_url,date,category'
        )
        .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de modifier le document : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      document: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de modifier le document.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request
) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  try {
    const body =
      await request.json();

    const id = cleanString(
      body?.id
    );

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Document introuvable.',
        },
        { status: 400 }
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from('documents')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          error:
            'Document introuvable.',
        },
        { status: 404 }
      );
    }

    const { error } =
      await admin
        .from('documents')
        .delete()
        .eq('id', id);

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de supprimer le document : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer le document.',
      },
      { status: 500 }
    );
  }
}
