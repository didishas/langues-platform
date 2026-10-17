import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StudentNav } from '@/components/student/StudentNav'
import { listVideosForStudent } from '@/exercises/service'
import { isLocale } from '@/i18n/config'
import { fill } from '@/i18n/format'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { payloadClient } from '@/lib/content'
import { requireStudent } from '@/lib/student'

export const metadata = { robots: { index: false } }

export default async function VideosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const student = await requireStudent(locale)
  const t = getStudentDictionary(locale)
  const videos = await listVideosForStudent(await payloadClient(), student)

  return (
    <>
      <StudentNav locale={locale} t={t} current="videos" name={student.firstName} />
      <div className="wrap student-page">
        <div>
          <h1>{t.videos.title}</h1>
          <p className="muted">{t.videos.intro}</p>
        </div>
        {videos.length === 0 ? (
          <p className="muted">{t.videos.empty}</p>
        ) : (
          <ul className="rows">
            {videos.map((v) => (
              <li key={v.id} className="row">
                <div>
                  <p className="row__title">
                    <Link href={`/${locale}/espace/videos/${v.id}`} dir="auto">
                      {v.title}
                    </Link>
                  </p>
                  <p className="row__meta">
                    {v.language ? <span>{v.language.name}</span> : null}
                    {v.level ? <span>{v.level}</span> : null}
                    {v.exerciseCount > 0 ? (
                      <span>{v.exerciseCount === 1 ? t.videos.exerciseOne : fill(t.videos.exerciseMany, { n: v.exerciseCount })}</span>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
