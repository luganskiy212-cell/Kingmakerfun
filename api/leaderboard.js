const memoryCache = global.__kingmakerSupabaseCacheV26 || (global.__kingmakerSupabaseCacheV26 = new Map());
const CACHE_MS = 60 * 1000;

const SCORE_VERSION = '2.6';
const MIN_TXNS = 50;
const MIN_VOLUME = 5000;
const KING_MIN_AGE_MINUTES = 60;
const RETENTION_FULL_WEIGHT_MINUTES = 180;

// Lightweight public-display moderation. Tokens remain in the database; only public display is filtered.
const BLOCKED_FRAGMENTS = [
  'nigger', 'nigga', 'nigr', 'faggot', 'kike', 'chink'
];

const SUPPORTED_PAIR_ASSET_MINTS = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp',
  'Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x',
  'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W',
  'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re',
  'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN',
  'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
  'XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg',
  'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
  'XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1',
  'Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg',
  'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu',
  'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ',
  'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu',
  'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ',
  'XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2',
  'XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo',
  'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX',
  'XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4',
  'Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH',
  'XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ',
  'Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc',
  'XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM',
  'XsfCC9VL4DamVGNgdJpfLXB3sBVa158Gbx8sh7NzmTk',
  'PEAQjk7SRS6rXHVFFmpRr7zrC4g5ZuEebpwTxvaLr3b',
  'NKEda5nHhNGgjrE9nDdMvaEmkmJ96qqxzBVZEcKmjSg',
  'DoGEV7LASBkQbibMc5k5vKnTZoMg423GpJ5QtJEGfm7R',
  'ARBzQTYDCW2KnVEjs1Mc81LekB1ibVFZKbSVmorkoT9d',
  'AMC1qwR9KhiyrQBRPrxnfo4JfMeMZqEBvt5tgTytNNoc',
  'GPRR2u6NS5yBQHWGauoJ9HXgjrTH8dDsrBfTV5zAYvDH',
  '98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g',
  'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS',
  '3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG',
  '6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2',
  'WXMRyRZhsa19ety5erZhHg4N3xj3EVN92u94422teJp',
  'BArimz1PcKZr8PcPh3tcZ2dg4S7FJLk3cw6R5F8GsHKg',
  'DJTu7vi8norVzdVAffgvb39VP7wjKeTsgaMBJrzfxvoF',
  'HiMSSzzwkZkrXJ4PGVJRdtfLaANeAztjjcgk5Dxe7Lwx',
  'BMKdM4yUxX12moFqVk195k7coMbaybd4RUKCUdm7D1Sk',
  'JNJg1znKdF712Phe7L7z52AATAvEjEytBdN2w8Lnh1Y',
  'LMT3i1BHgixFqPUgcyteJhnEz2dpy9i3cYy4pi9BoeV',
  'EicWvteVi2fWepEzS3FYWsnuPoP6caZfjnKqNvydLjCH',
  'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
  'BABANGA4JE7Kkam4nTrALAwAVgsNJUuFJnnkF7S16BZp',
  'BULL151gUXcFV5wXEUqu9Am2L7Qt4bTJRLRuAUjkcspC',
  'CZEB3WNZuF2Yz1z2H81RcCk8T7fsw82KB33zqamASVsg',
  'DELL2aRKQz7DMq5DrKLtkn47ZCnbxXPZXrSGbkmd13wy',
  '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump',
  'DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow',
  'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',
  'GRNDYDpqwpCm6jVxpbh4xT5AM4r3p391qYsKTHqgaET2',
  'DNUTsCvKbKwu2RM72cUuW3TD9YpzArzACcqYQssjPLSk',
  'J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump',
  '6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump',
  '6NwarBvDkXhByqVp2Qkq5i9XbtA2B3Bwe8SWGu9vpump',
  'he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A',
  'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
  'Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
  'METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL',
  '8XtRWb4uAAJFMP4QQhoYYCWR6XXb7ybcCdiqPwz9s5WS',
  'GkyPYa7NnCFbduLknCfBfP7p8564X1VZhwZYJ6CZpump',
]);


function env() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url) throw new Error('SUPABASE_URL is not configured');
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not configured');
  return { url, key };
}

async function sbGet(path) {
  const { url, key } = env();
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: 'application/json'
    }
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) {
    const msg = body?.message || body?.hint || body?.details || `Supabase HTTP ${r.status}`;
    throw new Error(msg);
  }
  return body;
}

