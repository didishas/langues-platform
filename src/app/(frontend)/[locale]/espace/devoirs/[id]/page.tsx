import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StudentNav } from '@/components/student/StudentNav'
import { SubmitForm } from '@/components/student/SubmitForm'
import { contentDir, isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { requireStudent } from '@/lib/student'
import { formatSessionTime } from '@/lib/time'
import { getAssignment } from '@/lib/studentData'
import type { Document, Language, SubmissionFile } from '@/payload-types'

export const metadata = { robots: { index: false } }

export default async function AssignmentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  if (!isLocale(locale) || !/^\d+$/.test(id)) notFound()
  const student = await requireStudent(locale)
  const t = getStudentDictionary(locale)
  const found = await getAssignment(student, Number(id))
  if (!found) notFound()
  const { assignment, submission } = found

  const language = typeof assignment.language === 'object' ? (assignment.language as Language) : null
  const dir = contentDir(language?.code)
  const attachments = (assignment.attachments ?? []).filter((d): d is Document => typeof d === 'object')
  const status = submission?.status ?? 'todo'
  const canSubmit = !submission || submission.status === 'returned'
  // Échéance à l'heure de l'élève, puis à celle de Bruxelles si elle diffère.
  const due = assignment.dueDate ? formatSessionTime(assignment.dueDate, locale, student.timeZone, t.home.brussels) : null
  const files = (submission?.files ?? []).filter((f): f is SubmissionFile => typeof f === 'object')

  return (
    <>
      <StudentNav locale={locale} t={t} current="assignments" name={student.firstName} />
      <article className="wrap student-page">
        <p>
          <Link href={`/${locale}/espace/devoirs`}>{t.assignments.back}</Link>
        </p>
        <h1 dir="auto">{assignment.title}</h1>
        <p className="row__meta">
          <span>{t.assignments.kind[assignment.kind]}</span>
          {language ? <span>{language.name}</span> : null}
          <span>
            {due ? `${t.assignments.due} ${due.local}${due.brussels ? ` · ${due.brussels}` : ''}` : t.assignments.noDue}
          </span>
          <span className={`tag tag--${status}`}>{t.assignments.status[status]}</span>
        </p>

        {assignment.instructions ? (
          <section aria-labelledby="consignes">
            <h2 id="consignes">{t.assignments.instructions}</h2>
            <div className="prose panel" dir={dir} lang={language?.code}>
              <RichText data={assignment.instructions} />
            </div>
          </section>
        ) : null}

        {attachments.length > 0 ? (
          <section aria-labelledby="joints">
            <h2 id="joints">{t.assignments.attachments}</h2>
            <ul className="rows">
              {attachments.map((d) => (
                <li key={d.id} className="row">
                  <p className="row__title">{d.title}</p>
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer">
                      {t.documents.open}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {submission && (submission.feedback || submission.grade) ? (
          <section aria-labelledby="correction">
            <h2 id="correction">{t.assignments.feedback}</h2>
            <div className="panel panel--peach">
              {submission.grade ? (
                <p>
                  <strong>{t.assignments.grade}</strong> {submission.grade}
                </p>
              ) : null}
              {submission.feedback?.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        ) : null}

        {submission && !canSubmit ? (
          <section aria-labelledby="ma-reponse">
            <h2 id="ma-reponse">{t.assignments.yourAnswer}</h2>
            {submission.text ? (
              <div className="panel" dir={dir} lang={language?.code}>
                {submission.text.split(/\n\s*\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : null}
            {files.length > 0 ? (
              <ul className="file-list">
                {files.map((f) =>
                  f.url ? (
                    <li key={f.id}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        {f.filename}
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
          </section>
        ) : null}

        {canSubmit ? (
          <section aria-labelledby="rendre">
            <h2 id="rendre">{submission ? t.assignments.resubmit : t.assignments.submit}</h2>
            <SubmitForm
              locale={locale}
              assignmentId={assignment.id}
              answerDir={dir}
              answerLang={language?.code}
              initialText={submission?.text ?? undefined}
              isResubmission={Boolean(submission)}
              t={t.assignments}
            />
          </section>
        ) : null}
      </article>
    </>
  )
}
