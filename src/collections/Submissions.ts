import type { CollectionConfig, Where } from 'payload'

import { isStaffUser, staffOnly } from '@/access'

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | undefined))

const staffField = {
  create: ({ req }: any) => isStaffUser(req),
  update: ({ req }: any) => isStaffUser(req),
}

/**
 * Remise d'un devoir par un élève, puis correction par Catherine.
 * Une seule remise par élève et par devoir ; si Catherine la renvoie « à refaire », l'élève peut la modifier.
 */
export const Submissions: CollectionConfig = {
  slug: 'submissions',
  labels: { singular: 'Devoir rendu', plural: 'Devoirs rendus' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'student', 'status', 'submittedAt'],
    group: 'Élèves',
    description: 'Les devoirs rendus par les élèves, à corriger.',
  },
  defaultSort: '-submittedAt',
  access: {
    read: ({ req }) => {
      if (isStaffUser(req)) return true
      if (req.user?.collection === 'students') return { student: { equals: req.user.id } }
      return false
    },
    create: ({ req }) => isStaffUser(req) || req.user?.collection === 'students',
    update: ({ req }) => {
      if (isStaffUser(req)) return true
      if (req.user?.collection === 'students') {
        return { and: [{ student: { equals: req.user.id } }, { status: { equals: 'returned' } }] } as Where
      }
      return false
    },
    delete: staffOnly,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const byStudent = req.user?.collection === 'students'
        if (byStudent) {
          // L'élève connecté est toujours l'auteur ; une remise ou une nouvelle version repart en « rendu ».
          data.student = req.user!.id
          data.status = 'submitted'
          data.submittedAt = new Date().toISOString()
        }
        const assignmentId = idOf(data.assignment ?? originalDoc?.assignment)
        const studentId = idOf(data.student ?? originalDoc?.student)
        if (!assignmentId || !studentId) throw new Error('Devoir ou élève manquant.')

        const assignment = await req.payload.findByID({
          collection: 'assignments',
          id: assignmentId,
          depth: 0,
          req,
          overrideAccess: true,
        })
        const assigned = (assignment.students ?? []).map(idOf)
        if (!assigned.includes(studentId) || (byStudent && !assignment.published)) {
          throw new Error('Ce devoir ne vous est pas attribué.')
        }
        if (operation === 'create') {
          const existing = await req.payload.count({
            collection: 'submissions',
            where: { and: [{ assignment: { equals: assignmentId } }, { student: { equals: studentId } }] },
            req,
            overrideAccess: true,
          })
          if (existing.totalDocs > 0) throw new Error('Ce devoir a déjà été rendu.')
        }
        // Les fichiers joints doivent appartenir à l'élève.
        if (byStudent && Array.isArray(data.files) && data.files.length > 0) {
          const files = await req.payload.find({
            collection: 'submission-files',
            where: { id: { in: data.files.map(idOf) } },
            depth: 0,
            req,
            overrideAccess: true,
          })
          if (files.docs.some((f) => idOf(f.owner) !== studentId) || files.docs.length !== data.files.length) {
            throw new Error('Fichier joint invalide.')
          }
        }
        if (isStaffUser(req) && data.status === 'corrected' && originalDoc?.status !== 'corrected') {
          data.correctedAt = new Date().toISOString()
        }
        const student = await req.payload.findByID({
          collection: 'students',
          id: studentId,
          depth: 0,
          req,
          overrideAccess: true,
        })
        data.title = `${assignment.title} (${student.fullName ?? student.email})`
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    { name: 'assignment', label: 'Devoir', type: 'relationship', relationTo: 'assignments', required: true },
    { name: 'student', label: 'Élève', type: 'relationship', relationTo: 'students', admin: { readOnly: true } },
    { name: 'text', label: 'Réponse', type: 'textarea' },
    { name: 'files', label: 'Fichiers', type: 'relationship', relationTo: 'submission-files', hasMany: true },
    {
      name: 'status',
      label: 'État',
      type: 'select',
      defaultValue: 'submitted',
      options: [
        { label: 'Rendu, à corriger', value: 'submitted' },
        { label: 'Corrigé', value: 'corrected' },
        { label: 'À refaire', value: 'returned' },
      ],
      access: staffField,
      admin: { position: 'sidebar' },
    },
    { name: 'feedback', label: 'Correction et commentaire', type: 'textarea', access: staffField },
    {
      name: 'grade',
      label: 'Appréciation',
      type: 'text',
      access: staffField,
      admin: { description: 'Facultatif : une note, une lettre ou un mot.' },
    },
    { name: 'submittedAt', label: 'Rendu le', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'correctedAt', label: 'Corrigé le', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
