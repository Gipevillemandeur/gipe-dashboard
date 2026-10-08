import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOfficePermission } from '@/lib/office-auth';

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const CATEGORIES = [
  'Information',
  'GIPE',
  'Portes Ouvertes',
];

async function requireAdmin() {
  try {
    await requireOfficePermission('website');
    return { admin: createAdminClient() };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'AUTHENTICATION_REQUIRED') {
        return {
          error: NextResponse.json(
            { error: 'Non authentifié.' },
            { status: 401 }
          ),
        };
      }

      if (
        error.message === 'OFFICE_ACCESS_DENIED' ||
        error.message === 'OFFICE_PERMISSION_DENIED'
      ) {
        return {
          error: NextResponse.json(
            { error: 'Compte non autorisé.' },
            { status: 403 }
          ),
        };
      }
    }

    console.error('Erreur contrôle accès site:', error);

    return {
      error: NextResponse.json(
        { error: 'Erreur de contrôle des accès.' },
        { status: 500 }
      ),
    };
  }
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

function validateCategory(value: string) {
  return !value || CATEGORIES.includes(value);
}

function getExtension(fileName: string) {
  const extension = fileName
    .split('.')
    .pop()
    ?.toLowerCase();

  return extension || 'bin';
}

async function uploadImage(
  admin: ReturnType<typeof createAdminClient>,
  file: File
) {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      'Le fichier doit être une image.'
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'L’image ne doit pas dépasser 8 Mo.'
    );
  }

  const extension = getExtension(file.name);

  const filePath =
    `news/${crypto.randomUUID()}.${extension}`;

  const bytes = await file.arrayBuffer();

  const { error } = await admin.storage
    .from('images')
    .upload(filePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Impossible d’envoyer l’image : ${error.message}`
    );
  }

  const { data } =
    admin.storage
      .from('images')
      .getPublicUrl(filePath);

  return data.publicUrl;
}

async function deleteSupabaseImage(
  admin: ReturnType<typeof createAdminClient>,
  imageUrl: string | null | undefined
) {
  if (
    !imageUrl ||
    !imageUrl.includes('/storage/v1/object/public/images/')
  ) {
    return;
  }

  const marker =
    '/storage/v1/object/public/images/';

  const index = imageUrl.indexOf(marker);

  if (index === -1) {
    return;
  }

  const path = decodeURIComponent(
    imageUrl.slice(index + marker.length)
  );

  if (!path) {
    return;
  }

  await admin.storage
    .from('images')
    .remove([path]);
}

export async function GET() {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const { data, error } = await admin
    .from('news')
    .select(
      'id,title,content,category,image_url,date,author'
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
          `Impossible de charger les actualités : ${error.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    news: data || [],
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

    const content = cleanString(
      formData.get('content')
    );

    const category = cleanString(
      formData.get('category')
    );

    const date = cleanString(
      formData.get('date')
    );

    const author = cleanString(
      formData.get('author')
    );

    const imageFile =
      formData.get('imageFile');

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

    if (!content) {
      return NextResponse.json(
        {
          error:
            'Le contenu est obligatoire.',
        },
        { status: 400 }
      );
    }

    if (content.length > 20000) {
      return NextResponse.json(
        {
          error:
            'Le contenu est trop long.',
        },
        { status: 400 }
      );
    }

    if (!validateCategory(category)) {
      return NextResponse.json(
        {
          error:
            'La catégorie est invalide.',
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

    let imageUrl = '';

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      imageUrl =
        await uploadImage(
          admin,
          imageFile
        );
    }

    const { data, error } =
      await admin
        .from('news')
        .insert({
          title,
          content,
          category:
            category || null,
          image_url:
            imageUrl || null,
          date,
          author:
            author || 'GIPE',
        })
        .select(
          'id,title,content,category,image_url,date,author'
        )
        .single();

    if (error) {
      if (imageUrl) {
        await deleteSupabaseImage(
          admin,
          imageUrl
        );
      }

      return NextResponse.json(
        {
          error:
            `Impossible d’ajouter l’actualité : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        news: data,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’ajouter l’actualité.',
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

    const content = cleanString(
      formData.get('content')
    );

    const category = cleanString(
      formData.get('category')
    );

    const date = cleanString(
      formData.get('date')
    );

    const author = cleanString(
      formData.get('author')
    );

    const keepImage =
      formData.get('keepImage') === 'true';

    const imageFile =
      formData.get('imageFile');

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Actualité introuvable.',
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

    if (!content) {
      return NextResponse.json(
        {
          error:
            'Le contenu est obligatoire.',
        },
        { status: 400 }
      );
    }

    if (!validateCategory(category)) {
      return NextResponse.json(
        {
          error:
            'La catégorie est invalide.',
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

    const { data: existing, error: existingError } =
      await admin
        .from('news')
        .select(
          'id,image_url'
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
            'Actualité introuvable.',
        },
        { status: 404 }
      );
    }

    let imageUrl =
      keepImage
        ? existing.image_url || null
        : null;

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      imageUrl =
        await uploadImage(
          admin,
          imageFile
        );
    }

    const { data, error } =
      await admin
        .from('news')
        .update({
          title,
          content,
          category:
            category || null,
          image_url:
            imageUrl,
          date,
          author:
            author || 'GIPE',
        })
        .eq('id', id)
        .select(
          'id,title,content,category,image_url,date,author'
        )
        .single();

    if (error) {
      if (
        imageUrl &&
        imageUrl !== existing.image_url
      ) {
        await deleteSupabaseImage(
          admin,
          imageUrl
        );
      }

      return NextResponse.json(
        {
          error:
            `Impossible de modifier l’actualité : ${error.message}`,
        },
        { status: 500 }
      );
    }

    if (
      existing.image_url &&
      existing.image_url !== imageUrl
    ) {
      await deleteSupabaseImage(
        admin,
        existing.image_url
      );
    }

    return NextResponse.json({
      ok: true,
      news: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de modifier l’actualité.',
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
      await request.json()
        .catch(() => null) as {
          id?: string;
        } | null;

    const id = cleanString(
      body?.id
    );

    if (!id) {
      return NextResponse.json(
        {
          error:
            'Actualité introuvable.',
        },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } =
      await admin
        .from('news')
        .select(
          'id,image_url'
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
            'Actualité introuvable.',
        },
        { status: 404 }
      );
    }

    const { error } =
      await admin
        .from('news')
        .delete()
        .eq('id', id);

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de supprimer l’actualité : ${error.message}`,
        },
        { status: 500 }
      );
    }

    await deleteSupabaseImage(
      admin,
      existing.image_url
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer l’actualité.',
      },
      { status: 500 }
    );
  }
}
