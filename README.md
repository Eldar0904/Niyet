# Niyet

A Kazakh reading and prayer tracker for private groups. Emerald, warm paper and gold, with Kazakh ornament switches and a mobile layout.

![Desktop preview](screenshots/desktop.png)

[Mobile preview](screenshots/mobile.png)

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run setup
npm run dev
```

Open http://localhost:3000. Your generated admin PIN is in `.env.local`. Click **Әкімші**, enter the PIN, rename the two groups if needed, and create an invitation link for each. Open a link and enter a name to join. No sample participant records are included.

Local records live in `.data/state.json`; they are not committed. Tests use a separate temporary directory.

```sh
npm test
npm run build
```

## Deploy to Vercel

1. Import this repository in Vercel. Use **Other** as the framework preset, `npm run build` as the build command, and `public` as the output directory. The `api/index.js` function serves the API; `vercel.json` routes private links and API requests.
2. Connect a PostgreSQL database and set **DATABASE_URL** to its pooled connection URL. Use the provider's SSL-enabled URL. Production requires a database; local file storage is deliberately disabled on Vercel.
3. Add **ADMIN_PIN**, your own 6–12 digit PIN, and **AUTH_SECRET**, at least 32 random characters. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Keep secrets in Vercel environment settings, never in Git.
4. Deploy. Visit `/admin`, log in, create invitation links, and share each only with its intended group. The database table is created on the first API request. Production starts with its own empty records.

Keep AUTH_SECRET stable: it encrypts stored invitation tokens. Back up your database and secret together. Changing ADMIN_PIN does not revoke an existing admin session (expires after eight hours); for immediate revocation remove admin sessions from the database state. No deployment is performed by this project setup.

## Behavior

- Бүгін: enter pages and mark prayers/fasting; explicitly save. Saved entries can be edited during the current week through today.
- Апта: personal daily totals, pages, **Менің ұпайым**, and **Топтық ұпай** (sum of members' weekly scores).
- Топ: the only leaderboard. Equal scores share a rank. Weekly admin comments appear beside participants.
- The calendar uses Asia/Qyzylorda (Kazakhstan time). Weeks begin Monday.
- Admin manages both groups, regenerates links, adds activities, and schedules scoring rules for next Monday. Earned scores cannot be edited directly. Activities and scoring rules are shared across groups.
- Replacing an invitation invalidates the old link without removing current members.
- Membership is remembered in an HttpOnly browser cookie for 120 days. This initial version has no account recovery or cross-device login. Keep using the browser where you joined; clearing cookies or switching devices requires a new participant name. This is a deliberate first-version limitation, not full account authentication.
- PWA: use **Орнату**, or the browser's Add to Home Screen / Install command. HTTPS is required outside localhost. The shell can be cached, but records need a live server; offline writes are not queued.

## Data and security

Participant sessions authorize group-scoped reads and personal writes. Client-supplied totals are ignored. PIN attempts are limited, admin sessions expire, and invitation tokens are random and encrypted at rest. Anyone holding an invitation can join that group: treat links as private.

PostgreSQL stores a small-group state document in one row. Transactions lock that row to avoid lost simultaneous updates. This suits the intended two small groups; large-scale use would warrant normalized tables and full account recovery. The local JSON adapter is for one development server only.

## Assets

Noto Sans and Noto Serif are self-hosted; their font metadata contains their license and attribution. The ornament is adapted from the Kazakh ornamental band in `flag-icons` 7.5.0, under MIT; see `THIRD_PARTY_LICENSES.md`. No external analytics, images, fonts, or Sites plugin are used.
