import { notFound } from 'next/navigation'

import { StudentNav } from '@/components/student/StudentNav'
import { isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { formatPrice } from '@/lib/content'
import { formatDate, requireStudent } from '@/lib/student'
import { getInvoices } from '@/lib/studentData'

export const metadata = { robots: { index: false } }

export default async function InvoicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const student = await requireStudent(locale)
  const t = getStudentDictionary(locale)
  const invoices = await getInvoices(student)

  return (
    <>
      <StudentNav locale={locale} t={t} current="invoices" name={student.firstName} />
      <div className="wrap student-page">
        <h1>{t.invoices.title}</h1>
        {invoices.length === 0 ? (
          <p className="muted">{t.invoices.empty}</p>
        ) : (
          <ul className="rows">
            {invoices.map((inv) => {
              const paid = inv.status === 'paid'
              return (
                <li key={inv.id} className="row">
                  <div>
                    <p className="row__title">
                      {inv.number ? `${t.invoices.number} ${inv.number}` : t.invoices.smart}
                    </p>
                    <p className="row__meta">
                      {inv.dueDate ? (
                        <span>
                          {t.invoices.due} {formatDate(inv.dueDate, locale)}
                        </span>
                      ) : null}
                      {!paid && inv.structuredCommunication ? (
                        <span>
                          {t.invoices.transfer} <bdi dir="ltr">{inv.structuredCommunication}</bdi>
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="row__end">
                    <p className="row__amount">{formatPrice(inv.totalCents, locale)}</p>
                    <span className={`tag ${paid ? 'tag--corrected' : 'tag--todo'}`}>
                      {paid ? t.invoices.paid : t.invoices.toPay}
                    </span>
                    {!paid && inv.paymentUrl ? (
                      <a className="button button--small" href={inv.paymentUrl}>
                        {t.invoices.pay}
                      </a>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
