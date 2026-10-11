const memoryCache = global.__kingmakerSupabaseCache || (global.__kingmakerSupabaseCache = new Map());
const CACHE_MS = 60 * 1000;

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
  const clean = values.map(Number).filter(Number.isFinite).map(v => Math.max(0, v));
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
  // Only fetch launches for which the collector has useful market data.
  qs.set('or', '(market_cap_usd.gt.0,volume_24h_usd.gt.0,graduated.eq.true)');
  qs.set('order', 'market_cap_usd.desc.nullslast');
  qs.set('limit', '1000');

  const rows = await sbGet(`tokens?${qs.toString()}`);
  if (!Array.isArray(rows)) throw new Error('Unexpected Supabase response');

  const tokens = rows.map(r => {
    const currentMc = Number(r.market_cap_usd || 0);
    const peakMc = Math.max(Number(r.peak_market_cap_usd || 0), currentMc);
    const volume = Number(r.volume_24h_usd || 0);
    const txns = Number(r.txns_24h || 0);
    const retention = peakMc > 0 ? Math.max(0, Math.min(100, currentMc / peakMc * 100)) : 0;
    return {
      mint: r.mint,
      creator: r.creator,
      name: r.name || '',
      symbol: r.symbol || '?',
      createdAt: r.created_at,
      graduated: Boolean(r.graduated),
      currentMc,
      peakMc,
      volume,
      liquidity: Number(r.liquidity_usd || 0),
      txns,
      buys: Number(r.buys_24h || 0),
      sells: Number(r.sells_24h || 0),
      priceChange24h: Number(r.price_change_24h || 0),
      retention
    };
  }).filter(x => x.creator && x.mint && (x.currentMc > 0 || x.volume > 0 || x.graduated));

  if (!tokens.length) {
    return {
      ok: true,
      range,
      generatedAt: new Date().toISOString(),
      source: 'PumpPortal → Supabase → DexScreener',
      methodology: 'KING SCORE v2 — 30 MC / 25 volume / 20 retention / 15 transactions / 10 graduation',
      scannedTokens: 0,
      leaders: []
    };
  }

  const mcVals = tokens.map(x => x.currentMc);
  const volVals = tokens.map(x => x.volume);
  const txnVals = tokens.map(x => x.txns);

  for (const x of tokens) {
    const mcScore = percentile(x.currentMc, mcVals) * 30;
    const volumeScore = percentile(x.volume, volVals) * 25;
    const retentionScore = Math.max(0, Math.min(1, x.retention / 100)) * 20;
    const txScore = percentile(x.txns, txnVals) * 15;
    const graduationScore = x.graduated ? 10 : 0;
    x.score = mcScore + volumeScore + retentionScore + txScore + graduationScore;
  }

  // A deployer is represented by the strongest launch in the selected window.
  const bestByCreator = new Map();
  for (const x of tokens) {
    const prev = bestByCreator.get(x.creator);
    if (!prev || x.score > prev.score) bestByCreator.set(x.creator, x);
  }

  const leaders = [...bestByCreator.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x, i) => ({
      rank: i + 1,
      creator: x.creator,
      creatorShort: short(x.creator),
      mint: x.mint,
      symbol: x.symbol,
      name: x.name,
      currentMc: x.currentMc,
      peakMc: x.peakMc,
      retention: x.retention,
      transactions: x.txns,
      // Backward-compatible alias for older frontends.
      traders: x.txns,
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
    methodology: 'KING SCORE v2 — 30 MC / 25 volume / 20 retention / 15 transactions / 10 graduation',
    scannedTokens: tokens.length,
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
