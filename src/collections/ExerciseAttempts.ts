import type { CollectionConfig, FieldAccess } from 'payload'

import { isStaffUser, ownStudentDocsOrStaff, staffOnly } from '@/access'

const staffField: { update: FieldAccess } = { update: ({ req }) => isStaffUser(req) }

/**
 * Réponses des élèves aux exercices des vidéos.
 * Créées uniquement par le serveur après correction (`src/exercises/service.ts`) : un élève ne peut ni
 * en créer une lui-même ni modifier sa note via l'API.
 */
export const ExerciseAttempts: CollectionConfig = {
  slug: 'exercise-attempts',
  labels: { singular: 'Réponse à un exercice', plural: 'Réponses aux exercices' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'student', 'kind', 'status', 'score', 'createdAt'],
    group: 'Élèves',
    description: 'Les réponses orales « à écouter » attendent votre avis ; le reste est corrigé automatiquement.',
  },
  defaultSort: '-createdAt',
  access: {
    read: ownStudentDocsOrStaff,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, req }) => {
        if (isStaffUser(req) && data.status === 'reviewed' && originalDoc?.status !== 'reviewed') {
          data.reviewedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'student', label: 'Élève', type: 'relationship', relationTo: 'students', required: true, admin: { readOnly: true, width: '50%' } },
        { name: 'video', label: 'Vidéo', type: 'relationship', relationTo: 'videos', required: true, admin: { readOnly: true, width: '50%' } },
      ],
    },
    { name: 'exerciseId', type: 'text', required: true, index: true, admin: { hidden: true } },
    {
      name: 'kind',
      label: 'Exercice',
      type: 'select',
      required: true,
      options: [
        { label: 'QCM', value: 'mcq' },
        { label: 'Texte à trous', value: 'gap' },
        { label: 'Associer des paires', value: 'matching' },
        { label: 'Réponse orale', value: 'audio' },
      ],
      admin: { readOnly: true },
    },
    { name: 'answers', label: 'Réponses données', type: 'json', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'score', label: 'Points', type: 'number', admin: { readOnly: true, width: '50%' } },
        { name: 'maxScore', label: 'Sur', type: 'number', admin: { readOnly: true, width: '50%' } },
      ],
    },
    { name: 'audio', label: 'Enregistrement', type: 'upload', relationTo: 'submission-files', admin: { readOnly: true } },
    {
      name: 'status',
      label: 'État',
      type: 'select',
      required: true,
      defaultValue: 'graded',
      options: [
        { label: 'Corrigé automatiquement', value: 'graded' },
        { label: 'À écouter', value: 'to_review' },
        { label: 'Écouté', value: 'reviewed' },
      ],
      access: staffField,
      admin: { position: 'sidebar' },
    },
    { name: 'feedback', label: 'Votre commentaire', type: 'textarea', access: staffField },
    { name: 'reviewedAt', label: 'Écouté le', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
