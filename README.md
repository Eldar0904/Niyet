# Niyet

A Kazakh reading and prayer tracker for private groups. Emerald, warm paper and gold, with Kazakh ornament switches and a responsive mobile layout.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run setup
npm run dev
```

Open http://localhost:3000. The setup step creates a local admin PIN and an encryption secret in `.env.local`. The PIN is shown in that file. Local records live in `.data/state.json` and are not committed.

```sh
npm test
npm run build
```

## Deploy on Railway

Niyet runs as one Node.js web service. Railway can deploy it from this GitHub repository. The server serves the site and API together, with a persistent volume for group data.

1. In Railway, create a project and choose **Deploy from GitHub repo**, then select `Eldar0904/Niyet`.
2. In the service settings, add a persistent volume mounted at `/data`. Railway volumes keep the JSON data file across deploys and restarts. Keep the service at one replica because the file store is designed for one running server.
3. Add these service variables:

   | Variable | Value |
   | --- | --- |
   | `ADMIN_PIN` | A private 6–12 digit PIN you choose |
   | `AUTH_SECRET` | A random secret with at least 48 characters |
   | `NIYET_DATA_DIR` | `/data` |

   Generate `AUTH_SECRET` on your computer with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Enter the result directly in Railway Variables; do not share it or commit it.
4. Railway detects the Node app and runs `npm start`. After deployment, open the Railway domain, go to **Әкімші**, enter your PIN, rename the two groups if needed, and create an invitation link for each.

Railway provides `PORT`; Niyet listens on it. `/health` is available for a service health check. Attach the volume before inviting anyone so the first data file is written to persistent storage.

## Behavior

- **Бүгін:** enter pages and mark prayers/fasting; explicitly save. Saved entries can be edited during the current week through today.
- **Апта:** personal daily totals, pages, **Менің ұпайым**, and **Топтық ұпай** (sum of all group members' weekly scores).
- **Топ:** the only leaderboard. Equal scores share a rank. Weekly admin comments appear beside participants.
- The calendar uses Asia/Qyzylorda time. Weeks begin Monday.
- Admin manages both groups, regenerates links, adds activities, schedules scoring rules for next Monday, and writes weekly comments. Earned scores cannot be edited directly.
- Replacing an invitation invalidates the old link without removing current members.
- Each participant is identified by a browser cookie. Clearing browser storage or changing devices means the person will need to join again; there is no account recovery in this first version.
- PWA: use **Орнату**, or the browser's Add to Home Screen / Install command. HTTPS is required outside localhost. The shell can be cached, but records need a live connection; offline writes are not queued.

## Data and security

Admin PINs and session tokens are checked by the server. Invite tokens are stored hashed and encrypted; `AUTH_SECRET` must remain stable or existing invite links will stop working. Anyone holding an invitation can join that group, so treat invitation links as private. Keep Railway backups enabled for the `/data` volume if the records matter to your group.

## Assets

Noto Sans and Noto Serif are self-hosted; their font metadata contains their license and attribution. The hero and welcome pages use a custom `қошқар мүйіз` inspired mark; its paired spirals draw on the traditional motif. The prayer switch ornament remains unchanged. The legacy ornament and switch petal assets retain their flag-icons MIT attribution in `THIRD_PARTY_LICENSES.md`. No external analytics, images, fonts, or Sites plugin are used.
