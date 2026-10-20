import type { Endpoint } from 'payload'

import { isTeacher } from '@/access'

import { eraseStudentData, exportStudentData, PrivacyError } from './service'

const json = (body: unknown, status = 200) => Response.json(body, { status })
const studentId = (raw: unknown) => (typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : null)

/** GET /api/students/:id/privacy-export → ZIP des données de l'élève. Catherine seulement. */
export const privacyExportEndpoint: Endpoint = {
  path: '/:id/privacy-export',
  method: 'get',
  handler: async (req) => {
    if (!isTeacher(req)) return json({ error: 'Accès refusé' }, 403)
    const id = studentId(req.routeParams?.id)
    if (id === null) return json({ error: 'Élève inconnu' }, 404)
    try {
      const { zip, filename } = await exportStudentData(req.payload, id)
      return new Response(zip as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (e) {
      if (e instanceof PrivacyError && e.code === 'not_found') return json({ error: 'Élève inconnu' }, 404)
      throw e
    }
  },
}

/** POST /api/students/:id/privacy-erase { confirmEmail } → efface les données personnelles. Catherine seulement. */
export const privacyEraseEndpoint: Endpoint = {
  path: '/:id/privacy-erase',
  method: 'post',
  handler: async (req) => {
    if (!isTeacher(req)) return json({ error: 'Accès refusé' }, 403)
    const id = studentId(req.routeParams?.id)
    if (id === null) return json({ error: 'Élève inconnu' }, 404)
    const body = (await req.json?.().catch(() => null)) as { confirmEmail?: string } | null
    try {
      const summary = await eraseStudentData(req.payload, id, String(body?.confirmEmail ?? ''))
      return json({ ok: true, summary })
    } catch (e) {
      if (!(e instanceof PrivacyError)) throw e
      const status = { not_found: 404, confirm: 400, blocked: 409, already_erased: 409 }[e.code]
      const error = {
        not_found: 'Élève inconnu.',
        confirm: 'L’e-mail retapé ne correspond pas à celui de l’élève. Rien n’a été effacé.',
        blocked: 'Il reste de l’argent en suspens : réglez d’abord ces éléments. Rien n’a été effacé.',
        already_erased: 'Les données de cet élève ont déjà été effacées.',
      }[e.code]
      return json({ ok: false, error, details: e.details }, status)
    }
  },
}
