import Link from 'next/link';
import {
  ArrowLeft,
  GraduationCap,
  Users,
  UserRound,
  BookOpen,
  CalendarDays,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ classId: string }>;
};

export default async function ConseilClassePage({
  params,
}: PageProps) {
  const { classId } = await params;
  const supabase = await createClient();

  const { data: activeYear } = await supabase
    .from('school_years')
    .select('id,label')
    .eq('is_active', true)
    .maybeSingle();

  if (!activeYear) {
    return (
      <div className="card section-card">
        <h1>Classe introuvable</h1>
        <p className="section-sub">
          Aucune année scolaire active n'est disponible.
        </p>
        <Link className="btn btn-secondary conseils-detail-back" href="/conseils">
          <ArrowLeft size={14} />
          Retour aux classes
        </Link>
      </div>
    );
  }

  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id,name,level,kind,active')
    .eq('id', classId)
    .eq('school_year_id', activeYear.id)
    .eq('active', true)
    .maybeSingle();

  if (classError || !classData) {
    return (
      <div className="card section-card">
        <h1>Classe introuvable</h1>
        <p className="section-sub">
          Cette classe n'existe plus dans l'année scolaire active.
          Si le fichier du collège vient d'être réimporté, la liste
          affichée doit être rafraîchie.
        </p>
        <Link className="btn btn-secondary conseils-detail-back" href="/conseils">
          <ArrowLeft size={14} />
          Retour aux classes
        </Link>
      </div>
    );
  }

  const [{ data: students }, { data: classTeachers }] =
    await Promise.all([
      supabase
        .from('students')
        .select('id,last_name,first_name')
        .eq('class_id', classData.id)
        .eq('active', true)
        .order('last_name')
        .order('first_name'),

      supabase
        .from('class_teachers')
        .select('teacher_id,subject,is_pp,teachers(display_name)')
        .eq('class_id', classData.id)
        .order('subject')
        .order('teacher_id'),
    ]);

  const studentRows = students || [];
  const teacherRows = classTeachers || [];

  return (
    <>
      <div className="topbar conseils-detail-topbar">
        <div>
          <div className="eyebrow">
            Conseils de classe
          </div>

          <h1>
            {classData.name}
          </h1>

          <div className="kicker">
            {classData.level || 'Niveau non renseigné'} · {activeYear.label}
          </div>
        </div>

        <div className="topbar-right">
          <Link className="btn btn-secondary conseils-detail-back" href="/conseils">
            <ArrowLeft size={14} />
            Retour aux classes
          </Link>
        </div>
      </div>

      <div className="page-grid cards-4 conseils-detail-stats">
        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">Classe</div>
            <div className="stat-icon">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="stat-value">{classData.name}</div>
          <div className="stat-note">
            {classData.level || 'Niveau non renseigné'}
          </div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">Élèves</div>
            <div className="stat-icon">
              <Users size={17} />
            </div>
          </div>
          <div className="stat-value">{studentRows.length}</div>
          <div className="stat-note">
            Élèves actuellement rattachés à la classe.
          </div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">Équipe pédagogique</div>
            <div className="stat-icon">
              <UserRound size={17} />
            </div>
          </div>
          <div className="stat-value">{teacherRows.length}</div>
          <div className="stat-note">
            Enseignants rattachés à la classe.
          </div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <div className="stat-label">Conseil</div>
            <div className="stat-icon">
              <CalendarDays size={17} />
            </div>
          </div>
          <div className="stat-value">—</div>
          <div className="stat-note">
            Dates et préparation seront ajoutées ici.
          </div>
        </div>
      </div>

      <div className="page-grid two-col conseils-detail-grid">
        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                Équipe pédagogique
              </h2>
              <p className="section-sub">
                Données issues du dernier import du collège.
              </p>
            </div>
          </div>

          {teacherRows.length === 0 ? (
            <div className="conseils-empty">
              <UserRound size={18} />
              Aucun enseignant rattaché à cette classe.
            </div>
          ) : (
            <div className="conseils-teachers-list">
              {teacherRows.map((row: any, index: number) => {
                const teacher = Array.isArray(row.teachers)
                  ? row.teachers[0]
                  : row.teachers;

                return (
                  <div
                    className="conseils-teacher-row"
                    key={`${row.teacher_id}-${row.subject}-${index}`}
                  >
                    <div className="conseils-teacher-icon">
                      <UserRound size={16} />
                    </div>

                    <div className="conseils-teacher-main">
                      <strong>
                        {teacher?.display_name || 'Enseignant'}
                      </strong>

                      <span>
                        {row.subject || 'Matière non renseignée'}
                        {row.is_pp ? ' · Professeur principal' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                Élèves
              </h2>
              <p className="section-sub">
                Liste actualisée automatiquement après chaque import.
              </p>
            </div>
          </div>

          {studentRows.length === 0 ? (
            <div className="conseils-empty">
              <Users size={18} />
              Aucun élève rattaché à cette classe.
            </div>
          ) : (
            <div className="conseils-students-list">
              {studentRows.map((student: any, index: number) => (
                <div
                  className="conseils-student-row"
                  key={student.id}
                >
                  <span className="conseils-student-number">
                    {index + 1}
                  </span>

                  <div>
                    <strong>
                      {student.last_name} {student.first_name}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card section-card conseils-detail-info">
        <div className="conseils-detail-info-icon">
          <BookOpen size={18} />
        </div>

        <div>
          <h2 className="section-title">
            Consultation uniquement
          </h2>

          <p className="section-sub">
            Les classes, élèves et équipes pédagogiques sont alimentés
            par le fichier d'import du collège. Cette page ne permet
            aucune modification manuelle.
          </p>
        </div>
      </section>

      <style>{`
        .conseils-detail-topbar {
          align-items: flex-start;
        }

        .conseils-detail-back {
          white-space: nowrap;
        }

        .conseils-detail-stats {
          margin-top: 18px;
        }

        .conseils-detail-grid {
          margin-top: 18px;
          align-items: start;
        }

        .conseils-teachers-list,
        .conseils-students-list {
          display: grid;
          gap: 8px;
          margin-top: 14px;
        }

        .conseils-teacher-row,
        .conseils-student-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid #eadfd4;
          border-radius: 10px;
          background: #fff;
        }

        .conseils-teacher-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: #f6efe8;
          color: #5f514b;
        }

        .conseils-teacher-main {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .conseils-teacher-main strong {
          font-size: 13px;
        }

        .conseils-teacher-main span {
          font-size: 11px;
          color: #756a67;
        }

        .conseils-student-row {
          min-height: 42px;
        }

        .conseils-student-number {
          width: 25px;
          color: #756a67;
          font-size: 11px;
          text-align: right;
          flex: 0 0 auto;
        }

        .conseils-student-row strong {
          font-size: 13px;
        }

        .conseils-empty {
          margin-top: 14px;
          padding: 18px;
          border: 1px dashed #d8cbc0;
          border-radius: 10px;
          color: #756a67;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .conseils-detail-info {
          margin-top: 18px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .conseils-detail-info-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: #f6efe8;
          color: #5f514b;
        }

        @media (max-width: 760px) {
          .conseils-detail-topbar {
            align-items: flex-start;
          }

          .conseils-detail-topbar .topbar-right {
            width: auto;
          }

          .conseils-detail-stats {
            grid-template-columns: 1fr 1fr;
            margin-top: 14px;
          }

          .conseils-detail-grid {
            grid-template-columns: 1fr;
            margin-top: 14px;
          }

          .conseils-detail-info {
            margin-top: 14px;
          }
        }

        @media (max-width: 480px) {
          .conseils-detail-stats {
            grid-template-columns: 1fr;
          }

          .conseils-detail-back {
            width: auto;
          }

          .conseils-detail-info {
            padding: 14px;
          }
        }
      `}</style>
    </>
  );
}
