# KINGMAKER — Live Beta

The site works in demo mode locally. When deployed to Vercel with a Bitquery OAuth access token in the `BITQUERY_TOKEN` environment variable, `/api/leaderboard` requests current Pump.fun / PumpSwap on-chain data.

## Beginner setup

1. Create a Bitquery account and generate an OAuth access token.
2. Create a free GitHub repository and upload every file/folder from this directory (including `api`).
3. In Vercel choose **Add New → Project**, import the GitHub repository, and deploy it.
4. In **Vercel → Project → Settings → Environment Variables**, add:
   - Name: `BITQUERY_TOKEN`
   - Value: your Bitquery token
5. Redeploy the project.
6. Open the public Vercel URL. The status at the top should change from **DEMO DATA** to **LIVE ON-CHAIN**.

Never put the Bitquery token into `app.js` or `index.html`; the serverless API keeps it private.

## Current KING SCORE v1.0

- Unique traders — 30
- Current market cap — 20
- Market-cap retention vs peak in selected period — 20
- Trading volume — 20
- PumpSwap graduation — 10

A deployer is represented by its best-scoring launch. The beta uses Bitquery's MEV-filtered Trading cube. Deeper wash-trade / related-wallet clustering is a later scoring revision.
