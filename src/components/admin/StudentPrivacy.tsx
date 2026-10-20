'use client'

import { Button, useAuth, useDocumentInfo, useTranslation } from '@payloadcms/ui'
import { useState } from 'react'

const TEXT = {
  fr: {
    title: 'Données personnelles (RGPD)',
    export: 'Exporter ses données',
    erase: 'Effacer ses données…',
    explain:
      'Seront effacés : nom, e-mail, téléphone, notes, responsable légal, devoirs rendus, réponses aux exercices et leurs fichiers, réservations à venir, demandes de cours d’essai, et les devoirs ou documents destinés à lui seul. Seront gardés : les factures (obligation comptable) et les séances passées, sans nom. Impossible à annuler.',
    confirmLabel: 'Pour confirmer, retapez l’e-mail de l’élève',
    confirm: 'Effacer définitivement',
    cancel: 'Annuler',
    working: 'Effacement…',
    done: 'Données effacées. Factures conservées :',
    erased: 'Les données de cet élève ont été effacées.',
  },
  en: {
    title: 'Personal data (GDPR)',
    export: 'Export their data',
    erase: 'Erase their data…',
    explain:
      'Erased: name, email, phone, notes, legal guardian, submitted homework, exercise answers and their files, upcoming bookings, trial requests, and homework or documents meant only for them. Kept: invoices (accounting obligation) and past lessons, without a name. Cannot be undone.',
    confirmLabel: 'To confirm, retype the student’s email',
    confirm: 'Erase permanently',
    cancel: 'Cancel',
    working: 'Erasing…',
    done: 'Data erased. Invoices kept:',
    erased: 'This student’s data has been erased.',
  },
  he: {
    title: 'מידע אישי (GDPR)',
    export: 'ייצוא הנתונים',
    erase: 'מחיקת הנתונים…',
    explain:
      'יימחקו: שם, דוא״ל, טלפון, הערות, אפוטרופוס, שיעורי בית שהוגשו, תשובות לתרגילים והקבצים שלהן, הזמנות עתידיות, בקשות לשיעור ניסיון, ושיעורי בית או מסמכים שנועדו רק לתלמיד. יישמרו: חשבוניות (חובה חשבונאית) ושיעורים שעברו, ללא שם. לא ניתן לבטל.',
    confirmLabel: 'לאישור, הקלידו שוב את הדוא״ל של התלמיד',
    confirm: 'מחיקה סופית',
    cancel: 'ביטול',
    working: 'מוחקים…',
    done: 'הנתונים נמחקו. חשבוניות שנשמרו:',
    erased: 'הנתונים של תלמיד זה נמחקו.',
  },
}

/** Boutons RGPD dans la fiche élève, réservés à Catherine. Le serveur revérifie le rôle et la confirmation. */
export function StudentPrivacy() {
  const { id, data } = useDocumentInfo() as { id?: number | string; data?: { erasedAt?: string | null } }
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const t = TEXT[(i18n?.language as keyof typeof TEXT) ?? 'fr'] ?? TEXT.fr
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null)

  if (!id || (user as { role?: string } | null)?.role !== 'teacher') return null
  if (data?.erasedAt) return <p className="mm-privacy__note">{t.erased}</p>

  const erase = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/students/${id}/privacy-erase`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: email }),
      })
      const body = (await res.json()) as { ok: boolean; error?: string; details?: string[]; summary?: { invoicesKept: number } }
      if (body.ok) {
        setResult({ ok: true, message: `${t.done} ${body.summary?.invoicesKept ?? 0}` })
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setResult({ ok: false, message: body.error ?? 'Erreur', details: body.details })
      }
    } catch {
      setResult({ ok: false, message: 'Erreur réseau : rien n’a été effacé.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mm-privacy">
      <h4>{t.title}</h4>
      <Button el="anchor" url={`/api/students/${id}/privacy-export`} buttonStyle="secondary" size="small">
        {t.export}
      </Button>
      {!open ? (
        <Button buttonStyle="secondary" className="mm-privacy__danger-outline" size="small" onClick={() => setOpen(true)}>
          {t.erase}
        </Button>
      ) : (
        <div className="mm-privacy__confirm">
          <p>{t.explain}</p>
          <label htmlFor="mm-privacy-email">{t.confirmLabel}</label>
          <input id="mm-privacy-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          <div className="mm-privacy__actions">
            <Button buttonStyle="primary" className="mm-privacy__danger" size="small" disabled={busy || !email} onClick={erase}>
              {busy ? t.working : t.confirm}
            </Button>
            <Button buttonStyle="secondary" size="small" onClick={() => setOpen(false)}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
      {result ? (
        <div role={result.ok ? 'status' : 'alert'} className={result.ok ? 'mm-privacy__ok' : 'mm-privacy__error'}>
          <p>{result.message}</p>
          {result.details?.length ? (
            <ul>
              {result.details.map((d) => (
                <li key={d} dir="auto">
                  {d}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
