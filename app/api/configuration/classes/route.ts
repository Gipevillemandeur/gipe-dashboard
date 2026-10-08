import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOfficePermission } from '@/lib/office-auth';

async function requireConfigurationAccess() {
  try {
    const access = await requireOfficePermission('configuration');

    return {
      adminClient: createAdminClient(),
      access,
    };
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

    console.error('Erreur contrôle accès configuration:', error);

    return {
      error: NextResponse.json(
        { error: 'Erreur de contrôle des accès.' },
        { status: 500 }
      ),
    };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { adminClient } = auth;

  const classId = request.nextUrl.searchParams.get('classId');

  if (!classId) {
    return NextResponse.json(
      { error: 'classId est obligatoire.' },
      { status: 400 }
    );
  }

  const { data: classData, error: classError } = await adminClient
    .from('classes')
    .select(
      `
        id,
        name,
        level,
        kind,
        access_code,
        active
      `
    )
    .eq('id', classId)
    .maybeSingle();

  if (classError) {
    console.error(classError);

    return NextResponse.json(
      { error: 'Impossible de récupérer la classe.' },
      { status: 500 }
    );
  }

  if (!classData) {
    return NextResponse.json(
      { error: 'Classe introuvable.' },
      { status: 404 }
    );
  }

  const { data: students, error: studentsError } = await adminClient
    .from('students')
    .select(
      `
        id,
        class_id,
        last_name,
        first_name,
        active
      `
    )
    .eq('class_id', classId)
    .eq('active', true)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (studentsError) {
    console.error(studentsError);

    return NextResponse.json(
      { error: 'Impossible de récupérer les élèves.' },
      { status: 500 }
    );
  }

  const { data: classTeachers, error: teachersError } = await adminClient
    .from('class_teachers')
    .select(
      `
        class_id,
        teacher_id,
        subject,
        is_pp,
        teachers (
          id,
          display_name,
          active
        )
      `
    )
    .eq('class_id', classId);

  if (teachersError) {
    console.error(teachersError);

    return NextResponse.json(
      { error: 'Impossible de récupérer les professeurs.' },
      { status: 500 }
    );
  }

  const teachers = (classTeachers || [])
    .filter((row: any) => row.teachers)
    .map((row: any) => ({
      teacherId: row.teacher_id,
      displayName: row.teachers.display_name,
      subject: row.subject || '',
      isPP: Boolean(row.is_pp),
    }));

  return NextResponse.json({
    class: classData,
    students: students || [],
    teachers,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { adminClient } = auth;

  try {
    const body = await request.json();

    const type = body?.type;

    /*
     * ---------------------------------------------------------
     * MODIFICATION DE LA CLASSE
     * ---------------------------------------------------------
     */

    if (type === 'class') {
      const {
        id,
        name,
        level,
        accessCode,
      } = body;

      if (!id) {
        return NextResponse.json(
          { error: 'Identifiant de classe manquant.' },
          { status: 400 }
        );
      }

      const updateData: Record<string, any> = {};

      if (typeof name === 'string') {
        updateData.name = name.trim();
      }

      if (typeof level === 'string') {
        updateData.level = level.trim() || null;
      }

      if (typeof accessCode === 'string') {
        updateData.access_code = accessCode.trim() || null;
      }

      const { data, error } = await adminClient
        .from('classes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(error);

        return NextResponse.json(
          {
            error:
              error.code === '23505'
                ? 'Une classe portant ce nom existe déjà pour cette année.'
                : 'Impossible de modifier la classe.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        class: data,
      });
    }

    /*
     * ---------------------------------------------------------
     * AJOUT D'UN ÉLÈVE
     * ---------------------------------------------------------
     */

    if (type === 'add-student') {
      const {
        classId,
        lastName,
        firstName,
      } = body;

      if (!classId || !lastName || !firstName) {
        return NextResponse.json(
          {
            error:
              'La classe, le nom et le prénom sont obligatoires.',
          },
          { status: 400 }
        );
      }

      const { data: classExists, error: classError } =
        await adminClient
          .from('classes')
          .select('id')
          .eq('id', classId)
          .maybeSingle();

      if (classError || !classExists) {
        return NextResponse.json(
          { error: 'Classe introuvable.' },
          { status: 404 }
        );
      }

      const { data, error } = await adminClient
        .from('students')
        .insert({
          class_id: classId,
          last_name: String(lastName).trim(),
          first_name: String(firstName).trim(),
          active: true,
        })
        .select()
        .single();

      if (error) {
        console.error(error);

        return NextResponse.json(
          { error: 'Impossible d’ajouter l’élève.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        student: data,
      });
    }

    /*
     * ---------------------------------------------------------
     * MODIFICATION D'UN ÉLÈVE
     * ---------------------------------------------------------
     */

    if (type === 'student') {
      const {
        id,
        classId,
        lastName,
        firstName,
      } = body;

      if (!id || !classId) {
        return NextResponse.json(
          { error: 'Identifiant élève ou classe manquant.' },
          { status: 400 }
        );
      }

      /*
       * IMPORTANT :
       * On vérifie que l'élève appartient bien à cette classe.
       * Une modification ne peut donc pas toucher un élève
       * d'une autre classe.
       */

      const { data: student, error: studentError } =
        await adminClient
          .from('students')
          .select('id, class_id')
          .eq('id', id)
          .eq('class_id', classId)
          .maybeSingle();

      if (studentError || !student) {
        return NextResponse.json(
          {
            error:
              'Élève introuvable dans cette classe.',
          },
          { status: 404 }
        );
      }

      const { data, error } = await adminClient
        .from('students')
        .update({
          last_name: String(lastName || '').trim(),
          first_name: String(firstName || '').trim(),
        })
        .eq('id', id)
        .eq('class_id', classId)
        .select()
        .single();

      if (error) {
        console.error(error);

        return NextResponse.json(
          { error: 'Impossible de modifier l’élève.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        student: data,
      });
    }

    /*
     * ---------------------------------------------------------
     * AJOUT D'UN PROFESSEUR À UNE CLASSE
     * ---------------------------------------------------------
     */

    if (type === 'add-teacher') {
      const {
        classId,
        displayName,
        subject,
        isPP,
      } = body;

      if (!classId || !displayName) {
        return NextResponse.json(
          {
            error:
              'La classe et le nom du professeur sont obligatoires.',
          },
          { status: 400 }
        );
      }

      /*
       * On réutilise le professeur existant s'il existe.
       * Cela permet d'avoir un référentiel des professeurs.
       *
       * MAIS :
       * les informations propres à la classe
       * (matière / PP) sont stockées dans class_teachers.
       */

      let teacherId: string | null = null;

      const { data: existingTeacher, error: existingTeacherError } =
        await adminClient
          .from('teachers')
          .select('id')
          .eq('display_name', String(displayName).trim())
          .maybeSingle();

      if (existingTeacherError) {
        console.error(existingTeacherError);

        return NextResponse.json(
          { error: 'Impossible de rechercher le professeur.' },
          { status: 500 }
        );
      }

      if (existingTeacher) {
        teacherId = existingTeacher.id;
      } else {
        const { data: newTeacher, error: newTeacherError } =
          await adminClient
            .from('teachers')
            .insert({
              display_name: String(displayName).trim(),
              active: true,
            })
            .select('id')
            .single();

        if (newTeacherError) {
          console.error(newTeacherError);

          return NextResponse.json(
            { error: 'Impossible de créer le professeur.' },
            { status: 500 }
          );
        }

        teacherId = newTeacher.id;
      }

      /*
       * La relation est propre à la classe.
       */

      const { data: relation, error: relationError } =
        await adminClient
          .from('class_teachers')
          .insert({
            class_id: classId,
            teacher_id: teacherId,
            subject: String(subject || '').trim(),
            is_pp: Boolean(isPP),
          })
          .select()
          .single();

      if (relationError) {
        console.error(relationError);

        return NextResponse.json(
          {
            error:
              relationError.code === '23505'
                ? 'Ce professeur est déjà associé à cette matière dans cette classe.'
                : 'Impossible d’ajouter le professeur à cette classe.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        teacher: relation,
      });
    }

    /*
     * ---------------------------------------------------------
     * MODIFICATION D'UN PROFESSEUR DANS UNE CLASSE
     * ---------------------------------------------------------
     *
     * IMPORTANT :
     *
     * On NE MODIFIE PLUS teachers.display_name.
     *
     * Le nom du professeur est propre à la relation
     * classe + professeur + matière.
     *
     * Pour éviter de modifier un professeur utilisé ailleurs,
     * on crée/utilise un professeur correspondant au nouveau nom
     * puis on remplace uniquement la relation de cette classe.
     * ---------------------------------------------------------
     */

    if (type === 'teacher') {
      const {
        teacherId,
        classId,
        displayName,
        subject,
        isPP,
      } = body;

      if (!teacherId || !classId) {
        return NextResponse.json(
          {
            error:
              'Identifiant professeur ou classe manquant.',
          },
          { status: 400 }
        );
      }

      /*
       * Vérification stricte :
       * cette relation doit réellement appartenir à la classe.
       */

      const { data: relation, error: relationError } =
        await adminClient
          .from('class_teachers')
          .select(
            `
              class_id,
              teacher_id,
              subject,
              is_pp
            `
          )
          .eq('class_id', classId)
          .eq('teacher_id', teacherId)
          .maybeSingle();

      if (relationError || !relation) {
        return NextResponse.json(
          {
            error:
              'Ce professeur n’est pas associé à cette classe.',
          },
          { status: 404 }
        );
      }

      const cleanName = String(displayName || '').trim();
      const cleanSubject = String(subject || '').trim();

      if (!cleanName) {
        return NextResponse.json(
          {
            error:
              'Le nom du professeur est obligatoire.',
          },
          { status: 400 }
        );
      }

      /*
       * Si le nom reste identique :
       * on ne touche qu'à la relation de cette classe.
       */

      if (
        relation.teacher_id === teacherId
      ) {
        const { data: currentTeacher, error: currentTeacherError } =
          await adminClient
            .from('teachers')
            .select('display_name')
            .eq('id', teacherId)
            .single();

        if (currentTeacherError) {
          console.error(currentTeacherError);

          return NextResponse.json(
            {
              error:
                'Impossible de récupérer le professeur.',
            },
            { status: 500 }
          );
        }

        /*
         * -----------------------------------------------------
         * CAS 1 :
         * même professeur -> on modifie uniquement la relation
         * de cette classe.
         * -----------------------------------------------------
         */

        if (
          currentTeacher.display_name.trim() === cleanName
        ) {
          const { data, error } = await adminClient
            .from('class_teachers')
            .update({
              subject: cleanSubject,
              is_pp: Boolean(isPP),
            })
            .eq('class_id', classId)
            .eq('teacher_id', teacherId)
            .eq('subject', relation.subject)
            .select()
            .single();

          if (error) {
            console.error(error);

            return NextResponse.json(
              {
                error:
                  'Impossible de modifier le professeur.',
              },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            teacher: data,
          });
        }
      }

      /*
       * -----------------------------------------------------
       * CAS 2 :
       * le nom change.
       *
       * Exemple :
       *
       * 3eA -> Durand -> Histoire
       *
       * devient :
       *
       * 3eA -> Michel -> Histoire
       *
       * On NE modifie PAS Durand.
       *
       * On récupère/crée Michel puis on modifie uniquement
       * la relation de la 3eA.
       * -----------------------------------------------------
       */

      let newTeacherId: string | null = null;

      const {
        data: existingTeacher,
        error: existingTeacherError,
      } = await adminClient
        .from('teachers')
        .select('id')
        .eq('display_name', cleanName)
        .maybeSingle();

      if (existingTeacherError) {
        console.error(existingTeacherError);

        return NextResponse.json(
          {
            error:
              'Impossible de rechercher le nouveau professeur.',
          },
          { status: 500 }
        );
      }

      if (existingTeacher) {
        newTeacherId = existingTeacher.id;
      } else {
        const {
          data: createdTeacher,
          error: createdTeacherError,
        } = await adminClient
          .from('teachers')
          .insert({
            display_name: cleanName,
            active: true,
          })
          .select('id')
          .single();

        if (createdTeacherError) {
          console.error(createdTeacherError);

          return NextResponse.json(
            {
              error:
                'Impossible de créer le nouveau professeur.',
            },
            { status: 500 }
          );
        }

        newTeacherId = createdTeacher.id;
      }

      /*
       * Si la nouvelle relation existe déjà dans cette classe,
       * on évite de créer un doublon.
       */

      const { data: existingRelation } =
        await adminClient
          .from('class_teachers')
          .select(
            `
              class_id,
              teacher_id,
              subject
            `
          )
          .eq('class_id', classId)
          .eq('teacher_id', newTeacherId)
          .eq('subject', cleanSubject)
          .maybeSingle();

      if (existingRelation) {
        /*
         * La nouvelle relation existe déjà.
         * On supprime uniquement l'ancienne relation.
         */

        const { error: deleteOldError } =
          await adminClient
            .from('class_teachers')
            .delete()
            .eq('class_id', classId)
            .eq('teacher_id', teacherId)
            .eq('subject', relation.subject);

        if (deleteOldError) {
          console.error(deleteOldError);

          return NextResponse.json(
            {
              error:
                'Impossible de remplacer le professeur.',
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
        });
      }

      /*
       * On remplace la relation.
       *
       * Durand reste intact dans teachers et dans toutes
       * les autres classes.
       */

      const { data, error: updateRelationError } =
        await adminClient
          .from('class_teachers')
          .update({
            teacher_id: newTeacherId,
            subject: cleanSubject,
            is_pp: Boolean(isPP),
          })
          .eq('class_id', classId)
          .eq('teacher_id', teacherId)
          .eq('subject', relation.subject)
          .select()
          .single();

      if (updateRelationError) {
        console.error(updateRelationError);

        return NextResponse.json(
          {
            error:
              'Impossible de modifier le professeur dans cette classe.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        teacher: data,
      });
    }

    return NextResponse.json(
      { error: 'Type de modification inconnu.' },
      { status: 400 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          'Une erreur est survenue lors de la modification.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireConfigurationAccess();

  if ('error' in auth) {
    return auth.error;
  }

  const { adminClient } = auth;

  const type = request.nextUrl.searchParams.get('type');
  const id = request.nextUrl.searchParams.get('id');
  const classId = request.nextUrl.searchParams.get('classId');
  const teacherId =
    request.nextUrl.searchParams.get('teacherId');

  /*
   * ---------------------------------------------------------
   * SUPPRESSION D'UNE CLASSE
   * ---------------------------------------------------------
   *
   * Grâce aux ON DELETE CASCADE du schéma :
   * - élèves
   * - relations professeurs
   *
   * seront supprimés avec la classe.
   *
   * Les professeurs eux-mêmes restent dans teachers.
   */

  if (type === 'class') {
    if (!id) {
      return NextResponse.json(
        { error: 'Identifiant classe manquant.' },
        { status: 400 }
      );
    }

    const { error } = await adminClient
      .from('classes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: 'Impossible de supprimer la classe.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  /*
   * ---------------------------------------------------------
   * SUPPRESSION D'UN ÉLÈVE
   * ---------------------------------------------------------
   */

  if (type === 'student') {
    if (!id || !classId) {
      return NextResponse.json(
        {
          error:
            'Identifiant élève ou classe manquant.',
        },
        { status: 400 }
      );
    }

    const { error } = await adminClient
      .from('students')
      .delete()
      .eq('id', id)
      .eq('class_id', classId);

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: 'Impossible de supprimer l’élève.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  /*
   * ---------------------------------------------------------
   * SUPPRESSION D'UN PROFESSEUR D'UNE CLASSE
   * ---------------------------------------------------------
   *
   * IMPORTANT :
   * on supprime uniquement class_teachers.
   *
   * Le professeur reste dans teachers et continue donc
   * d'exister pour les autres classes.
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

    const { error } = await adminClient
      .from('class_teachers')
      .delete()
      .eq('class_id', classId)
      .eq('teacher_id', teacherId);

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          error:
            'Impossible de retirer le professeur de cette classe.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  return NextResponse.json(
    { error: 'Type de suppression inconnu.' },
    { status: 400 }
  );
}
