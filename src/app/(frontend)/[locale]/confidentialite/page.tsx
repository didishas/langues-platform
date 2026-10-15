import { notFound } from 'next/navigation'

import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/dictionaries'
import { getSiteSettings } from '@/lib/content'

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const site = await getSiteSettings(locale)

  return (
    <article className="band">
      <div className="wrap prose">
        <h1>{t.privacy.title}</h1>
        {(site.privacyText ?? '').split(/\n\s*\n/).filter(Boolean).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  )
}
