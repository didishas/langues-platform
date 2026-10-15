'use client'

import { usePathname } from 'next/navigation'

import { LOCALES, type Locale } from '@/i18n/config'

/** Garde la même page en changeant seulement la langue de l'interface. */
export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname() ?? `/${current}`
  const rest = pathname.replace(/^\/(fr|en|he)(?=\/|$)/, '')

  return (
    <nav aria-label={label} className="locale-switcher">
      <ul>
        {LOCALES.map((l) => (
          <li key={l.code}>
            <a
              href={`/${l.code}${rest}`}
              lang={l.code}
              dir={l.dir}
              hrefLang={l.code}
              aria-current={l.code === current ? 'true' : undefined}
            >
              {l.code === 'he' ? 'עב' : l.code.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
