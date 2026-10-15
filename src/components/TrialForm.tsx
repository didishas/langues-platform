'use client'

import { useActionState } from 'react'

import { submitTrialRequest, type TrialFormState } from '@/app/(frontend)/[locale]/actions'
import type { Locale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries'

type LanguageOption = { id: number; name: string }

export function TrialForm({
  locale,
  t,
  languages,
  privacyHref,
}: {
  locale: Locale
  t: Dictionary['trial']
  languages: LanguageOption[]
  privacyHref: string
}) {
  const [state, action, pending] = useActionState<TrialFormState, FormData>(submitTrialRequest, { status: 'idle' })

  if (state.status === 'success') {
    return (
      <p className="form-success" role="status">
        {state.message}
      </p>
    )
  }

  const err = state.fieldErrors ?? {}
  const v = state.values ?? {}

  return (
    <form action={action} className="trial-form" noValidate key={JSON.stringify(v)}>
      <input type="hidden" name="locale" value={locale} />
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="field">
        <label htmlFor="trial-name">{t.name}</label>
        <input
          id="trial-name"
          name="name"
          defaultValue={v.name}
          autoComplete="name"
          required
          aria-invalid={Boolean(err.name)}
          aria-describedby={err.name ? 'trial-name-err' : undefined}
        />
        {err.name ? (
          <p id="trial-name-err" className="field__error">
            {err.name}
          </p>
        ) : null}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="trial-email">{t.email}</label>
          <input
            id="trial-email"
            name="email"
            defaultValue={v.email}
            type="email"
            autoComplete="email"
            dir="ltr"
            required
            aria-invalid={Boolean(err.email)}
            aria-describedby={err.email ? 'trial-email-err' : undefined}
          />
          {err.email ? (
            <p id="trial-email-err" className="field__error">
              {err.email}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="trial-phone">{t.phone}</label>
          <input id="trial-phone" name="phone" type="tel" autoComplete="tel" dir="ltr" defaultValue={v.phone} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="trial-language">{t.language}</label>
        <select id="trial-language" name="language" defaultValue={v.language ?? ''}>
          <option value="">{t.chooseLanguage}</option>
          {languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <label className="check">
        <input type="checkbox" name="forMinor" defaultChecked={v.forMinor} />
        <span>{t.forMinor}</span>
      </label>

      <div className="field">
        <label htmlFor="trial-message">{t.message}</label>
        <textarea id="trial-message" name="message" rows={4} defaultValue={v.message} />
      </div>

      <label className="check">
        <input
          type="checkbox"
          name="consent"
          required
          aria-invalid={Boolean(err.consent)}
          aria-describedby={err.consent ? 'trial-consent-err' : undefined}
        />
        <span>
          {t.consent} <a href={privacyHref}>{t.privacyLink}</a>
        </span>
      </label>
      {err.consent ? (
        <p id="trial-consent-err" className="field__error">
          {err.consent}
        </p>
      ) : null}

      {state.status === 'error' && state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button type="submit" className="button" disabled={pending}>
        {pending ? t.sending : t.submit}
      </button>
    </form>
  )
}
