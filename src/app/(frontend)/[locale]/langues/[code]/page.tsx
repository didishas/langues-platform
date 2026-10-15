import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { contentDir, isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/dictionaries'
import { formatPrice, getLanguageByCode, getOffers } from '@/lib/content'
import type { Language } from '@/payload-types'

type Params = Promise<{ locale: string; code: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, code } = await params
  if (!isLocale(locale)) return {}
  const language = await getLanguageByCode(locale, code)
  return language ? { title: language.name, description: language.summary ?? undefined } : {}
}

export default async function LanguagePage({ params }: { params: Params }) {
  const { locale, code } = await params
  if (!isLocale(locale)) notFound()
  const language = await getLanguageByCode(locale, code)
  if (!language) notFound()
  const t = getDictionary(locale)

  const offers = (await getOffers(locale)).filter((o) => {
    const langs = (o.languages ?? []).map((l) => (typeof l === 'object' ? (l as Language).id : l))
    return langs.length === 0 || langs.includes(language.id)
  })

  return (
    <article className="band">
      <div className="wrap language-page">
        <p>
          <Link href={`/${locale}#langues`}>{t.languages.back}</Link>
        </p>
        <p className="language-page__native" lang={language.code} dir={contentDir(language.code)}>
          {language.nativeName ?? language.name}
        </p>
        <h1>{language.name}</h1>
        {language.summary ? <p className="hero__lead">{language.summary}</p> : null}
        {language.sample ? (
          <p className="language-page__sample" lang={language.code} dir={contentDir(language.code)}>
            {language.sample}
          </p>
        ) : null}
        {language.description ? (
          <div className="prose">
            <RichText data={language.description} />
          </div>
        ) : null}

        {offers.length > 0 ? (
          <section aria-labelledby="formules-langue">
            <h2 id="formules-langue">{t.prices.title}</h2>
            <ul className="price-list">
              {offers.map((o) => (
                <li key={o.id} className="price">
                  <div className="price__main">
                    <p className="price__title">{o.title}</p>
                    <p className="price__meta">
                      <span>{t.prices.formats[o.format]}</span>
                      {o.kind !== 'per_unit' && o.durationMinutes ? (
                        <span>
                          {o.durationMinutes} {t.prices.minutes}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className="price__amount">
                    <span className="price__value">{formatPrice(o.priceCents, locale)}</span>
                    <span className="price__per">
                      {o.kind === 'per_unit' ? `${t.prices.per.per_unit} ${o.unitLabel ?? ''}`.trim() : t.prices.per[o.kind]}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p>
          <a className="button" href={`/${locale}#essai`}>
            {t.hero.cta}
          </a>
        </p>
      </div>
    </article>
  )
}
