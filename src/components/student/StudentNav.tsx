import Link from 'next/link'

import { logoutStudent } from '@/app/(frontend)/[locale]/espace/actions'
import type { Locale } from '@/i18n/config'
import type { StudentDictionary } from '@/i18n/studentDictionaries'

type Section = 'home' | 'assignments' | 'videos' | 'documents' | 'invoices'

const PATHS: Record<Section, string> = {
  home: '',
  assignments: '/devoirs',
  videos: '/videos',
  documents: '/documents',
  invoices: '/factures',
}

/** Navigation de l'espace élève ; la page courante est signalée aux lecteurs d'écran. */
export function StudentNav({
  locale,
  t,
  current,
  name,
}: {
  locale: Locale
  t: StudentDictionary
  current: Section
  name: string
}) {
  return (
    <div className="student-bar">
      <div className="wrap student-bar__inner">
        <p className="student-bar__hello">
          {t.home.hello} {name}
        </p>
        <nav aria-label={t.navLink} className="student-nav">
          {(Object.keys(PATHS) as Section[]).map((key) => (
            <Link
              key={key}
              href={`/${locale}/espace${PATHS[key]}`}
              aria-current={key === current ? 'page' : undefined}
            >
              {t.nav[key]}
            </Link>
          ))}
        </nav>
        <form action={logoutStudent}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="button button--quiet button--small">
            {t.logout}
          </button>
        </form>
      </div>
    </div>
  )
}
