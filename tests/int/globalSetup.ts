import { execFileSync } from 'node:child_process'

/**
 * Repart d'une base de test vide à chaque lancement.
 * Refuse de tourner sur une base dont le nom ne se termine pas par « _test ».
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://langues:langues@localhost:5432/langues_test'
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(`TEST_DATABASE_URL doit pointer vers une base *_test (reçu : ${url})`)
  }
  execFileSync('psql', [url, '-q', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'], {
    stdio: 'inherit',
  })
  process.env.DATABASE_URL = url
}
