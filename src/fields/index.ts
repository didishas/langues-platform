import type { Field, SelectField } from 'payload'

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export const cefrLevelField = (name = 'level', label = 'Niveau CECRL'): SelectField => ({
  name,
  label,
  type: 'select',
  options: CEFR_LEVELS.map((l) => ({ label: l, value: l })),
})

/**
 * Montant en euros dans le CMS, avec sa valeur en centimes entiers à côté.
 * Les calculs (facturation) n'utilisent que les centimes.
 *
 * - Montant saisi par Catherine : le champ en euros est stocké et éditable ;
 *   les centimes sont recalculés à chaque enregistrement (« 37,50 » → 3750).
 * - Montant calculé par le code (`readOnly`) : seuls les centimes sont stockés ;
 *   le champ en euros est virtuel et sert uniquement à l'affichage.
 */
export const euroAmountFields = (
  name: string,
  label: string,
  options: { required?: boolean; description?: string; readOnly?: boolean } = {},
): Field[] => {
  const centsName = `${name}Cents`
  const centsToEuros = ({ siblingData }: { siblingData?: Record<string, unknown> }) => {
    const cents = siblingData?.[centsName]
    return typeof cents === 'number' ? cents / 100 : undefined
  }
  return [
    {
      name,
      label,
      type: 'number',
      required: options.required,
      min: 0,
      ...(options.readOnly ? { virtual: true, hooks: { afterRead: [centsToEuros] } } : {}),
      admin: {
        step: 0.01,
        readOnly: options.readOnly,
        description: options.description ?? 'En euros',
      },
    },
    {
      name: centsName,
      type: 'number',
      admin: { hidden: true },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            const euros = siblingData?.[name]
            if (typeof euros === 'number' && Number.isFinite(euros)) return Math.round(euros * 100)
            return value
          },
        ],
      },
    },
  ]
}

export const LANGUAGE_CODES = ['he', 'en', 'es', 'fr', 'ro'] as const
export type LanguageCode = (typeof LANGUAGE_CODES)[number]
