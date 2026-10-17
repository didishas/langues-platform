import fs from 'fs'
import path from 'path'

import { expect, test, type Page } from '@playwright/test'

import { payload } from './fixtures'

/** Une vidéo d'hébreu avec un exercice de chaque type, et une élève qui apprend l'hébreu. */
let data: { studentId: number; email: string; password: string; videoId: number; filename: string }

test.beforeAll(async () => {
  const p = await payload()
  const stamp = Date.now()
  const password = `e2e-${stamp}-mot-de-passe`
  const hebrew = (await p.find({ collection: 'languages', where: { code: { equals: 'he' } }, limit: 1 })).docs[0]
  const student = await p.create({
    collection: 'students',
    data: { firstName: 'Tamar', lastName: 'E2E', email: `e2e-video-${stamp}@motamot.test`, password, languages: [hebrew.id] } as any,
  })
  const file = fs.readFileSync(path.resolve('src/seed/assets/demo-video.mp4'))
  const video = await p.create({
    collection: 'videos',
    data: {
      title: `Vidéo E2E ${stamp}`,
      language: hebrew.id,
      visibility: 'language',
      published: true,
      showSolutions: true,
      exercises: [
        { blockType: 'mcq', question: 'Comment dit-on « bonbon » ?', options: [{ text: 'סוכריה', correct: true }, { text: 'שולחן' }] },
        { blockType: 'gap', instructions: 'Complétez.', text: 'יש לי [כלב] גדול.' },
        {
          blockType: 'matching',
          pairs: [
            { item: 'אחת', match: 'un' },
            { item: 'שתיים', match: 'deux' },
          ],
        },
        { blockType: 'audio', prompt: 'Dites bonjour.' },
      ],
    } as any,
    file: { data: file, mimetype: 'video/mp4', name: `e2e-${stamp}.mp4`, size: file.length },
  })
  data = { studentId: student.id, email: student.email, password, videoId: video.id, filename: video.filename! }
})

test.afterAll(async () => {
  if (!data) return
  const p = await payload()
  await p.delete({ collection: 'exercise-attempts', where: { student: { equals: data.studentId } } })
  await p.delete({ collection: 'submission-files', where: { owner: { equals: data.studentId } } })
  await p.delete({ collection: 'videos', id: data.videoId })
  await p.delete({ collection: 'students', id: data.studentId })
})

async function login(page: Page, locale: 'fr' | 'he') {
  await page.goto(`/${locale}/espace/connexion`)
  await page.locator('#login-email').fill(data.email)
  await page.locator('#login-password').fill(data.password)
  await page.locator('form button[type=submit]').click()
  await expect(page).toHaveURL(new RegExp(`/${locale}/espace$`))
}

const card = (page: Page, kind: string) => page.locator(`.exercise[data-kind=${kind}]`)

test.describe('vidéothèque', () => {
  test('page en français : exercices d’hébreu de droite à gauche, aucune solution dans la page', async ({ page }) => {
    await login(page, 'fr')
    await page.getByRole('link', { name: 'Vidéos' }).click()
    await page.getByRole('link', { name: /^Vidéo E2E/ }).click()
    await expect(page).toHaveURL(new RegExp(`/fr/espace/videos/${data.videoId}$`))
    // Page complète telle que le serveur l'envoie (HTML + données React), avec la session de l'élève.
    const html = await (await page.request.get(`/fr/espace/videos/${data.videoId}`)).text()
    expect(html).toContain('יש לי') // le texte de l'exercice est bien dans cette réponse…
    expect(html).not.toContain('כלב') // … mais pas le mot à trouver
    expect(html).not.toContain('"correct"')

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(card(page, 'mcq').locator('.choices__list')).toHaveAttribute('dir', 'rtl')
    await expect(card(page, 'gap').locator('.gap-text')).toHaveAttribute('dir', 'rtl')
    await expect(card(page, 'matching').locator('.pairs')).toHaveAttribute('dir', 'rtl')
    await expect(card(page, 'mcq').locator('.exercise__question span')).toHaveAttribute('dir', 'ltr')

    // Le fichier vidéo est servi à l'élève connectée, pas à un visiteur.
    expect((await page.request.get(`/api/videos/file/${data.filename}`)).status()).toBe(200)
  })

  test('QCM, texte à trous avec le clavier hébreu, paires', async ({ page }) => {
    await login(page, 'fr')
    await page.goto(`/fr/espace/videos/${data.videoId}`)

    const mcq = card(page, 'mcq')
    await mcq.getByText('סוכריה').click()
    await mcq.getByRole('button', { name: 'Vérifier' }).click()
    await expect(mcq.locator('.exercise__result')).toContainText('Résultat : 1 sur 1')

    const gap = card(page, 'gap')
    await gap.getByRole('button', { name: 'Clavier hébreu' }).click()
    await gap.getByLabel('Mot manquant 1').click()
    for (const letter of ['כ', 'ל', 'ב']) await gap.getByRole('button', { name: letter, exact: true }).click()
    await expect(gap.getByLabel('Mot manquant 1')).toHaveValue('כלב')
    await gap.getByRole('button', { name: 'Vérifier' }).click()
    await expect(gap.locator('.exercise__result')).toContainText('Résultat : 1 sur 1')

    const pairs = card(page, 'matching')
    await pairs.getByLabel('אחת').selectOption('deux')
    await pairs.getByLabel('שתיים').selectOption('un')
    await pairs.getByRole('button', { name: 'Vérifier' }).click()
    await expect(pairs.locator('.exercise__result')).toContainText('Résultat : 0 sur 2')
    await expect(pairs.locator('.gap__solution').first()).toContainText('un')

    await pairs.getByRole('button', { name: 'Recommencer' }).click()
    await expect(pairs.getByLabel('אחת')).toHaveValue('')
  })

  test('réponse orale envoyée avec un fichier', async ({ page }) => {
    await login(page, 'fr')
    await page.goto(`/fr/espace/videos/${data.videoId}`)
    const audio = card(page, 'audio')
    await audio.getByRole('button', { name: 'Envoyer à Catherine' }).click()
    await expect(audio.locator('.form-error')).toHaveText('Enregistrez ou joignez votre réponse.')
    await audio.getByLabel('Ou joindre un fichier audio').setInputFiles(path.resolve('tests/fixtures/answer.webm'))
    await audio.getByRole('button', { name: 'Envoyer à Catherine' }).click()
    await expect(audio.locator('.form-success')).toHaveText('Réponse envoyée. Catherine l’écoutera.')
  })

  test('en hébreu sur téléphone : de droite à gauche, sans défilement horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'he')
    await page.goto(`/he/espace/videos/${data.videoId}`)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(card(page, 'gap').locator('.gap-text')).toHaveAttribute('dir', 'rtl')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('un visiteur n’accède ni à la page ni au fichier vidéo', async ({ page, request }) => {
    expect((await request.get(`/api/videos/file/${data.filename}`)).status()).toBe(403)
    await page.goto(`/fr/espace/videos/${data.videoId}`)
    await expect(page).toHaveURL(/\/fr\/espace\/connexion$/)
  })
})
