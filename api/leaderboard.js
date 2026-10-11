const memoryCache = global.__kingmakerSupabaseCacheV21 || (global.__kingmakerSupabaseCacheV21 = new Map());
const CACHE_MS = 60 * 1000;

const SCORE_VERSION = '2.1';
const MIN_TXNS = 50;
const MIN_VOLUME = 5000;
const RETENTION_FULL_WEIGHT_MINUTES = 180;

// Lightweight public-display moderation. These tokens are excluded from the public leaderboard,
// but remain untouched in the database.
const BLOCKED_FRAGMENTS = [
  'nigger', 'nigga', 'nigr', 'faggot', 'kike', 'chink'
];

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

async function buildLeaderboard(range) {
  const hours = hoursFor(range);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const select = [
    'mint','creator','name','symbol','created_at','graduated','graduated_at',
    'market_cap_usd','peak_market_cap_usd','volume_24h_usd','liquidity_usd',
    'txns_24h','buys_24h','sells_24h','price_change_24h','updated_at'
  ].join(',');

  const qs = new URLSearchParams();
  qs.set('select', select);
  qs.set('created_at', `gte.${since}`);
  qs.set('or', '(market_cap_usd.gt.0,volume_24h_usd.gt.0,graduated.eq.true)');
  qs.set('order', 'market_cap_usd.desc.nullslast');
  qs.set('limit', '2000');

  const rows = await sbGet(`tokens?${qs.toString()}`);
  if (!Array.isArray(rows)) throw new Error('Unexpected Supabase response');

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

  const safeTokens = allTokens.filter(x => isBrandSafe(x.name, x.symbol));
  const eligible = safeTokens.filter(x => x.txns >= MIN_TXNS && x.volume >= MIN_VOLUME);

  if (!eligible.length) {
    return {
      ok: true,
      range,
      generatedAt: new Date().toISOString(),
      source: 'PumpPortal → Supabase → DexScreener',
      methodology: 'KING SCORE v2.1 — 25 MC / 25 volume / 20 transactions / 15 retention / 10 graduation / 5 liquidity',
      eligibility: `≥${MIN_TXNS} txns and ≥$${MIN_VOLUME.toLocaleString('en-US')} 24h volume`,
      scannedTokens: allTokens.length,
      brandSafeTokens: safeTokens.length,
      eligibleTokens: 0,
      leaders: []
    };
  }

  const mcVals = eligible.map(x => x.currentMc);
  const volVals = eligible.map(x => x.volume);
  const txnVals = eligible.map(x => x.txns);
  const liqVals = eligible.map(x => x.liquidity);

  for (const x of eligible) {
    const mcScore = percentile(x.currentMc, mcVals) * 25;
    const volumeScore = percentile(x.volume, volVals) * 25;
    const txScore = percentile(x.txns, txnVals) * 20;
    const retentionScore = Math.max(0, Math.min(1, x.retention / 100)) * 15 * x.retentionMaturity;
    const graduationScore = x.graduated ? 10 : 0;
    const liquidityScore = percentile(x.liquidity, liqVals) * 5;
    x.score = mcScore + volumeScore + txScore + retentionScore + graduationScore + liquidityScore;
  }

  // One deployer = its strongest eligible launch in the selected period.
  const bestByCreator = new Map();
  for (const x of eligible) {
    const prev = bestByCreator.get(x.creator);
    if (!prev || x.score > prev.score || (x.score === prev.score && x.currentMc > prev.currentMc)) {
      bestByCreator.set(x.creator, x);
    }
  }

  const leaders = [...bestByCreator.values()]
    .sort((a, b) => (b.score - a.score) || (b.currentMc - a.currentMc) || (b.volume - a.volume))
    .slice(0, 10)
    .map((x, i) => ({
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
      transactions: x.txns,
      buys: x.buys,
      sells: x.sells,
      volume: x.volume,
      liquidity: x.liquidity,
      priceChange24h: x.priceChange24h,
      graduated: x.graduated,
      score: Number(x.score.toFixed(1))
    }));

  return {
    ok: true,
    range,
    generatedAt: new Date().toISOString(),
    source: 'PumpPortal → Supabase → DexScreener',
    methodology: 'KING SCORE v2.1 — 25 MC / 25 volume / 20 transactions / 15 retention / 10 graduation / 5 liquidity',
    eligibility: `≥${MIN_TXNS} txns and ≥$${MIN_VOLUME.toLocaleString('en-US')} 24h volume; retention reaches full weight after ${RETENTION_FULL_WEIGHT_MINUTES / 60}h`,
    scannedTokens: allTokens.length,
    brandSafeTokens: safeTokens.length,
    eligibleTokens: eligible.length,
    leaders
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
