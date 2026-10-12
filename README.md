# KINGMAKER v3 — Product UI + Hall of Kings

This update leaves the working collector and KING SCORE v2.6 unchanged.

## New
- Clickable deployer profiles (`dev.html?wallet=...`).
- Pump.fun, DexScreener and Solscan links throughout the leaderboard.
- Age added to leaderboard rows.
- Local rank movement indicator (compared with the last leaderboard load in the same browser).
- Real Hall of Kings loaded from the existing `kings` table.
- Developer profile with launch count, graduations, best observed MC, combined current 24H volume, launch history and crown history.
- Daily UTC crown archiver at `/api/crown` via Vercel Cron.
- All arbitrary on-chain token/deployer text is escaped before being rendered into HTML.

## Deploy to the Vercel/GitHub website repo
Replace/add these files at repository root:

- `index.html`
- `app.js`
- `style.css`
- `dev.html`
- `dev.js`
- `api/leaderboard.js`
- `api/hall.js`
- `api/dev.js`
- `api/crown.js`
- `vercel.json`

No Railway collector change is required.

## One-time Supabase migration
Run `SQL_MIGRATION.sql` in Supabase SQL Editor. It creates a unique index so a UTC day can only be crowned once.

## Vercel environment variable
Add one new Secret environment variable:

`CRON_SECRET = <long random value>`

Keep your existing `SUPABASE_URL` and `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` variables.

Vercel Cron calls `/api/crown` once per day at 00:05 UTC. If `CRON_SECRET` exists, Vercel sends it as `Authorization: Bearer <CRON_SECRET>` to secure the cron endpoint.

## Social links
- Telegram: https://t.me/kingmakerfun
- X: https://x.com/KingMakerFun
