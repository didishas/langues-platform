'use client'

import { Button, useAuth, useDocumentInfo, useFormModified, useTranslation } from '@payloadcms/ui'
import { useState } from 'react'

const TEXT = {
  fr: {
    send: 'Valider et envoyer',
    sending: 'Envoi…',
    saveFirst: 'Enregistrez vos modifications avant d’envoyer : c’est la version enregistrée qui part.',
    sent: 'Message envoyé.',
    already: 'Ce message était déjà parti.',
    network: 'Erreur réseau : vérifiez l’état du message avant de réessayer.',
    hint: 'Le message part tel qu’il est enregistré, à l’adresse indiquée.',
  },
  en: {
    send: 'Approve and send',
    sending: 'Sending…',
    saveFirst: 'Save your changes before sending: the saved version is what goes out.',
    sent: 'Message sent.',
    already: 'This message had already been sent.',
    network: 'Network error: check the message status before trying again.',
    hint: 'The message goes out exactly as saved, to the address shown.',
  },
  he: {
    send: 'אישור ושליחה',
    sending: 'שולחים…',
    saveFirst: 'שמרו את השינויים לפני השליחה: נשלחת הגרסה השמורה.',
    sent: 'ההודעה נשלחה.',
    already: 'ההודעה כבר נשלחה.',
    network: 'שגיאת רשת: בדקו את מצב ההודעה לפני ניסיון נוסף.',
    hint: 'ההודעה נשלחת כפי שנשמרה, לכתובת המוצגת.',
  },
}

/** Bouton d'envoi d'un message, pour Catherine. Le serveur revérifie rôle, version, destinataire et montant. */
export function OutboxSend() {
  const { id, savedDocumentData } = useDocumentInfo() as {
    id?: number | string
    savedDocumentData?: { status?: string; updatedAt?: string }
  }
  const { user } = useAuth()
  const modified = useFormModified()
  const { i18n } = useTranslation()
  const t = TEXT[(i18n?.language as keyof typeof TEXT) ?? 'fr'] ?? TEXT.fr
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const status = savedDocumentData?.status
  if (!id || (user as { role?: string } | null)?.role !== 'teacher' || status === 'sent' || status === 'cancelled') return null

  const send = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/outbox/${id}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: savedDocumentData?.updatedAt }),
      })
      const body = (await res.json()) as { ok: boolean; outcome?: string; error?: string }
      if (body.ok) {
        setResult({ ok: true, message: body.outcome === 'already_sent' ? t.already : t.sent })
        setTimeout(() => window.location.reload(), 1200)
      } else {
        setResult({ ok: false, message: body.error ?? 'Erreur' })
      }
    } catch {
      setResult({ ok: false, message: t.network })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mm-outbox">
      <Button buttonStyle="primary" size="medium" disabled={busy || modified} onClick={send}>
        {busy ? t.sending : t.send}
      </Button>
      <p className="mm-outbox__hint">{modified ? t.saveFirst : t.hint}</p>
      {result ? (
        <p role={result.ok ? 'status' : 'alert'} className={result.ok ? 'mm-privacy__ok' : 'mm-privacy__error'}>
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
