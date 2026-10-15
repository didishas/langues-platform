import { notFound, redirect } from 'next/navigation'

import { LoginForm } from '@/components/student/LoginForm'
import { isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { getCurrentStudent } from '@/lib/student'

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  if (await getCurrentStudent()) redirect(`/${locale}/espace`)
  const t = getStudentDictionary(locale).login

  return (
    <section className="band">
      <div className="wrap login">
        <div>
          <h1>{t.title}</h1>
          <p className="hero__lead">{t.intro}</p>
        </div>
        <LoginForm locale={locale} t={t} />
      </div>
    </section>
  )
}
