import path from 'path'
import { APIError, type Block, type CollectionConfig, type FieldAccess, type Where } from 'payload'

import { isStaffUser, staffOnly } from '@/access'
import { parseGapText } from '@/exercises/core'
import { cefrLevelField } from '@/fields'

/** Taille maximale d'une vidéo envoyée sur le serveur du site (en attendant un stockage dédié). */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024

/** Champs qui contiennent les solutions : jamais lisibles par un élève, même via l'API. */
const staffRead: { read: FieldAccess } = { read: ({ req }) => isStaffUser(req) }

const explanation = {
  name: 'explanation',
  label: 'Explication (montrée après la réponse)',
  type: 'textarea' as const,
  access: staffRead,
}

const McqBlock: Block = {
  slug: 'mcq',
  labels: { singular: 'QCM', plural: 'QCM' },
  fields: [
    { name: 'question', label: 'Question', type: 'text', required: true },
    {
      name: 'options',
      label: 'Réponses proposées',
      type: 'array',
      minRows: 2,
      maxRows: 8,
      required: true,
      labels: { singular: 'Réponse', plural: 'Réponses' },
      admin: { description: 'Cochez la ou les bonnes réponses. Avec plusieurs bonnes réponses, l’élève doit toutes les trouver.' },
      validate: (rows: unknown) =>
        Array.isArray(rows) && rows.some((r) => (r as { correct?: boolean } | null)?.correct) ? true : 'Cochez au moins une bonne réponse.',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'text', label: 'Texte', type: 'text', required: true, admin: { width: '75%' } },
            { name: 'correct', label: 'Bonne réponse', type: 'checkbox', defaultValue: false, access: staffRead, admin: { width: '25%' } },
          ],
        },
      ],
    },
    explanation,
  ],
}

const GapBlock: Block = {
  slug: 'gap',
  labels: { singular: 'Texte à trous', plural: 'Textes à trous' },
  fields: [
    { name: 'instructions', label: 'Consigne', type: 'text', admin: { placeholder: 'Complétez avec le verbe au présent.' } },
    {
      name: 'text',
      label: 'Texte',
      type: 'textarea',
      required: true,
      access: staffRead,
      admin: {
        description:
          'Mettez chaque mot à trouver entre crochets : « Je [suis] étudiant. » Plusieurs réponses acceptées : « j’[ai|avais] faim ». Majuscules et ponctuation finale sont ignorées, les accents comptent.',
      },
      validate: (value: unknown) =>
        typeof value === 'string' && parseGapText(value).answers.length > 0
          ? true
          : 'Ajoutez au moins un mot à trouver entre crochets, par exemple [suis].',
    },
    explanation,
  ],
}

const MatchingBlock: Block = {
  slug: 'matching',
  labels: { singular: 'Associer des paires', plural: 'Associer des paires' },
  fields: [
    { name: 'instructions', label: 'Consigne', type: 'text', admin: { placeholder: 'Associez chaque mot à sa traduction.' } },
    {
      name: 'pairs',
      label: 'Paires',
      type: 'array',
      minRows: 2,
      maxRows: 12,
      required: true,
      labels: { singular: 'Paire', plural: 'Paires' },
      admin: { description: 'Écrivez les paires correctes : l’élève verra la colonne de droite dans le désordre.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'item', label: 'À gauche', type: 'text', required: true, access: staffRead, admin: { width: '50%' } },
            { name: 'match', label: 'À droite', type: 'text', required: true, access: staffRead, admin: { width: '50%' } },
          ],
        },
      ],
    },
    explanation,
  ],
}

const AudioBlock: Block = {
  slug: 'audio',
  labels: { singular: 'Réponse orale', plural: 'Réponses orales' },
  fields: [
    { name: 'prompt', label: 'Consigne', type: 'textarea', required: true },
    {
      name: 'maxSeconds',
      label: 'Durée maximale (secondes)',
      type: 'number',
      defaultValue: 60,
      min: 5,
      max: 300,
      admin: { description: 'Vous écouterez les réponses dans « Réponses aux exercices ».' },
    },
  ],
}

/**
 * Vidéothèque : cours enregistrés par Catherine, chacun avec des exercices facultatifs.
 * Le fichier vidéo est privé : il n'est servi qu'aux élèves qui ont le droit de voir la vidéo.
 */
export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Vidéo', plural: 'Vidéothèque' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'language', 'level', 'visibility', 'published'],
    group: 'Élèves',
    description: 'Vos cours enregistrés. Ajoutez des exercices sous chaque vidéo si vous le souhaitez.',
  },
  defaultSort: '-createdAt',
  access: {
    read: async ({ req }) => {
      if (isStaffUser(req)) return true
      if (req.user?.collection !== 'students') return false
      const studentId = req.user.id
      // Les langues suivies ne sont pas lisibles par l'élève lui-même : on relit seulement sa propre fiche.
      const me = await req.payload.findByID({ collection: 'students', id: studentId, depth: 0, overrideAccess: true, req })
      const languageIds = (me.languages ?? []).map((l) => (typeof l === 'object' ? l.id : l))
      const audience: Where[] = [
        { visibility: { equals: 'all' } },
        { and: [{ visibility: { equals: 'selected' } }, { students: { equals: studentId } }] },
      ]
      if (languageIds.length > 0) {
        audience.push({ and: [{ visibility: { equals: 'language' } }, { language: { in: languageIds } }] })
      }
      return { and: [{ published: { equals: true } }, { or: audience }] } as Where
    },
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  hooks: {
    beforeValidate: [
      ({ req, data }) => {
        if (req.file && req.file.size > MAX_VIDEO_BYTES) {
          throw new APIError('Vidéo trop lourde : 500 Mo maximum. Exportez-la en 720p ou coupez-la en plusieurs parties.', 413, null, true)
        }
        return data
      },
    ],
  },
  upload: {
    // Fichiers privés : servis uniquement via l'API, qui applique la règle de lecture ci-dessus.
    staticDir: path.resolve(process.cwd(), 'uploads', 'videos'),
    mimeTypes: ['video/mp4', 'video/webm'],
  },
  fields: [
    { name: 'title', label: 'Titre', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'language', label: 'Langue', type: 'relationship', relationTo: 'languages', required: true, admin: { width: '50%' } },
        { ...cefrLevelField(), admin: { width: '50%' } },
      ],
    },
    {
      name: 'description',
      label: 'Présentation',
      type: 'richText',
      admin: { description: 'Écrite dans la langue du cours : elle s’affiche dans le bon sens d’écriture.' },
    },
    {
      name: 'exercises',
      label: 'Exercices (facultatif)',
      type: 'blocks',
      blocks: [McqBlock, GapBlock, MatchingBlock, AudioBlock],
      labels: { singular: 'Exercice', plural: 'Exercices' },
    },
    {
      name: 'visibility',
      label: 'Qui peut la voir',
      type: 'select',
      required: true,
      defaultValue: 'language',
      options: [
        { label: 'Les élèves de cette langue', value: 'language' },
        { label: 'Tous les élèves', value: 'all' },
        { label: 'Des élèves choisis', value: 'selected' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'students',
      label: 'Élèves choisis',
      type: 'relationship',
      relationTo: 'students',
      hasMany: true,
      access: staffRead,
      admin: { position: 'sidebar', condition: (data) => data?.visibility === 'selected' },
    },
    {
      name: 'showSolutions',
      label: 'Montrer la solution après la réponse',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'published',
      label: 'Visible par les élèves',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
  ],
}
