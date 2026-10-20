import type { CollectionConfig, Where } from 'payload'

import { isStaffUser, teacherOnly } from '@/access'

/** Devoirs et TP donnés par Catherine à un ou plusieurs élèves. */
export const Assignments: CollectionConfig = {
  slug: 'assignments',
  labels: { singular: 'Devoir ou TP', plural: 'Devoirs et TP' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'language', 'dueDate', 'published'],
    group: 'Élèves',
  },
  defaultSort: '-dueDate',
  access: {
    read: ({ req }) => {
      if (isStaffUser(req)) return true
      if (req.user?.collection === 'students') {
        return { and: [{ students: { equals: req.user.id } }, { published: { equals: true } }] } as Where
      }
      return false
    },
    create: teacherOnly,
    update: teacherOnly,
    delete: teacherOnly,
  },
  fields: [
    { name: 'title', label: 'Titre', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          label: 'Type',
          type: 'select',
          required: true,
          defaultValue: 'homework',
          options: [
            { label: 'Devoir', value: 'homework' },
            { label: 'TP', value: 'practical' },
          ],
          admin: { width: '33%' },
        },
        { name: 'language', label: 'Langue', type: 'relationship', relationTo: 'languages', admin: { width: '33%' } },
        {
          name: 'dueDate',
          label: 'À rendre pour le',
          type: 'date',
          admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
    {
      name: 'students',
      label: 'Élèves concernés',
      type: 'relationship',
      relationTo: 'students',
      hasMany: true,
      required: true,
    },
    {
      name: 'instructions',
      label: 'Consignes',
      type: 'richText',
      admin: { description: 'Écrites dans la langue du cours : elles s’affichent dans le bon sens d’écriture.' },
    },
    {
      name: 'attachments',
      label: 'Documents joints',
      type: 'relationship',
      relationTo: 'documents',
      hasMany: true,
      admin: { description: 'Pensez à partager aussi ces documents avec les élèves concernés.' },
    },
    {
      name: 'published',
      label: 'Visible par les élèves',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
  ],
}
