import Link from 'next/link'
import { notFound } from 'next/navigation'

import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/dictionaries'

export default async function PaymentThanksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale).payment

  return (
    <article className="band">
      <div className="wrap prose">
        <h1>{t.thanksTitle}</h1>
        <p>{t.thanksText}</p>
        <p>
          <Link className="button" href={`/${locale}`}>
            {t.home}
          </Link>
        </p>
      </div>
    </article>
  )
}
