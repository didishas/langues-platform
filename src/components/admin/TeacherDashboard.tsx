import type { I18nClient } from '@payloadcms/translations'
import type { Payload, TypedUser } from 'payload'
import type { ReactNode } from 'react'

import {
  dashboardText,
  dateLabel,
  hoursLabel,
  money,
  monthLabel,
  toAdminLocale,
  type AdminLocale,
  type DashboardText,
} from '@/dashboard/i18n'
import { loadDashboard } from '@/dashboard/load'
import type { Dashboard } from '@/dashboard/metrics'

type Props = { payload: Payload; user?: TypedUser | null; i18n?: I18nClient }

/** Tableau de bord de Catherine, affiché en haut de l'accueil de l'administration. */
export async function TeacherDashboard({ payload, user, i18n }: Props) {
  if (!user || user.collection !== 'users') return null
  const locale = toAdminLocale(i18n?.language)
  const loaded = await loadDashboard(payload, user, locale)
  if (!loaded) return null
  const { dashboard: d, languageNames } = loaded
  const t = dashboardText(locale)
  const admin = payload.config.routes.admin

  return (
    <section className="mm-dash" aria-labelledby="mm-dash-title">
      <header className="mm-dash__head">
        <h2 id="mm-dash-title">{t.title}</h2>
        <p className="mm-dash__muted">
          {t.asOf} {dateLabel(new Date(), locale)}
        </p>
      </header>

      <div className="mm-dash__tiles">
        <Tile
          label={t.money.collectedThisMonth}
          value={money(d.money.collectedThisMonth, locale)}
          hint={t.money.vsLastMonth(money(d.money.collectedLastMonth, locale), monthLabel(d.money.collectedByMonth.at(-2)!.month, locale, 'long'))}
        />
        <Tile
          label={t.money.toCollect}
          value={money(d.money.toCollectCents, locale)}
          hint={t.money.invoices(d.money.toCollectCount)}
        />
        {d.money.overdue.length > 0 ? (
          <Tile
            label={t.money.overdue}
            value={money(d.money.overdueCents, locale)}
            hint={t.money.invoices(d.money.overdue.length)}
            status="warning"
          />
        ) : (
          <Tile label={t.money.overdue} value="0" hint={t.money.overdueNone} />
        )}
        {d.money.taxReserveCents != null ? (
          <Tile
            label={t.money.reserve}
            value={money(d.money.taxReserveCents, locale)}
            hint={t.money.reserveHint(d.money.taxReservePercent!, d.money.year)}
          />
        ) : null}
      </div>

      <div className="mm-dash__grid">
        <section className="mm-dash__card mm-dash__card--wide" aria-labelledby="mm-by-month">
          <h3 id="mm-by-month">{t.money.byMonth}</h3>
          <p className="mm-dash__muted">{t.money.byMonthHint}</p>
          <MonthColumns data={d.money.collectedByMonth} locale={locale} />
          <details className="mm-dash__table">
            <summary>{t.money.showTable}</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.money.month}</th>
                  <th scope="col">{t.money.amount}</th>
                </tr>
              </thead>
              <tbody>
                {d.money.collectedByMonth.map((m) => (
                  <tr key={m.month}>
                    <th scope="row">{monthLabel(m.month, locale, 'long')}</th>
                    <td>{money(m.cents, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <section className="mm-dash__card" aria-labelledby="mm-by-lang">
          <h3 id="mm-by-lang">{t.languages.title}</h3>
          <p className="mm-dash__muted">{t.languages.hint}</p>
          <LanguageBars rows={d.byLanguage} names={languageNames} t={t} locale={locale} />
        </section>

        <section className="mm-dash__card" aria-labelledby="mm-todo">
          <h3 id="mm-todo">{t.todo.title}</h3>
          <Todo d={d} t={t} locale={locale} admin={admin} />
        </section>

        <section className="mm-dash__card" aria-labelledby="mm-hours">
          <h3 id="mm-hours">{t.hours.title}</h3>
          <p className="mm-dash__figure">{t.hours.given(hoursLabel(d.hours.given, locale), hoursLabel(d.hours.opened, locale))}</p>
          <p className="mm-dash__muted">{t.hours.givenHint}</p>
          <h4>{t.hours.fill}</h4>
          {d.hours.upcomingSlots === 0 ? (
            <p className="mm-dash__muted">{t.hours.noSlots}</p>
          ) : (
            <>
              <Meter value={d.hours.upcomingSeatsTaken} max={d.hours.upcomingSeats} label={t.hours.fillValue(d.hours.upcomingSeatsTaken, d.hours.upcomingSeats)} />
              <p className="mm-dash__muted">{t.hours.fillHint(d.hours.upcomingSlots)}</p>
            </>
          )}
        </section>

        <section className="mm-dash__card" aria-labelledby="mm-students">
          <h3 id="mm-students">{t.students.title}</h3>
          <dl className="mm-dash__stats">
            <Stat label={t.students.active} value={d.students.active} hint={t.students.activeHint} />
            <Stat label={t.students.new} value={d.students.new} hint={t.students.newHint} />
            <Stat label={t.students.lost} value={d.students.lost} hint={t.students.lostHint} />
          </dl>
        </section>
      </div>
    </section>
  )
}

function Tile({ label, value, hint, status }: { label: string; value: string; hint: string; status?: 'warning' }) {
  return (
    <div className={`mm-dash__tile${status ? ` mm-dash__tile--${status}` : ''}`}>
      <p className="mm-dash__tile-label">
        {status === 'warning' ? <WarningIcon /> : null}
        {label}
      </p>
      <p className="mm-dash__tile-value">
        <bdi>{value}</bdi>
      </p>
      <p className="mm-dash__muted">{hint}</p>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="mm-dash__stat">
      <dt>{label}</dt>
      <dd className="mm-dash__tile-value">{value}</dd>
      <dd className="mm-dash__muted">{hint}</dd>
    </div>
  )
}

function WarningIcon() {
  return (
    <svg className="mm-dash__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Colonnes mensuelles, une seule série. Étiquettes seulement sur le mois en cours et le plus haut ;
 * les autres valeurs sont au survol et dans le tableau « Voir les chiffres ».
 * L'axe du temps reste de gauche à droite, y compris dans l'administration en hébreu.
 */
function MonthColumns({ data, locale }: { data: Dashboard['money']['collectedByMonth']; locale: AdminLocale }) {
  const max = Math.max(...data.map((m) => m.cents), 1)
  const maxIndex = data.findIndex((m) => m.cents === max)
  const lastIndex = data.length - 1
  const sep = locale === 'fr' ? ' : ' : ': '

  return (
    <div className="mm-dash__cols" dir="ltr" aria-hidden="true">
      {data.map((m, i) => {
        const pct = m.cents > 0 ? Math.max(1.5, (100 * m.cents) / max) : 0
        const showValue = m.cents > 0 && (i === lastIndex || i === maxIndex)
        return (
          <div
            key={m.month}
            className={i === lastIndex ? 'mm-dash__col mm-dash__col--current' : 'mm-dash__col'}
            title={`${monthLabel(m.month, locale, 'long')}${sep}${money(m.cents, locale)}`}
          >
            <div className="mm-dash__col-plot">
              {showValue ? <span className="mm-dash__value">{money(m.cents, locale)}</span> : null}
              {pct > 0 ? <span className="mm-dash__bar" style={{ blockSize: `${pct}%` }} /> : null}
            </div>
            <span className="mm-dash__tick">{monthLabel(m.month, locale)}</span>
          </div>
        )
      })}
    </div>
  )
}

function LanguageBars({
  rows,
  names,
  t,
  locale,
}: {
  rows: Dashboard['byLanguage']
  names: Record<string, string>
  t: DashboardText
  locale: AdminLocale
}) {
  if (rows.length === 0) return <p className="mm-dash__muted">{t.languages.empty}</p>
  const max = Math.max(...rows.map((r) => r.cents), 1)
  return (
    <ul className="mm-dash__hbars">
      {rows.map((r) => (
        <li key={r.code}>
          <span className="mm-dash__hbar-name">{r.code === 'unknown' ? t.languages.unknown : (names[r.code] ?? r.code)}</span>
          <span className="mm-dash__hbar-track">
            <span className="mm-dash__hbar" style={{ inlineSize: `${(100 * r.cents) / max}%` }} />
          </span>
          <bdi className="mm-dash__hbar-value">{money(r.cents, locale)}</bdi>
        </li>
      ))}
    </ul>
  )
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((100 * value) / max) : 0
  return (
    <div className="mm-dash__meter">
      <span className="mm-dash__meter-track" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        <span className="mm-dash__meter-fill" style={{ inlineSize: `${pct}%` }} />
      </span>
      <span className="mm-dash__figure">{label}</span>
    </div>
  )
}

function Todo({ d, t, locale, admin }: { d: Dashboard; t: DashboardText; locale: AdminLocale; admin: string }) {
  const items: ReactNode[] = []
  if (d.money.toValidateCount > 0) {
    items.push(
      <li key="validate">
        <a href={`${admin}/collections/invoices?where[status][equals]=to_validate`}>{t.todo.toValidate(d.money.toValidateCount)}</a>
      </li>,
    )
  }
  if (d.todo.oralToReview > 0) {
    items.push(
      <li key="oral">
        <a href={`${admin}/collections/exercise-attempts?where[status][equals]=to_review`}>{t.todo.oral(d.todo.oralToReview)}</a>
      </li>,
    )
  }
  if (d.money.toInvoiceCount > 0) {
    items.push(
      <li key="invoice">
        <a href={`${admin}/collections/prestations?where[status][equals]=to_invoice`}>
          {t.todo.toInvoice(d.money.toInvoiceCount, money(d.money.toInvoiceCents, locale))}
        </a>
      </li>,
    )
  }

  return (
    <>
      {items.length > 0 ? <ul className="mm-dash__list">{items}</ul> : null}

      {d.money.overdue.length > 0 ? (
        <>
          <h4>
            <WarningIcon /> {t.todo.overdueTitle}
          </h4>
          <ul className="mm-dash__list">
            {d.money.overdue.map((o) => (
              <li key={o.id}>
                <a href={`${admin}/collections/invoices/${o.id}`}>
                  <bdi>{o.studentName}</bdi>
                </a>
                <span className="mm-dash__muted">
                  {' '}
                  <bdi>{o.number ?? ''}</bdi>
                </span>
                <span className="mm-dash__row-end">
                  <bdi>{money(o.totalCents, locale)}</bdi> <span className="mm-dash__muted">{t.todo.daysLate(o.daysLate)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h4>{t.todo.submissions}</h4>
      {d.todo.submissions.length === 0 ? (
        <p className="mm-dash__muted">{t.todo.submissionsNone}</p>
      ) : (
        <ul className="mm-dash__list">
          {d.todo.submissions.slice(0, 6).map((s) => (
            <li key={s.id}>
              <a href={`${admin}/collections/submissions/${s.id}`} dir="auto">
                {s.title}
              </a>
              {s.submittedAt ? (
                <span className="mm-dash__muted">
                  {' '}
                  {t.todo.since} {dateLabel(s.submittedAt, locale)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h4>{t.todo.trials}</h4>
      {d.todo.trialRequests.length === 0 ? (
        <p className="mm-dash__muted">{t.todo.trialsNone}</p>
      ) : (
        <ul className="mm-dash__list">
          {d.todo.trialRequests.slice(0, 6).map((r) => (
            <li key={r.id}>
              <a href={`${admin}/collections/trial-requests/${r.id}`} dir="auto">
                {r.name}
              </a>
              <span className="mm-dash__muted">
                {' '}
                {t.todo.since} {dateLabel(r.createdAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
