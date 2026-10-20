import { expect, test, type Page } from '@playwright/test'

import { payload } from './fixtures'

let data: { studentId: number; email: string; password: string; slotId: number; bookingId: number }

test.beforeAll(async () => {
  const p = await payload()
  const stamp = Date.now()
  const password = `e2e-${stamp}-mot-de-passe`
  const student = await p.create({
    collection: 'students',
    data: { firstName: 'Noam', lastName: 'E2E', email: `e2e-tz-${stamp}@motamot.test`, password } as any,
  })
  const start = new Date(Date.now() + 3 * 864e5)
  start.setUTCHours(15, 0, 0, 0)
  const slot = await p.create({
    collection: 'slots',
    data: { start: start.toISOString(), end: new Date(start.getTime() + 36e5).toISOString(), capacity: 1 },
  })
  const booking = await p.create({ collection: 'bookings', data: { slot: slot.id, student: student.id, status: 'confirmed' } })
  data = { studentId: student.id, email: student.email, password, slotId: slot.id, bookingId: booking.id }
})

test.afterAll(async () => {
  if (!data) return
  const p = await payload()
  await p.delete({ collection: 'bookings', id: data.bookingId })
  await p.delete({ collection: 'slots', id: data.slotId })
  await p.delete({ collection: 'students', id: data.studentId })
})

async function login(page: Page) {
  await page.goto('/fr/espace/connexion')
  await page.locator('#login-email').fill(data.email)
  await page.locator('#login-password').fill(data.password)
  await page.locator('form button[type=submit]').click()
  await expect(page).toHaveURL(/\/fr\/espace$/)
}

test.describe.serial('fuseau horaire', () => {
  test.describe('élève en Israël', () => {
    test.use({ timezoneId: 'Asia/Jerusalem' })
    test('fuseau retenu à la première connexion, séance à son heure puis à celle de Bruxelles', async ({ page }) => {
      await login(page)
      const p = await payload()
      expect((await p.findByID({ collection: 'students', id: data.studentId })).timeZone).toBe('Asia/Jerusalem')
      await expect(page.locator('.row__title', { hasText: 'heure d’Israël' })).toBeVisible()
      await expect(page.locator('.session-brussels')).toHaveText(/^Bruxelles : \d\d:\d\d$/)
    })
  })

  test.describe('même élève en voyage à New York', () => {
    test.use({ timezoneId: 'America/New_York' })
    test('une nouvelle connexion ne change pas le fuseau choisi', async ({ page }) => {
      await login(page)
      const p = await payload()
      expect((await p.findByID({ collection: 'students', id: data.studentId })).timeZone).toBe('Asia/Jerusalem')
    })
  })
})