async function fetchQualifiedRows({ since, select }) {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let pagesFetched = 0;
  const rows = [];

  while (true) {
    const qs = new URLSearchParams();
    qs.set('select', select);
    qs.set('created_at', `gte.${since}`);
    qs.set('txns_24h', `gte.${MIN_TXNS}`);
    qs.set('volume_24h_usd', `gte.${MIN_VOLUME}`);
    qs.set('order', 'market_cap_usd.desc.nullslast,mint.asc');
    qs.set('limit', String(PAGE_SIZE));
    qs.set('offset', String(offset));

    const page = await sbGet(`tokens?${qs.toString()}`);
    if (!Array.isArray(page)) throw new Error('Unexpected Supabase response');

    rows.push(...page);
    pagesFetched += 1;

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { rows, pagesFetched };
}

function hoursFor(range) {
  if (range === '7d') return 168;
  if (range === '30d') return 720;
  return 24;
}

function percentile(value, values) {
  const clean = values
    .map(Number)
    .filter(Number.isFinite)
    .map(v => Math.max(0, v));
  if (!clean.length || !Number.isFinite(Number(value))) return 0;
  if (clean.length === 1) return 1;
  const transformed = clean.map(v => Math.log1p(v)).sort((a, b) => a - b);
  const needle = Math.log1p(Math.max(0, Number(value)));
  let below = 0;
  for (const v of transformed) if (v <= needle) below++;
  return Math.max(0, Math.min(1, (below - 1) / (transformed.length - 1)));
}

function short(addr = '') {
  return addr.length > 10 ? `${addr.slice(0, 4)}...${addr.slice(-3)}` : addr;
}

function safeText(v = '') {
  return String(v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
}

function isBrandSafe(name, symbol) {
  const haystack = `${name || ''} ${symbol || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !BLOCKED_FRAGMENTS.some(x => haystack.includes(x));
}

function ageMinutes(createdAt) {
  const t = Date.parse(createdAt || '');
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / 60000);
}

function drawdownPenalty(retention) {
  const r = Number(retention || 0);
  if (r >= 70) return 0;
  if (r >= 40) return 5;
  if (r >= 20) return 10;
  if (r >= 5) return 20;
  return 30;
}

function publicToken(x, i) {
  return {
    rank: i + 1,
    creator: x.creator,
    creatorShort: short(x.creator),
    mint: x.mint,
    symbol: x.symbol,
    name: x.name,
    currentMc: x.currentMc,
    observedPeakMc: x.peakMc,
    peakMc: x.peakMc,
    retention: x.retention,
    retentionMaturity: x.retentionMaturity,
    ageMinutes: Math.round(x.ageMinutes),
    eligibleInMinutes: Math.max(0, Math.ceil(KING_MIN_AGE_MINUTES - x.ageMinutes)),
    transactions: x.txns,
    buys: x.buys,
    sells: x.sells,
    volume: x.volume,
    liquidity: x.liquidity,
    priceChange24h: x.priceChange24h,
    graduated: x.graduated,
    baseScore: Number(x.baseScore.toFixed(1)),
    drawdownPenalty: x.drawdownPenalty,
    score: Number(x.score.toFixed(1))
  };
}

async function buildLeaderboard(range) {
  const hours = hoursFor(range);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const select = [
    'mint','creator','name','symbol','created_at','graduated','graduated_at',
    'market_cap_usd','peak_market_cap_usd','volume_24h_usd','liquidity_usd',
    'txns_24h','buys_24h','sells_24h','price_change_24h','updated_at'
  ].join(',');

  // v2.6: filter qualified launches inside Supabase and paginate through all matches.
  // This avoids the 1,000-row project cap hiding eligible deployers during busy periods.
  const { rows, pagesFetched } = await fetchQualifiedRows({ since, select });

  const allTokens = rows.map(r => {
    const currentMc = Number(r.market_cap_usd || 0);
    const peakMc = Math.max(Number(r.peak_market_cap_usd || 0), currentMc);
    const volume = Number(r.volume_24h_usd || 0);
    const txns = Number(r.txns_24h || 0);
    const liquidity = Number(r.liquidity_usd || 0);
    const retention = peakMc > 0 ? Math.max(0, Math.min(100, currentMc / peakMc * 100)) : 0;
    const ageMins = ageMinutes(r.created_at);
    const retentionMaturity = Math.max(0, Math.min(1, ageMins / RETENTION_FULL_WEIGHT_MINUTES));
    return {
      mint: r.mint,
      creator: r.creator,
      name: safeText(r.name || ''),
      symbol: safeText(r.symbol || '?'),
      createdAt: r.created_at,
      graduated: Boolean(r.graduated),
      currentMc,
      peakMc,
      volume,
      liquidity,
      txns,
      buys: Number(r.buys_24h || 0),
      sells: Number(r.sells_24h || 0),
      priceChange24h: Number(r.price_change_24h || 0),
      retention,
      ageMinutes: ageMins,
      retentionMaturity
    };
  }).filter(x => x.creator && x.mint && (x.currentMc > 0 || x.volume > 0 || x.graduated));

  const nonPairAssetTokens = allTokens.filter(x => !SUPPORTED_PAIR_ASSET_MINTS.has(x.mint));
  const safeTokens = nonPairAssetTokens.filter(x => isBrandSafe(x.name, x.symbol));

  // Supabase already applied the activity qualification. Keep this defensive check
  // in case malformed/null rows slip through.
  // Under 60 minutes = LIVE CHALLENGER, 60+ minutes = eligible for the crown.
  const qualified = safeTokens.filter(x => x.txns >= MIN_TXNS && x.volume >= MIN_VOLUME);
  const kingEligible = qualified.filter(x => x.ageMinutes >= KING_MIN_AGE_MINUTES);
  const challengerEligible = qualified.filter(x => x.ageMinutes < KING_MIN_AGE_MINUTES);

  if (qualified.length) {
    // Use one comparison pool so challenger/king scores stay on the same scale.
    const mcVals = qualified.map(x => x.currentMc);
    const volVals = qualified.map(x => x.volume);
    const txnVals = qualified.map(x => x.txns);
    const liqVals = qualified.map(x => x.liquidity);

    for (const x of qualified) {
      const mcScore = percentile(x.currentMc, mcVals) * 25;
      const volumeScore = percentile(x.volume, volVals) * 25;
      const txScore = percentile(x.txns, txnVals) * 20;
      const retentionScore = Math.max(0, Math.min(1, x.retention / 100)) * 15 * x.retentionMaturity;
      const graduationScore = x.graduated ? 10 : 0;
      const liquidityScore = percentile(x.liquidity, liqVals) * 5;
      x.baseScore = mcScore + volumeScore + txScore + retentionScore + graduationScore + liquidityScore;
      x.drawdownPenalty = drawdownPenalty(x.retention);
      x.score = Math.max(0, x.baseScore - x.drawdownPenalty);
    }
  }

  function bestPerCreator(list) {
    const map = new Map();
    for (const x of list) {
      const prev = map.get(x.creator);
      if (!prev || x.score > prev.score || (x.score === prev.score && x.currentMc > prev.currentMc)) {
        map.set(x.creator, x);
      }
    }
    return [...map.values()]
      .sort((a, b) => (b.score - a.score) || (b.currentMc - a.currentMc) || (b.volume - a.volume));
  }

  const leaders = bestPerCreator(kingEligible).slice(0, 10).map(publicToken);
  const challengers = bestPerCreator(challengerEligible).slice(0, 5).map(publicToken);

  return {
    ok: true,
    range,
    generatedAt: new Date().toISOString(),
    source: 'PumpPortal → Supabase → DexScreener',
    methodology: 'KING SCORE v2.6 — 25 MC / 25 volume / 20 transactions / 15 retention / 10 graduation / 5 liquidity − drawdown penalty',
    eligibility: `Crown: ≥${MIN_TXNS} txns, ≥$${MIN_VOLUME.toLocaleString('en-US')} 24h volume and ≥${KING_MIN_AGE_MINUTES}m old. Under ${KING_MIN_AGE_MINUTES}m = LIVE CHALLENGER.`,
    drawdownRule: 'Retention ≥70%: 0; 40–69.99%: −5; 20–39.99%: −10; 5–19.99%: −20; <5%: −30',
    dataIntegrity: 'DexScreener base-token pair only; supported pair-asset mints excluded + pre-launch pair guard; Supabase server-side qualification + full pagination',
    scannedTokens: allTokens.length,
    qualifiedTokensFetched: rows.length,
    pagesFetched,
    pairAssetFilteredTokens: allTokens.length - nonPairAssetTokens.length,
    brandSafeTokens: safeTokens.length,
    qualifiedTokens: qualified.length,
    eligibleTokens: kingEligible.length,
    challengerTokens: challengerEligible.length,
    leaders,
    challengers
  };
}

module.exports = async function handler(req, res) {
  const range = String(req.query.range || '24h').toLowerCase();
  if (!['24h', '7d', '30d'].includes(range)) {
    return res.status(400).json({ ok: false, error: 'Unsupported range' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  const cached = memoryCache.get(range);
  if (cached && Date.now() - cached.time < CACHE_MS) {
    return res.status(200).json({ ...cached.data, cache: 'HIT' });
  }

  try {
    const data = await buildLeaderboard(range);
    memoryCache.set(range, { time: Date.now(), data });
    return res.status(200).json({ ...data, cache: 'MISS' });
  } catch (e) {
    return res.status(503).json({
      ok: false,
      error: String(e.message || e),
      hint: 'Check SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel Environment Variables.'
    });
  }
};
