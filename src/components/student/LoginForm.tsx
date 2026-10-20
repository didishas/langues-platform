'use client'

import { useActionState, useEffect, useRef } from 'react'

import { loginStudent, type LoginState } from '@/app/(frontend)/[locale]/espace/actions'
import type { Locale } from '@/i18n/config'
import type { StudentDictionary } from '@/i18n/studentDictionaries'

export function LoginForm({ locale, t }: { locale: Locale; t: StudentDictionary['login'] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginStudent, {})
  // Fuseau horaire de l'appareil, pour afficher les séances à l'heure de l'élève (rempli après le premier rendu).
  const tz = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (tz.current) tz.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  })

  return (
    <form action={action} className="trial-form login-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="tz" ref={tz} defaultValue="" />
      <div className="field">
        <label htmlFor="login-email">{t.email}</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          key={state.email ?? ''}
          defaultValue={state.email}
        />
      </div>
      <div className="field">
        <label htmlFor="login-password">{t.password}</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" dir="ltr" required />
      </div>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="button" disabled={pending}>
        {pending ? t.sending : t.submit}
      </button>
      <p className="muted">{t.forgotten}</p>
    </form>
  )
}
