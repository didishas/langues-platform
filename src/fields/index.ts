import type { Field, SelectField } from 'payload'

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export const cefrLevelField = (name = 'level', label = 'Niveau CECRL'): SelectField => ({
  name,
  label,
  type: 'select',
  options: CEFR_LEVELS.map((l) => ({ label: l, value: l })),
})

/**
 * Montant saisi en euros dans le CMS, stocké en centimes entiers.
 * Catherine voit et tape « 40 » ou « 37,50 » ; la base garde 4000 ou 3750.
 */
export const euroAmountFields = (
  name: string,
  label: string,
  options: { required?: boolean; description?: string; readOnly?: boolean } = {},
): Field[] => {
  const centsName = `${name}Cents`
  return [
    {
      name,
      label,
      type: 'number',
      virtual: true,
      required: options.required,
      min: 0,
      admin: {
        step: 0.01,
        readOnly: options.readOnly,
        description: options.description ?? 'En euros',
      },
      hooks: {
        afterRead: [
          ({ siblingData }) => {
            const cents = siblingData?.[centsName]
            return typeof cents === 'number' ? cents / 100 : undefined
          },
        ],
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
