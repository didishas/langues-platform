import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ExerciseCard } from '@/components/student/exercises/ExerciseCard'
import { StudentNav } from '@/components/student/StudentNav'
import { latestAttempts, loadVideoForStudent } from '@/exercises/service'
import { contentDir, isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { payloadClient } from '@/lib/content'
import { requireStudent } from '@/lib/student'

export const metadata = { robots: { index: false } }

export default async function VideoPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  if (!isLocale(locale) || !/^\d+$/.test(id)) notFound()
  const student = await requireStudent(locale)
  const t = getStudentDictionary(locale)
  const payload = await payloadClient()
  const loaded = await loadVideoForStudent(payload, student, Number(id))
  if (!loaded) notFound()
  // Seule la version sans solution (`exercises`) part vers le navigateur ; `configs` reste ici.
  const { video, language, exercises } = loaded
  const latest = exercises.length > 0 ? await latestAttempts(payload, student, video.id) : {}
  const dir = contentDir(language?.code)

  return (
    <>
      <StudentNav locale={locale} t={t} current="videos" name={student.firstName} />
      <article className="wrap student-page video-page">
        <p>
          <Link href={`/${locale}/espace/videos`}>{t.videos.back}</Link>
        </p>
        <div>
          <h1 dir="auto">{video.title}</h1>
          <p className="row__meta">
            {language ? <span>{language.name}</span> : null}
            {video.level ? <span>{video.level}</span> : null}
          </p>
        </div>

        {video.url ? (
          <div className="video-frame">
            <video controls preload="metadata" playsInline src={video.url}>
              {t.videos.noSupport}
            </video>
          </div>
        ) : null}

        {video.description ? (
          <div className="prose" dir={dir} lang={language?.code}>
            <RichText data={video.description} />
          </div>
        ) : null}

        {exercises.length > 0 ? (
          <section aria-labelledby="exercices">
            <h2 id="exercices">{t.videos.exercisesTitle}</h2>
            <ol className="exercises">
              {exercises.map((ex, i) => (
                <li key={ex.id}>
                  <ExerciseCard
                    locale={locale}
                    videoId={video.id}
                    exercise={ex}
                    index={i + 1}
                    contentDir={dir}
                    contentLang={language?.code ?? undefined}
                    latest={latest[ex.id] ?? null}
                    t={t.videos}
                  />
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>
    </>
  )
}
