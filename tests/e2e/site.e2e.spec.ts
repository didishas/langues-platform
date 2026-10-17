import { expect, test } from '@playwright/test'

import { createE2EData, deleteE2EData, tinyPdf } from './fixtures'

let data: Awaited<ReturnType<typeof createE2EData>>

test.beforeAll(async () => {
  data = await createE2EData()
})

test.afterAll(async () => {
  if (data) await deleteE2EData(data)
})

test.describe('site public', () => {
  test('accueil en français puis en hébreu, mise en page de droite à gauche', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/fr$/)
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.locator('h1').first()).toBeVisible()

    await page.goto('/he')
    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })

  test('aucun défilement horizontal sur téléphone, en hébreu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/he')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})

test.describe('espace élève', () => {
  test('connexion, remise d’un devoir avec fichier, déconnexion', async ({ page }) => {
    await page.goto('/fr/espace')
    await expect(page).toHaveURL(/\/fr\/espace\/connexion$/)

    await page.getByLabel('E-mail').fill(data.student.email)
    await page.getByLabel('Mot de passe').fill('pas-le-bon')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.locator('.form-error[role=alert]')).toHaveText('E-mail ou mot de passe incorrect.')
    await expect(page.getByLabel('E-mail')).toHaveValue(data.student.email)

    await page.getByLabel('Mot de passe').fill(data.password)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL(/\/fr\/espace$/)

    await page.getByRole('link', { name: data.assignment.title }).click()
    const answer = page.getByLabel('Votre réponse')
    if (data.assignment.language) await expect(answer).toHaveAttribute('dir', 'rtl')
    await answer.fill('שלום תודה בבקשה')
    await page.getByLabel(/Joindre des fichiers/).setInputFiles({
      name: 'copie.pdf',
      mimeType: 'application/pdf',
      buffer: tinyPdf(),
    })
    await page.getByRole('button', { name: 'Rendre le devoir' }).click()
    await expect(page.locator('.form-success[role=status]')).toHaveText('Devoir rendu. Catherine le corrigera bientôt.')

    await page.reload()
    await expect(page.getByText('Rendu, en attente de correction')).toBeVisible()
    // Payload renomme le fichier s'il existe déjà (copie-1.pdf…).
    await expect(page.getByRole('link', { name: /^copie(-\d+)?\.pdf$/ })).toBeVisible()

    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page).toHaveURL(/\/fr$/)
    await page.goto('/fr/espace')
    await expect(page).toHaveURL(/\/fr\/espace\/connexion$/)
  })

  test('un fichier privé ne s’ouvre pas sans connexion', async ({ request }) => {
    const res = await request.get('/api/submission-files/file/copie.pdf')
    expect(res.status()).toBe(403)
  })
})

test.describe('administration', () => {
  test('connexion de l’équipe et accès aux formules', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[name=email]').fill(data.staff.email)
    await page.locator('input[name=password]').fill(data.password)
    await page.locator('button[type=submit]').click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByText('Formules et tarifs').first()).toBeVisible()
  })
})
