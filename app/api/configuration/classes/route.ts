import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();

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

/* =========================================================
   GET
   Détail d'une classe
   ========================================================= */

export async function GET(request: Request) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const url = new URL(request.url);
  const classId = url.searchParams.get('classId');

  if (!classId) {
    return NextResponse.json(
      {
        error: 'Identifiant de classe manquant.',
      },
      { status: 400 }
    );
  }

  const { data: classData, error: classError } = await admin
    .from('classes')
    .select('id,name,level,kind,access_code,active,school_year_id')
    .eq('id', classId)
    .maybeSingle();

  if (classError) {
    return NextResponse.json(
      { error: classError.message },
      { status: 500 }
    );
  }

  if (!classData) {
    return NextResponse.json(
      { error: 'Classe introuvable.' },
      { status: 404 }
    );
  }

  const [
    { data: students, error: studentsError },
    { data: classTeachers, error: teachersError },
  ] = await Promise.all([
    admin
      .from('students')
      .select('id,last_name,first_name,active')
      .eq('class_id', classId)
      .eq('active', true)
      .order('last_name')
      .order('first_name'),

    admin
      .from('class_teachers')
      .select(
        'class_id,teacher_id,subject,is_pp,teachers(id,display_name,active)'
      )
      .eq('class_id', classId)
      .order('subject')
      .order('teacher_id'),
  ]);

  if (studentsError || teachersError) {
    return NextResponse.json(
      {
        error:
          studentsError?.message ||
          teachersError?.message ||
          'Impossible de charger la classe.',
      },
      { status: 500 }
    );
  }

  const teachers = (classTeachers || []).map((row: any) => {
    const teacher = Array.isArray(row.teachers)
      ? row.teachers[0]
      : row.teachers;

    return {
      teacherId: row.teacher_id,
      displayName: teacher?.display_name || '',
      subject: row.subject || '',
      isPP: Boolean(row.is_pp),
    };
  });

  return NextResponse.json({
    class: classData,
    students: students || [],
    teachers,
  });
}

/* =========================================================
   PUT
   Modifier une classe, un élève ou un professeur
   ========================================================= */

