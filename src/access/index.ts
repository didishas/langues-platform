import type { Access, PayloadRequest } from 'payload'

/** L'équipe = les comptes de la collection `users` (Catherine, et le compte technique). */
export const isStaffUser = (req: PayloadRequest): boolean => req.user?.collection === 'users'

export const staffOnly: Access = ({ req }) => isStaffUser(req)

export const publicRead: Access = () => true

/** Contenu publié lisible par tous, brouillons et contenus masqués réservés à l'équipe. */
export const publishedOrStaff: Access = ({ req }) => {
  if (isStaffUser(req)) return true
  return { published: { equals: true } }
}

/** Un élève ne voit et ne modifie que sa propre fiche. */
export const selfOrStaff: Access = ({ req }) => {
  if (isStaffUser(req)) return true
  if (req.user?.collection === 'students') return { id: { equals: req.user.id } }
  return false
}

/** Un élève ne voit que les documents qui le concernent (champ `student`). */
export const ownStudentDocsOrStaff: Access = ({ req }) => {
  if (isStaffUser(req)) return true
  if (req.user?.collection === 'students') return { student: { equals: req.user.id } }
  return false
}
