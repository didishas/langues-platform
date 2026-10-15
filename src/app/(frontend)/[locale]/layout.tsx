import '@fontsource-variable/rubik/index.css'
import '../styles.css'

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { isLocale, LOCALES, uiDir, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/dictionaries'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { getSiteSettings } from '@/lib/content'

export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return LOCALES.map((l) => ({ locale: l.code }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const site = await getSiteSettings(locale)
  return {
    title: { default: site.siteName, template: `%s · ${site.siteName}` },
    description: site.tagline ?? undefined,
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()
  const locale: Locale = raw
  const t = getDictionary(locale)
  const site = await getSiteSettings(locale)

  return (
    <html lang={locale} dir={uiDir(locale)}>
      <body>
        <a className="skip-link" href="#contenu">
          {locale === 'he' ? 'דילוג לתוכן' : locale === 'en' ? 'Skip to content' : 'Aller au contenu'}
        </a>
        <header className="site-header">
          <div className="wrap site-header__inner">
            <Link href={`/${locale}`} className="wordmark" aria-label={site.siteName}>
              <span lang="fr" dir="ltr">
                Mot<span className="wordmark__a">à</span>Mot
              </span>
            </Link>
            <nav aria-label={t.nav.languages} className="site-nav">
              <a href={`/${locale}#langues`}>{t.nav.languages}</a>
              <a href={`/${locale}#tarifs`}>{t.nav.prices}</a>
              {site.aboutText ? <a href={`/${locale}#a-propos`}>{t.nav.about}</a> : null}
              {site.trialLessonEnabled !== false ? (
                <a href={`/${locale}#essai`} className="site-nav__cta">
                  {t.nav.trial}
                </a>
              ) : null}
              <a href={`/${locale}/espace`} className="site-nav__space">
                {getStudentDictionary(locale).navLink}
              </a>
            </nav>
            <LocaleSwitcher current={locale} label={t.localeSwitcher} />
          </div>
        </header>
        <main id="contenu">{children}</main>
        <footer className="site-footer">
          <div className="wrap site-footer__inner">
            <p className="wordmark wordmark--small">
              <span lang="fr" dir="ltr">
                Mot<span className="wordmark__a">à</span>Mot
              </span>
            </p>
            {site.contactEmail ? (
              <p>
                {t.footer.contact} : <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
              </p>
            ) : null}
            <p>
              <Link href={`/${locale}/confidentialite`}>{t.footer.privacy}</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
