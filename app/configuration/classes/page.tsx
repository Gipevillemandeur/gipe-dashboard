'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  KeyRound,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  kind: 'real' | 'demo';
  access_code: string | null;
  active: boolean;
};

type Student = {
  id: string;
  last_name: string;
  first_name: string;
  active: boolean;
};

type Teacher = {
  teacherId: string;
  displayName: string;
  subject: string;
  isPP: boolean;
};

type ModalMode =
  | 'class'
  | 'student'
  | 'teacher'
  | 'add-student'
  | 'add-teacher'
  | null;

export default function ConfigurationClassesPage() {
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCodes, setSavingCodes] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [selectedClass, setSelectedClass] =
    useState<ClassItem | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [loadingClass, setLoadingClass] = useState(false);

  const [modalMode, setModalMode] =
    useState<ModalMode>(null);

  const [saving, setSaving] = useState(false);

  /*
   * IDs conservés pendant les modifications.
   * C'est important si le nom/prénom est modifié.
   */
  const [editingStudentId, setEditingStudentId] =
    useState<string | null>(null);

  const [editingTeacherId, setEditingTeacherId] =
    useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formLevel, setFormLevel] = useState('');

  const [formLastName, setFormLastName] =
    useState('');

  const [formFirstName, setFormFirstName] =
    useState('');

  const [formDisplayName, setFormDisplayName] =
    useState('');

  const [formSubject, setFormSubject] =
    useState('');

  const [formIsPP, setFormIsPP] =
    useState(false);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        '/api/configuration',
        {
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible de charger la configuration.'
        );
      }

      setSchoolYear(data.schoolYear);
      setClasses(data.classes || []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de charger la configuration.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateCode(
    id: string,
    value: string
  ) {
    setClasses((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              access_code: value,
            }
          : item
      )
    );
  }

  async function saveCodes() {
    setSavingCodes(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        '/api/configuration',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            classes: classes.map((item) => ({
              id: item.id,
              accessCode: item.access_code,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible d’enregistrer les codes.'
        );
      }

      setMessage(
        'Les codes de déverrouillage ont été enregistrés.'
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible d’enregistrer les codes.'
      );
    } finally {
      setSavingCodes(false);
    }
  }

  async function openClass(item: ClassItem) {
    setSelectedClass(item);
    setStudents([]);
    setTeachers([]);
    setLoadingClass(true);
    setError('');

    try {
      const response = await fetch(
        `/api/configuration/classes?classId=${encodeURIComponent(
          item.id
        )}`,
        {
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible de charger la classe.'
        );
      }

      setSelectedClass(data.class);
      setStudents(data.students || []);
      setTeachers(data.teachers || []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de charger la classe.'
      );

      setSelectedClass(null);
    } finally {
      setLoadingClass(false);
    }
  }

  function closeClass() {
    if (saving) return;

    setSelectedClass(null);
    setStudents([]);
    setTeachers([]);

    closeForm();
  }

  function closeForm() {
    setModalMode(null);

    setEditingStudentId(null);
    setEditingTeacherId(null);

    setFormName('');
    setFormLevel('');
    setFormLastName('');
    setFormFirstName('');
    setFormDisplayName('');
    setFormSubject('');
    setFormIsPP(false);
  }

  function openEditClass() {
    if (!selectedClass) return;

    setFormName(selectedClass.name);
    setFormLevel(selectedClass.level || '');

    setModalMode('class');
  }

  function openEditStudent(
    student: Student
  ) {
    setEditingStudentId(student.id);

    setFormLastName(student.last_name);
    setFormFirstName(student.first_name);

    setModalMode('student');
  }

  function openEditTeacher(
    teacher: Teacher
  ) {
    setEditingTeacherId(
      teacher.teacherId
    );

    setFormDisplayName(
      teacher.displayName
    );

    setFormSubject(
      teacher.subject
    );

    setFormIsPP(
      teacher.isPP
    );

    setModalMode('teacher');
  }

  function openAddStudent() {
    setEditingStudentId(null);

    setFormLastName('');
    setFormFirstName('');

    setModalMode('add-student');
  }

  function openAddTeacher() {
    setEditingTeacherId(null);

    setFormDisplayName('');
    setFormSubject('');
    setFormIsPP(false);

    setModalMode('add-teacher');
  }

  async function saveClass() {
    if (!selectedClass) return;

    if (!formName.trim()) {
      setError(
        'Le nom de la classe est obligatoire.'
      );
      return;
    }

    await runSave({
      type: 'class',
      classId: selectedClass.id,
      name: formName.trim(),
      level: formLevel.trim(),
    });
  }

  async function saveStudent() {
    if (!selectedClass) return;

    if (
      !formLastName.trim() ||
      !formFirstName.trim()
    ) {
      setError(
        'Le nom et le prénom sont obligatoires.'
      );
      return;
    }

    if (
      modalMode === 'student' &&
      editingStudentId
    ) {
      await runSave({
        type: 'student',
        studentId: editingStudentId,
        lastName: formLastName.trim(),
        firstName: formFirstName.trim(),
      });

      return;
    }

    await runSave({
      type: 'add-student',
      classId: selectedClass.id,
      lastName: formLastName.trim(),
      firstName: formFirstName.trim(),
    });
  }

  async function saveTeacher() {
    if (!selectedClass) return;

    if (!formDisplayName.trim()) {
      setError(
        'Le nom du professeur est obligatoire.'
      );
      return;
    }

    if (
      modalMode === 'teacher' &&
      editingTeacherId
    ) {
      await runSave({
        type: 'teacher',
        classId: selectedClass.id,
        teacherId: editingTeacherId,
        displayName:
          formDisplayName.trim(),
        subject: formSubject.trim(),
        isPP: formIsPP,
      });

      return;
    }

    await runSave({
      type: 'add-teacher',
      classId: selectedClass.id,
      displayName:
        formDisplayName.trim(),
      subject: formSubject.trim(),
      isPP: formIsPP,
    });
  }

  async function runSave(
    payload: Record<string, unknown>
  ) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        '/api/configuration/classes',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible d’enregistrer.'
        );
      }

      setMessage(
        'Modification enregistrée.'
      );

      closeForm();

      if (selectedClass) {
        await openClass(selectedClass);
      }

      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible d’enregistrer.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(
    student: Student
  ) {
    if (
      !window.confirm(
        `Supprimer ${student.last_name} ${student.first_name} ?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `/api/configuration/classes?type=student&id=${encodeURIComponent(
          student.id
        )}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible de supprimer l’élève.'
        );
      }

      setStudents((current) =>
        current.filter(
          (item) =>
            item.id !== student.id
        )
      );

      setMessage(
        'Élève supprimé.'
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de supprimer l’élève.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeacher(
    teacher: Teacher
  ) {
    if (
      !window.confirm(
        `Retirer ${teacher.displayName} de cette classe ?`
      )
    ) {
      return;
    }

    if (!selectedClass) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `/api/configuration/classes?type=teacher&classId=${encodeURIComponent(
          selectedClass.id
        )}&teacherId=${encodeURIComponent(
          teacher.teacherId
        )}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible de retirer le professeur.'
        );
      }

      setTeachers((current) =>
        current.filter(
          (item) =>
            item.teacherId !==
            teacher.teacherId
        )
      );

      setMessage(
        'Professeur retiré de la classe.'
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de retirer le professeur.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass() {
    if (!selectedClass) return;

    const confirmed =
      window.confirm(
        `Supprimer définitivement la classe « ${selectedClass.name} » ?\n\nLes élèves et les rattachements des professeurs de cette classe seront également supprimés.`
      );

    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `/api/configuration/classes?type=class&id=${encodeURIComponent(
          selectedClass.id
        )}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Impossible de supprimer la classe.'
        );
      }

      setMessage(
        'Classe supprimée.'
      );

      closeClass();

      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de supprimer la classe.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            Configuration · Classes
          </div>

          <h1>
            Gestion des classes
          </h1>

          <div className="kicker">
            Année active :{' '}
            {schoolYear || 'aucune'}.
            Les codes restent indépendants
            des imports du collège.
          </div>
        </div>

        <div className="topbar-right">
          <Link
            className="btn"
            href="/configuration"
          >
            <ArrowLeft size={14} />
            Configuration
          </Link>
        </div>
      </div>

      {(message || error) && (
        <div
          className={`notice ${
            error
              ? 'notice-error'
              : ''
          }`}
          style={{
            marginBottom: 18,
          }}
        >
          {error ? (
            <ShieldCheck size={17} />
          ) : (
            <Check size={17} />
          )}

          <div>
            {error || message}
          </div>
        </div>
      )}

      <section className="card section-card">
        <div className="section-head">
          <div>
            <h2 className="section-title">
              <KeyRound
                size={18}
                style={{
                  verticalAlign: '-3px',
                  marginRight: 8,
                }}
              />
              Codes des conseils de classe
            </h2>

            <p className="section-sub">
              Tu peux changer ces codes à chaque
              conseil. Un import du collège ne les
              efface pas.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={saveCodes}
            disabled={
              savingCodes ||
              loading
            }
          >
            <Save size={14} />

            {savingCodes
              ? 'Enregistrement…'
              : 'Enregistrer les codes'}
          </button>
        </div>

        {loading ? (
          <p className="kicker">
            Chargement…
          </p>
        ) : classes.length ===
          0 ? (
          <p className="kicker">
            Aucune classe active.
          </p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>
                      Classe
                    </th>

                    <th>
                      Niveau
                    </th>

                    <th>
                      Code de déverrouillage
                    </th>

                    <th>
                      Gestion
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {classes.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              item.name
                            }
                          </strong>
                        </td>

                        <td>
                          {item.level ||
                            '—'}
                        </td>

                        <td>
                          <input
                            className="input"
                            style={{
                              maxWidth:
                                220,
                            }}
                            value={
                              item.access_code ||
                              ''
                            }
                            onChange={(
                              e
                            ) =>
                              updateCode(
                                item.id,
                                e.target
                                  .value
                              )
                            }
                            placeholder="Code"
                            inputMode="numeric"
                          />
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                              openClass(
                                item
                              )
                            }
                          >
                            <Pencil
                              size={
                                14
                              }
                            />
                            Modifier
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-list">
              {classes.map(
                (item) => (
                  <article
                    className="class-mobile-card"
                    key={
                      item.id
                    }
                  >
                    <div>
                      <strong>
                        {
                          item.name
                        }
                      </strong>

                      <span>
                        {item.level ||
                          'Niveau non renseigné'}
                      </span>
                    </div>

                    <label>
                      Code de déverrouillage

                      <input
                        className="input"
                        value={
                          item.access_code ||
                          ''
                        }
                        onChange={(
                          e
                        ) =>
                          updateCode(
                            item.id,
                            e.target
                              .value
                          )
                        }
                        placeholder="Code"
                        inputMode="numeric"
                      />
                    </label>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        openClass(
                          item
                        )
                      }
                    >
                      <Pencil
                        size={
                          14
                        }
                      />
                      Modifier la classe
                    </button>
                  </article>
                )
              )}
            </div>
          </>
        )}
      </section>

      {selectedClass && (
        <div
          className="modal-overlay"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeClass();
            }
          }}
        >
          <div className="class-modal">
            <div className="class-modal-header">
              <div>
                <div className="eyebrow">
                  Gestion de la classe
                </div>

                <h2>
                  {
                    selectedClass.name
                  }
                </h2>

                <p>
                  {selectedClass.level ||
                    'Niveau non renseigné'}
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={
                  closeClass
                }
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {loadingClass ? (
              <div className="class-loading">
                Chargement de la classe…
              </div>
            ) : (
              <div className="class-modal-body">
                <section className="manage-section">
                  <div className="manage-section-head">
                    <div>
                      <h3>
                        Classe
                      </h3>

                      <p>
                        Informations générales
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={
                        openEditClass
                      }
                    >
                      <Pencil
                        size={
                          14
                        }
                      />
                      Modifier
                    </button>
                  </div>

                  <div className="class-summary">
                    <strong>
                      {
                        selectedClass.name
                      }
                    </strong>

                    <span>
                      {selectedClass.level ||
                        'Niveau non renseigné'}
                    </span>
                  </div>

                  {(selectedClass.kind !== 'demo' &&
                    selectedClass.name.trim().toUpperCase() !== 'TEST') && (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={
                        deleteClass
                      }
                      disabled={
                        saving
                      }
                    >
                      <Trash2
                        size={
                          15
                        }
                      />
                      Supprimer la classe
                    </button>
                  )}
                </section>

                <section className="manage-section">
                  <div className="manage-section-head">
                    <div>
                      <h3>
                        <Users
                          size={
                            17
                          }
                        />
                        Élèves
                      </h3>

                      <p>
                        {
                          students.length
                        }{' '}
                        élève
                        {students.length >
                        1
                          ? 's'
                          : ''}{' '}
                        dans la classe
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={
                        openAddStudent
                      }
                    >
                      <Plus
                        size={
                          14
                        }
                      />
                      Ajouter un élève
                    </button>
                  </div>

                  {students.length ===
                  0 ? (
                    <div className="empty-management">
                      Aucun élève dans
                      cette classe.
                    </div>
                  ) : (
                    <div className="management-list">
                      {students.map(
                        (
                          student
                        ) => (
                          <div
                            className="management-row"
                            key={
                              student.id
                            }
                          >
                            <div className="person-icon">
                              <UserRound
                                size={
                                  16
                                }
                              />
                            </div>

                            <div className="person-main">
                              <strong>
                                {
                                  student.last_name
                                }{' '}
                                {
                                  student.first_name
                                }
                              </strong>
                            </div>

                            <div className="row-actions">
                              <button
                                type="button"
                                className="small-action"
                                onClick={() =>
                                  openEditStudent(
                                    student
                                  )
                                }
                              >
                                <Pencil
                                  size={
                                    13
                                  }
                                />
                                Modifier
                              </button>

                              <button
                                type="button"
                                className="small-danger"
                                onClick={() =>
                                  deleteStudent(
                                    student
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                <Trash2
                                  size={
                                    13
                                  }
                                />
                                Supprimer
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </section>

                <section className="manage-section">
                  <div className="manage-section-head">
                    <div>
                      <h3>
                        <UserRound
                          size={
                            17
                          }
                        />
                        Professeurs
                      </h3>

                      <p>
                        {
                          teachers.length
                        }{' '}
                        professeur
                        {teachers.length >
                        1
                          ? 's'
                          : ''}{' '}
                        rattaché
                        {teachers.length >
                        1
                          ? 's'
                          : ''}{' '}
                        à cette classe
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={
                        openAddTeacher
                      }
                    >
                      <Plus
                        size={
                          14
                        }
                      />
                      Ajouter un professeur
                    </button>
                  </div>

                  {teachers.length ===
                  0 ? (
                    <div className="empty-management">
                      Aucun professeur dans
                      cette classe.
                    </div>
                  ) : (
                    <div className="management-list">
                      {teachers.map(
                        (
                          teacher
                        ) => (
                          <div
                            className="management-row"
                            key={`${teacher.teacherId}-${teacher.subject}`}
                          >
                            <div className="person-icon">
                              <UserRound
                                size={
                                  16
                                }
                              />
                            </div>

                            <div className="person-main">
                              <strong>
                                {
                                  teacher.displayName
                                }
                              </strong>

                              <span>
                                {teacher.subject ||
                                  'Matière non renseignée'}

                                {teacher.isPP
                                  ? ' · Professeur principal'
                                  : ''}
                              </span>
                            </div>

                            <div className="row-actions">
                              <button
                                type="button"
                                className="small-action"
                                onClick={() =>
                                  openEditTeacher(
                                    teacher
                                  )
                                }
                              >
                                <Pencil
                                  size={
                                    13
                                  }
                                />
                                Modifier
                              </button>

                              <button
                                type="button"
                                className="small-danger"
                                onClick={() =>
                                  deleteTeacher(
                                    teacher
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                <Trash2
                                  size={
                                    13
                                  }
                                />
                                Supprimer
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            <div className="class-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={
                  closeClass
                }
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode && (
        <div className="modal-overlay modal-overlay-front">
          <div className="form-modal">
            <div className="form-modal-header">
              <div>
                <div className="eyebrow">
                  {modalMode ===
                  'class'
                    ? 'Classe'
                    : modalMode ===
                          'student' ||
                        modalMode ===
                          'add-student'
                    ? 'Élève'
                    : 'Professeur'}
                </div>

                <h2>
                  {modalMode ===
                  'class'
                    ? 'Modifier la classe'
                    : modalMode ===
                        'student'
                    ? 'Modifier l’élève'
                    : modalMode ===
                        'teacher'
                    ? 'Modifier le professeur'
                    : modalMode ===
                        'add-student'
                    ? 'Ajouter un élève'
                    : 'Ajouter un professeur'}
                </h2>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={
                  closeForm
                }
                disabled={
                  saving
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="form-modal-body">
              {modalMode ===
              'class' ? (
                <>
                  <label>
                    Nom de la classe

                    <input
                      className="input"
                      value={
                        formName
                      }
                      onChange={(
                        e
                      ) =>
                        setFormName(
                          e.target
                            .value
                        )
                      }
                      autoFocus
                    />
                  </label>

                  <label>
                    Niveau

                    <input
                      className="input"
                      value={
                        formLevel
                      }
                      onChange={(
                        e
                      ) =>
                        setFormLevel(
                          e.target
                            .value
                        )
                      }
                    />
                  </label>
                </>
              ) : null}

              {modalMode ===
                'student' ||
              modalMode ===
                'add-student' ? (
                <>
                  <label>
                    Nom

                    <input
                      className="input"
                      value={
                        formLastName
                      }
                      onChange={(
                        e
                      ) =>
                        setFormLastName(
                          e.target
                            .value
                        )
                      }
                      autoFocus
                    />
                  </label>

                  <label>
                    Prénom

                    <input
                      className="input"
                      value={
                        formFirstName
                      }
                      onChange={(
                        e
                      ) =>
                        setFormFirstName(
                          e.target
                            .value
                        )
                      }
                    />
                  </label>
                </>
              ) : null}

              {modalMode ===
                'teacher' ||
              modalMode ===
                'add-teacher' ? (
                <>
                  <label>
                    Nom et prénom

                    <input
                      className="input"
                      value={
                        formDisplayName
                      }
                      onChange={(
                        e
                      ) =>
                        setFormDisplayName(
                          e.target
                            .value
                        )
                      }
                      autoFocus
                    />
                  </label>

                  <label>
                    Matière

                    <input
                      className="input"
                      value={
                        formSubject
                      }
                      onChange={(
                        e
                      ) =>
                        setFormSubject(
                          e.target
                            .value
                        )
                      }
                    />
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={
                        formIsPP
                      }
                      onChange={(
                        e
                      ) =>
                        setFormIsPP(
                          e.target
                            .checked
                        )
                      }
                    />

                    Professeur principal
                  </label>
                </>
              ) : null}

              {modalMode ===
                'teacher' && (
                <div className="form-help">
                  Le nom du professeur est
                  partagé dans la base Supabase.
                  La modification de son nom
                  met donc à jour son nom partout
                  où ce professeur est utilisé.
                </div>
              )}
            </div>

            <div className="form-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={
                  closeForm
                }
                disabled={
                  saving
                }
              >
                Annuler
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  saving
                }
                onClick={() => {
                  if (
                    modalMode ===
                    'class'
                  ) {
                    void saveClass();
                  } else if (
                    modalMode ===
                      'student' ||
                    modalMode ===
                      'add-student'
                  ) {
                    void saveStudent();
                  } else if (
                    modalMode ===
                      'teacher' ||
                    modalMode ===
                      'add-teacher'
                  ) {
                    void saveTeacher();
                  }
                }}
              >
                <Save size={14} />

                {saving
                  ? 'Enregistrement…'
                  : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .table-wrap {
          overflow-x: auto;
        }

        .mobile-list {
          display: none;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(30, 24, 21, 0.48);
        }

        .modal-overlay-front {
          z-index: 1100;
          background: rgba(30, 24, 21, 0.58);
        }

        .class-modal {
          width: min(920px, 100%);
          max-height: min(88vh, 900px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #eadfd4;
          border-radius: 18px;
          background: #fffdf9;
          box-shadow: 0 24px 70px rgba(30, 24, 21, 0.22);
        }

        .class-modal-header,
        .form-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding: 22px 24px;
          border-bottom: 1px solid #eadfd4;
        }

        .class-modal-header h2,
        .form-modal-header h2 {
          margin: 2px 0 0;
          color: #302b27;
          font-size: 23px;
        }

        .class-modal-header p {
          margin: 5px 0 0;
          color: #756a67;
          font-size: 13px;
        }

        .icon-button {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid #eadfd4;
          border-radius: 10px;
          background: #fff;
          color: #5f514b;
          cursor: pointer;
        }

        .icon-button:hover {
          border-color: #8f211c;
          color: #8f211c;
        }

        .class-modal-body {
          overflow-y: auto;
          padding: 20px 24px;
          display: grid;
          gap: 18px;
        }

        .manage-section {
          padding: 18px;
          border: 1px solid #eadfd4;
          border-radius: 14px;
          background: #fff;
        }

        .manage-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
        }

        .manage-section-head h3 {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0;
          color: #302b27;
          font-size: 16px;
        }

        .manage-section-head p {
          margin: 4px 0 0;
          color: #756a67;
          font-size: 12px;
        }

        .class-summary {
          display: grid;
          gap: 3px;
          padding: 12px 14px;
          margin-bottom: 12px;
          border-radius: 10px;
          background: #fff8f0;
        }

        .class-summary strong {
          color: #302b27;
          font-size: 14px;
        }

        .class-summary span {
          color: #756a67;
          font-size: 12px;
        }

        .danger-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 12px;
          border: 1px solid #e3bdb9;
          border-radius: 9px;
          background: #fff8f7;
          color: #8f211c;
          font-weight: 700;
          cursor: pointer;
        }

        .danger-button:hover {
          background: #fff0ee;
          border-color: #8f211c;
        }

        .management-list {
          display: grid;
          gap: 8px;
        }

        .management-row {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border: 1px solid #eee5dc;
          border-radius: 10px;
          background: #fffdf9;
        }

        .person-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #fff0d9;
          color: #8f211c;
        }

        .person-main {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .person-main strong {
          color: #302b27;
          font-size: 13px;
        }

        .person-main span {
          color: #756a67;
          font-size: 11px;
        }

        .row-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .small-action,
        .small-danger {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 34px;
          padding: 0 9px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: #fff;
        }

        .small-action {
          border: 1px solid #dccbc2;
          color: #5f514b;
        }

        .small-action:hover {
          border-color: #8f211c;
          color: #8f211c;
        }

        .small-danger {
          border: 1px solid #e3bdb9;
          color: #8f211c;
        }

        .small-danger:hover {
          background: #fff3f1;
          border-color: #8f211c;
        }

        .class-modal-footer,
        .form-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 24px;
          border-top: 1px solid #eadfd4;
          background: #fffdf9;
        }

        .class-loading {
          padding: 50px 24px;
          text-align: center;
          color: #756a67;
        }

        .empty-management {
          padding: 18px;
          border: 1px dashed #d9cbc1;
          border-radius: 10px;
          color: #756a67;
          font-size: 13px;
          text-align: center;
        }

        .form-modal {
          width: min(520px, 100%);
          max-height: min(86vh, 720px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #eadfd4;
          border-radius: 18px;
          background: #fffdf9;
          box-shadow: 0 24px 70px rgba(30, 24, 21, 0.24);
        }

        .form-modal-body {
          overflow-y: auto;
          display: grid;
          gap: 15px;
          padding: 20px 24px;
        }

        .form-modal-body label {
          display: grid;
          gap: 7px;
          color: #5f514b;
          font-size: 12px;
          font-weight: 700;
        }

        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 8px !important;
          cursor: pointer;
        }

        .checkbox-label input {
          width: 17px;
          height: 17px;
          accent-color: #8f211c;
        }

        .form-help {
          padding: 11px 12px;
          border-radius: 9px;
          background: #fff8f0;
          color: #756a67;
          font-size: 11px;
          line-height: 1.5;
        }

        @media (max-width: 760px) {
          .table-wrap {
            display: none;
          }

          .mobile-list {
            display: grid;
            gap: 10px;
            padding: 12px 0 0;
          }

          .class-mobile-card {
            display: grid;
            gap: 12px;
            padding: 14px;
            border: 1px solid #eadfd4;
            border-radius: 12px;
            background: #fff;
          }

          .class-mobile-card > div {
            display: grid;
            gap: 3px;
          }

          .class-mobile-card strong {
            color: #302b27;
            font-size: 14px;
          }

          .class-mobile-card span {
            color: #756a67;
            font-size: 12px;
          }

          .class-mobile-card label {
            display: grid;
            gap: 6px;
            color: #5f514b;
            font-size: 11px;
            font-weight: 700;
          }

          .modal-overlay {
            align-items: flex-start;
            padding: 10px;
          }

          .class-modal,
          .form-modal {
            max-height: calc(100dvh - 20px);
            border-radius: 15px;
          }

          .class-modal-header,
          .form-modal-header {
            padding: 16px;
          }

          .class-modal-header h2,
          .form-modal-header h2 {
            font-size: 20px;
          }

          .class-modal-body {
            padding: 12px;
          }

          .manage-section {
            padding: 14px;
          }

          .manage-section-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .manage-section-head .btn {
            width: 100%;
          }

          .management-row {
            grid-template-columns: 34px minmax(0, 1fr);
          }

          .row-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .small-action,
          .small-danger {
            justify-content: center;
            width: 100%;
          }

          .class-modal-footer,
          .form-modal-footer {
            padding: 12px 16px;
          }

          .form-modal-body {
            padding: 16px;
          }
        }

        @media (max-width: 430px) {
          .row-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
