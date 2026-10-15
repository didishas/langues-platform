import { notFound } from 'next/navigation'

import { StudentNav } from '@/components/student/StudentNav'
import { isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { requireStudent } from '@/lib/student'
import { getDocuments } from '@/lib/studentData'
import type { Language } from '@/payload-types'

export const metadata = { robots: { index: false } }

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const student = await requireStudent(locale)
  const t = getStudentDictionary(locale)
  const docs = await getDocuments(student)

  return (
    <>
      <StudentNav locale={locale} t={t} current="documents" name={student.firstName} />
      <div className="wrap student-page">
        <h1>{t.documents.title}</h1>
        {docs.length === 0 ? (
          <p className="muted">{t.documents.empty}</p>
        ) : (
          <ul className="rows">
            {docs.map((d) => (
              <li key={d.id} className="row">
                <div>
                  <p className="row__title" dir="auto">
                    {d.title}
                  </p>
                  <p className="row__meta">
                    {typeof d.language === 'object' && d.language ? <span>{(d.language as Language).name}</span> : null}
                    {d.note ? <span>{d.note}</span> : null}
                  </p>
                </div>
                {d.url ? (
                  <a className="button button--quiet button--small" href={d.url} target="_blank" rel="noopener noreferrer">
                    {t.documents.open}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
