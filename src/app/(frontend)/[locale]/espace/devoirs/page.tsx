import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StudentNav } from '@/components/student/StudentNav'
import { isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { formatDate, requireStudent } from '@/lib/student'
import { getAssignmentRows } from '@/lib/studentData'

export const metadata = { robots: { index: false } }

export default async function AssignmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const student = await requireStudent(locale)
  const t = getStudentDictionary(locale)
  const rows = await getAssignmentRows(student)

  return (
    <>
      <StudentNav locale={locale} t={t} current="assignments" name={student.firstName} />
      <div className="wrap student-page">
        <h1>{t.assignments.title}</h1>
        {rows.length === 0 ? (
          <p className="muted">{t.assignments.empty}</p>
        ) : (
          <ul className="rows">
            {rows.map((r) => (
              <li key={r.assignment.id} className="row">
                <div>
                  <p className="row__title">
                    <Link href={`/${locale}/espace/devoirs/${r.assignment.id}`} dir="auto">{r.assignment.title}</Link>
                  </p>
                  <p className="row__meta">
                    <span>{t.assignments.kind[r.assignment.kind]}</span>
                    {r.language ? <span>{r.language.name}</span> : null}
                    <span>
                      {r.assignment.dueDate
                        ? `${t.assignments.due} ${formatDate(r.assignment.dueDate, locale)}`
                        : t.assignments.noDue}
                    </span>
                  </p>
                </div>
                <span className={`tag tag--${r.status}`}>{t.assignments.status[r.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
