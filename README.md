# langues-platform

Site de MotàMot, les cours de langues de Catherine (hébreu, anglais, espagnol, français, roumain) : site public en français, anglais et hébreu, CMS, élèves, créneaux et réservations, demandes de cours d'essai, prestations et facturation.

Les règles de développement sont dans [`CLAUDE.md`](CLAUDE.md).

## Stack

Next.js 16 (App Router, TypeScript strict) · Payload CMS 3 · PostgreSQL · police Rubik auto-hébergée (latin + hébreu)

## Démarrer en local

```bash
cp .env.example .env              # puis renseigner DATABASE_URL et PAYLOAD_SECRET
pnpm install
SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… pnpm seed   # contenu de départ + compte de Catherine
pnpm dev
```

- Site : http://localhost:3000 (redirige vers `/fr`, aussi `/en` et `/he`)
- Administration : http://localhost:3000/admin

## Tests

```bash
pnpm vitest run --project unit   # facturation, sans base
pnpm vitest run --project int    # parcours complets sur une base Postgres *_test (TEST_DATABASE_URL)
```

La base de test est vidée à chaque lancement ; le script refuse toute base dont le nom ne finit pas par `_test`.

## Facturation

Tout passe par `src/billing/`. Le reste du code ne connaît ni Mollie ni Smart.

- Les **prestations** sont la source de vérité ; une facture se prépare à partir d'elles (`POST /api/invoices/prepare`).
- Une facture naît **à valider**, sans numéro. Le numéro continu (`F2026-0001`) et la communication structurée sont attribués **à la validation** ; une facture validée ne se supprime plus.
- **Réglages de facturation** dans le CMS : « Moi, comme indépendante » ou « Smart », avec une date de bascule. Avec Smart, pas de numéro propre ni de paiement en ligne ; export CSV des demandes via `GET /api/invoices/smart-export`.
- Paiement en ligne (phase 1) : variable `MOLLIE_API_KEY` + case « Paiement en ligne » dans le CMS.

## À confirmer avant la mise en ligne

Le contenu de départ reprend le pitch MotàMot. Ces éléments restent à valider avec Catherine :

- les tarifs (repris du pitch) et la répartition des langues entre formules ;
- le prix par page de l'aide aux devoirs et le prix de l'atelier parent + enfant (formules masquées) ;
- le pourcentage de la réduction multi-langues (non créée) ;
- le texte « À propos » (section masquée tant qu'il est vide) ;
- les traductions anglaises et hébraïques ;
- le régime de TVA et la mention légale, avec le comptable.
