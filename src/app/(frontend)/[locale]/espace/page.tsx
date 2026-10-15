import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StudentNav } from '@/components/student/StudentNav'
import { isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { formatDate, requireStudent } from '@/lib/student'
import { getAssignmentRows, getUpcomingSessions } from '@/lib/studentData'

export const metadata = { robots: { index: false } }

export default async function StudentHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const student = await requireStudent(locale)
  const t = getStudentDictionary(locale)
  const [sessions, rows] = await Promise.all([getUpcomingSessions(student), getAssignmentRows(student)])

  const todo = rows.filter((r) => r.status === 'todo' || r.status === 'returned')
  const corrected = rows
    .filter((r) => r.status === 'corrected')
    .sort((a, b) => (b.submission?.correctedAt ?? '').localeCompare(a.submission?.correctedAt ?? ''))
    .slice(0, 3)

  return (
    <>
      <StudentNav locale={locale} t={t} current="home" name={student.firstName} />
      <div className="wrap student-page">
        <section aria-labelledby="seances">
          <h2 id="seances">{t.home.nextSessions}</h2>
          {sessions.length === 0 ? (
            <p className="muted">{t.home.noSessions}</p>
          ) : (
            <ul className="rows">
              {sessions.map((s) => (
                <li key={s.bookingId} className="row">
                  <div>
                    <p className="row__title">{formatDate(s.slot.start, locale, true)}</p>
                    {!s.confirmed ? <p className="row__meta">{t.home.pending}</p> : null}
                  </div>
                  {s.meetingUrl ? (
                    <a className="button" href={s.meetingUrl} target="_blank" rel="noopener noreferrer">
                      {s.visioTool ? t.home.joinTool[s.visioTool] : t.home.join}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="a-rendre">
          <h2 id="a-rendre">{t.home.todo}</h2>
          {todo.length === 0 ? (
            <p className="muted">{t.home.noTodo}</p>
          ) : (
            <ul className="rows">
              {todo.map((r) => (
                <li key={r.assignment.id} className="row">
                  <div>
                    <p className="row__title">
                      <Link href={`/${locale}/espace/devoirs/${r.assignment.id}`} dir="auto">{r.assignment.title}</Link>
                    </p>
                    <p className="row__meta">
                      {r.assignment.dueDate
                        ? `${t.assignments.due} ${formatDate(r.assignment.dueDate, locale)}`
                        : t.assignments.noDue}
                    </p>
                  </div>
                  <span className={`tag tag--${r.status}`}>{t.assignments.status[r.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {corrected.length > 0 ? (
          <section aria-labelledby="corrections">
            <h2 id="corrections">{t.home.corrections}</h2>
            <ul className="rows">
              {corrected.map((r) => (
                <li key={r.assignment.id} className="row">
                  <p className="row__title">
                    <Link href={`/${locale}/espace/devoirs/${r.assignment.id}`} dir="auto">{r.assignment.title}</Link>
                  </p>
                  {r.submission?.grade ? <span className="tag tag--corrected">{r.submission.grade}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  )
}