export async function PUT(request: Request) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'Données invalides.' },
      { status: 400 }
    );
  }

  /*
   * ---------------------------------------------------------
   * Modifier la classe
   * ---------------------------------------------------------
   */

  if (body.type === 'class') {
    const classId = String(body.classId || '').trim();
    const name = String(body.name || '').trim();
    const level = String(body.level || '').trim();

    if (!classId || !name) {
      return NextResponse.json(
        {
          error:
            'Le nom de la classe est obligatoire.',
        },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from('classes')
      .update({
        name,
        level: level || null,
      })
      .eq('id', classId);

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de modifier la classe : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  }

  /*
   * ---------------------------------------------------------
   * Modifier un élève
   * ---------------------------------------------------------
   */

  if (body.type === 'student') {
    const studentId = String(body.studentId || '').trim();
    const lastName = String(body.lastName || '').trim();
    const firstName = String(body.firstName || '').trim();

    if (!studentId || !lastName || !firstName) {
      return NextResponse.json(
        {
          error:
            'Le nom et le prénom de l’élève sont obligatoires.',
        },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from('students')
      .update({
        last_name: lastName,
        first_name: firstName,
      })
      .eq('id', studentId);

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de modifier l’élève : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  }

  /*
   * ---------------------------------------------------------
   * Modifier un professeur dans une classe
   * ---------------------------------------------------------
   */

  if (body.type === 'teacher') {
    const classId = String(body.classId || '').trim();
    const teacherId = String(body.teacherId || '').trim();
    const displayName = String(body.displayName || '').trim();
    const subject = String(body.subject || '').trim();
    const isPP = Boolean(body.isPP);

    if (!classId || !teacherId || !displayName) {
      return NextResponse.json(
        {
          error:
            'Le nom du professeur est obligatoire.',
        },
        { status: 400 }
      );
    }

    /*
     * Le nom du professeur est global dans la table teachers.
     * On le met donc à jour ici.
     */

    const { error: teacherError } = await admin
      .from('teachers')
      .update({
        display_name: displayName,
        active: true,
      })
      .eq('id', teacherId);

    if (teacherError) {
      return NextResponse.json(
        {
          error:
            `Impossible de modifier le professeur : ${teacherError.message}`,
        },
        { status: 500 }
      );
    }

    const { error: relationError } = await admin
      .from('class_teachers')
      .update({
        subject,
        is_pp: isPP,
      })
      .eq('class_id', classId)
      .eq('teacher_id', teacherId);

    if (relationError) {
      return NextResponse.json(
        {
          error:
            `Impossible de modifier l’affectation : ${relationError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  }

  /*
   * ---------------------------------------------------------
   * Ajouter un élève
   * ---------------------------------------------------------
   */

  if (body.type === 'add-student') {
    const classId = String(body.classId || '').trim();
    const lastName = String(body.lastName || '').trim();
    const firstName = String(body.firstName || '').trim();

    if (!classId || !lastName || !firstName) {
      return NextResponse.json(
        {
          error:
            'Le nom et le prénom de l’élève sont obligatoires.',
        },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from('students')
      .insert({
        class_id: classId,
        last_name: lastName,
        first_name: firstName,
        active: true,
      })
      .select('id,last_name,first_name,active')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible d’ajouter l’élève : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      student: data,
    });
  }

  /*
   * ---------------------------------------------------------
   * Ajouter un professeur
   * ---------------------------------------------------------
   */

  if (body.type === 'add-teacher') {
    const classId = String(body.classId || '').trim();
    const displayName = String(body.displayName || '').trim();
    const subject = String(body.subject || '').trim();
    const isPP = Boolean(body.isPP);

    if (!classId || !displayName) {
      return NextResponse.json(
        {
          error:
            'Le nom du professeur est obligatoire.',
        },
        { status: 400 }
      );
    }

    /*
     * On cherche d'abord si le professeur existe déjà.
     */

    let teacherId = '';

    const { data: existingTeacher, error: findError } =
      await admin
        .from('teachers')
        .select('id,display_name')
        .eq('display_name', displayName)
        .maybeSingle();

    if (findError) {
      return NextResponse.json(
        {
          error:
            `Impossible de rechercher le professeur : ${findError.message}`,
        },
        { status: 500 }
      );
    }

    if (existingTeacher) {
      teacherId = existingTeacher.id;

      const { error: activateError } = await admin
        .from('teachers')
        .update({
          active: true,
        })
        .eq('id', teacherId);

      if (activateError) {
        return NextResponse.json(
          {
            error:
              `Impossible d’activer le professeur : ${activateError.message}`,
          },
          { status: 500 }
        );
      }
    } else {
      const { data: newTeacher, error: createError } =
        await admin
          .from('teachers')
          .insert({
            display_name: displayName,
            active: true,
          })
          .select('id,display_name')
          .single();

      if (createError || !newTeacher) {
        return NextResponse.json(
          {
            error:
              createError?.message ||
              'Impossible de créer le professeur.',
          },
          { status: 500 }
        );
      }

      teacherId = newTeacher.id;
    }

    const { data: relation, error: relationError } =
      await admin
        .from('class_teachers')
        .insert({
          class_id: classId,
          teacher_id: teacherId,
          subject,
          is_pp: isPP,
        })
        .select(
          'class_id,teacher_id,subject,is_pp'
        )
        .single();

    if (relationError) {
      if (
        relationError.code === '23505'
      ) {
        return NextResponse.json(
          {
            error:
              'Ce professeur est déjà rattaché à cette classe avec cette matière.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error:
            `Impossible de rattacher le professeur : ${relationError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      teacher: {
        teacherId,
        displayName,
        subject,
        isPP,
      },
      relation,
    });
  }

  return NextResponse.json(
    {
      error: 'Type de modification inconnu.',
    },
    { status: 400 }
  );
}

/* =========================================================
   DELETE
   Classe / élève / professeur de la classe
   ========================================================= */

export async function DELETE(request: Request) {
  const auth = await requireAdmin();

  if ('error' in auth) {
    return auth.error;
  }

  const { admin } = auth;

  const url = new URL(request.url);

  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');
  const classId = url.searchParams.get('classId');
  const teacherId = url.searchParams.get('teacherId');

  /*
   * ---------------------------------------------------------
   * Supprimer une classe
   * ---------------------------------------------------------
   */

  if (type === 'class') {
    if (!id) {
      return NextResponse.json(
        {
          error: 'Identifiant de classe manquant.',
        },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from('classes')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de supprimer la classe : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  }

  /*
   * ---------------------------------------------------------
   * Supprimer un élève
   * ---------------------------------------------------------
   */

  if (type === 'student') {
    if (!id) {
      return NextResponse.json(
        {
          error: 'Identifiant de l’élève manquant.',
        },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de supprimer l’élève : ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  }

  /*
   * ---------------------------------------------------------
   * Retirer un professeur d'une classe
   * ---------------------------------------------------------
   */

  if (type === 'teacher') {
    if (!classId || !teacherId) {
      return NextResponse.json(
        {
          error:
            'Classe ou professeur manquant.',
        },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from('class_teachers')
      .delete()
      .eq('class_id', classId)
      .eq('teacher_id', teacherId);

    if (error) {
      return NextResponse.json(
        {
          error:
            `Impossible de retirer le professeur : ${error.message}`,
        },
        { status: 500 }
      );
    }

    /*
     * Le professeur reste volontairement dans teachers.
     */

    return NextResponse.json({
      ok: true,
    });
  }

  return NextResponse.json(
    {
      error: 'Type de suppression inconnu.',
    },
    { status: 400 }
  );
}
