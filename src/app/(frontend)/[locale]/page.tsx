import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TrialForm } from '@/components/TrialForm'
import { contentDir, isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/dictionaries'
import { formatPrice, getDiscounts, getLanguages, getOffers, getSiteSettings } from '@/lib/content'
import type { Language, Offer } from '@/payload-types'

const FORMAT_ORDER = ['individual', 'group', 'parent_child'] as const

/** Une phrase découpée mot à mot : chaque mot apparaît à son tour au chargement. */
function WordByWord({ text, offset }: { text: string; offset: number }) {
  return text.split(/\s+/).map((word, i) => (
    <span key={i} className="word" style={{ ['--i' as string]: offset + i }}>
      {word}{' '}
    </span>
  ))
}

function languageNames(offer: Offer, all: string) {
  const langs = (offer.languages ?? []).filter((l): l is Language => typeof l === 'object')
  return langs.length ? langs.map((l) => l.name).join(', ') : all
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const [site, languages, offers, discounts] = await Promise.all([
    getSiteSettings(locale),
    getLanguages(locale),
    getOffers(locale),
    getDiscounts(locale),
  ])

  const greetings = languages.filter((l) => l.sample)
  let wordIndex = 0

  return (
    <>
      <section className="hero">
        <div className="wrap hero__grid">
          <div className="hero__text">
            {site.tagline ? <p className="hero__tagline">{site.tagline}</p> : null}
            <h1>{site.heroTitle ?? site.siteName}</h1>
            {site.heroText ? <p className="hero__lead">{site.heroText}</p> : null}
            <div className="hero__actions">
              {site.trialLessonEnabled !== false ? (
                <a className="button" href="#essai">
                  {t.hero.cta}
                </a>
              ) : null}
              <a className="button button--quiet" href="#tarifs">
                {t.hero.secondary}
              </a>
            </div>
          </div>

          {greetings.length > 0 ? (
            <ul className="greetings" aria-label={t.languages.title}>
              {greetings.map((l) => {
                const offset = wordIndex
                wordIndex += (l.sample ?? '').split(/\s+/).length
                return (
                  <li key={l.id} className="greetings__item" lang={l.code} dir={contentDir(l.code)}>
                    <WordByWord text={l.sample!} offset={offset} />
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </section>

      <section id="langues" className="band band--peach" aria-labelledby="langues-titre">
        <div className="wrap">
          <h2 id="langues-titre">{t.languages.title}</h2>
          {languages.length === 0 ? (
            <p>{t.languages.empty}</p>
          ) : (
            <ul className="entries">
              {languages.map((l) => (
                <li key={l.id} className="entry">
                  <p className="entry__native" lang={l.code} dir={contentDir(l.code)}>
                    {l.nativeName ?? l.name}
                  </p>
                  <div className="entry__body">
                    <h3>{l.name}</h3>
                    {l.summary ? <p>{l.summary}</p> : null}
                  </div>
                  <Link className="entry__link" href={`/${locale}/langues/${l.code}`}>
                    {t.languages.more}
                    <span className="visually-hidden"> : {l.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="tarifs" className="band" aria-labelledby="tarifs-titre">
        <div className="wrap">
          <h2 id="tarifs-titre">{t.prices.title}</h2>
          {offers.length === 0 ? (
            <p>{t.prices.empty}</p>
          ) : (
            <div className="price-groups">
              {FORMAT_ORDER.map((format) => {
                const list = offers.filter((o) => o.format === format)
                if (list.length === 0) return null
                return (
                  <section key={format} className="price-group" aria-labelledby={`format-${format}`}>
                    <h3 id={`format-${format}`}>{t.prices.formats[format]}</h3>
                    <ul className="price-list">
                      {list.map((o) => (
                        <li key={o.id} className="price">
                          <div className="price__main">
                            <p className="price__title">{o.title}</p>
                            <p className="price__meta">
                              <span>{languageNames(o, t.prices.allLanguages)}</span>
                              {o.kind !== 'per_unit' && o.durationMinutes ? (
                                <span>
                                  {o.durationMinutes} {t.prices.minutes}
                                </span>
                              ) : null}
                              {o.sessionsCount ? (
                                <span>
                                  {o.sessionsCount} {t.prices.sessions}
                                </span>
                              ) : null}
                            </p>
                            {o.focus ? <p className="price__focus">{o.focus}</p> : null}
                            {o.description ? <p className="price__desc">{o.description}</p> : null}
                          </div>
                          <p className="price__amount">
                            <span className="price__value">{formatPrice(o.priceCents, locale)}</span>
                            <span className="price__per">
                              {o.kind === 'per_unit'
                                ? `${t.prices.per.per_unit} ${o.unitLabel ?? ''}`.trim()
                                : t.prices.per[o.kind]}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}

          {discounts.length > 0 ? (
            <div className="discounts">
              <h3>{t.prices.discountsTitle}</h3>
              <ul>
                {discounts.map((d) => (
                  <li key={d.id}>
                    <strong>{d.title}</strong>
                    {d.description ? <span> {d.description}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="band band--ink" aria-labelledby="etapes-titre">
        <div className="wrap">
          <h2 id="etapes-titre">{t.steps.title}</h2>
          <ol className="steps">
            {t.steps.items.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {site.aboutText ? (
        <section id="a-propos" className="band" aria-labelledby="apropos-titre">
          <div className="wrap about">
            <h2 id="apropos-titre">{site.aboutTitle ?? t.about.title}</h2>
            {site.aboutText.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      ) : null}

      {site.faq && site.faq.length > 0 ? (
        <section id="questions" className="band band--peach-soft" aria-labelledby="faq-titre">
          <div className="wrap faq">
            <h2 id="faq-titre">{t.faq.title}</h2>
            {site.faq.map((f) => (
              <details key={f.id ?? f.question}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {site.trialLessonEnabled !== false ? (
        <section id="essai" className="band" aria-labelledby="essai-titre">
          <div className="wrap trial">
            <div>
              <h2 id="essai-titre">{t.trial.title}</h2>
              <p>{t.trial.intro}</p>
            </div>
            <TrialForm
              locale={locale}
              t={t.trial}
              languages={languages.map((l) => ({ id: l.id, name: l.name }))}
              privacyHref={`/${locale}/confidentialite`}
            />
          </div>
        </section>
      ) : null}
    </>
  )
}
