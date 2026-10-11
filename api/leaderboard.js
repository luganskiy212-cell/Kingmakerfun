const BITQUERY_URL = 'https://streaming.bitquery.io/graphql';
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

// Warm-instance cache. Vercel's CDN cache header below is the main cache;
// this additionally prevents repeated calls inside the same function instance.
const memoryCache = global.__kingmakerCache || (global.__kingmakerCache = new Map());
const inFlight = global.__kingmakerInflight || (global.__kingmakerInflight = new Map());
const CACHE_MS = 5 * 60 * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function gqlEscape(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function gqlList(items) {
  return `[${items.map(x => `"${gqlEscape(x)}"`).join(',')}]`;
}

async function bitquery(query, attempt = 0) {
  const token = process.env.BITQUERY_TOKEN;
  if (!token) throw new Error('BITQUERY_TOKEN is not configured');

  const r = await fetch(BITQUERY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  });

  const payload = await r.json().catch(() => ({}));
  const msg = payload?.errors?.[0]?.message || (!r.ok ? `Bitquery HTTP ${r.status}` : '');

  // Trial accounts can allow only a very small number of active sessions.
  // Wait for the previous query to fully release before retrying.
  if ((msg || '').toLowerCase().includes('session limit') && attempt < 2) {
    await sleep(1800 * (attempt + 1));
    return bitquery(query, attempt + 1);
  }

  if (!r.ok || payload.errors) throw new Error(msg || 'Bitquery request failed');
  return payload.data;
}

function pairQuery(hours) {
  const where = family => `{
    Block:{Time:{since_relative:{hours_ago:${hours}}}},
    Interval:{Time:{Duration:{eq:1}}},
    Market:{ProtocolFamily:{is:"${family}"}},
    Token:{Network:{is:"Solana"}},
    Volume:{Usd:{gt:250}}
  }`;
  const fields = `
    Token { Name Symbol Address Id Network }
    Block { Time }
    Market { Protocol ProtocolFamily }
    Supply { MarketCap TotalSupply FullyDilutedValuationUsd }
    Volume { Usd }
  `;
  return `query {
    Trading {
      pumpPeak: Pairs(limit:{count:40},limitBy:{count:1,by:Token_Id},orderBy:{descending:Supply_MarketCap},where:${where('Pumpfun')}) { ${fields} }
      swapPeak: Pairs(limit:{count:40},limitBy:{count:1,by:Token_Id},orderBy:{descending:Supply_MarketCap},where:${where('Pumpswap')}) { ${fields} }
      pumpCurrent: Pairs(limit:{count:60},limitBy:{count:1,by:Token_Id},orderBy:{descending:Block_Time},where:${where('Pumpfun')}) { ${fields} }
      swapCurrent: Pairs(limit:{count:60},limitBy:{count:1,by:Token_Id},orderBy:{descending:Block_Time},where:${where('Pumpswap')}) { ${fields} }
    }
  }`;
}

function metricsQuery(hours, mints) {
  return `query {
    Trading {
      Trades(
        limit:{count:150}
        orderBy:{descendingByField:"unique_traders"}
        where:{
          Block:{Time:{since_relative:{hours_ago:${hours}}}},
          Pair:{Token:{Address:{in:${gqlList(mints)}}},Market:{Network:{is:"Solana"}}}
        }
      ) {
        Pair { Token { Address Name Symbol } }
        unique_traders: count(distinct:Trader_Address)
        transactions: count(distinct:TransactionHeader_Hash)
        volume_usd: sum(of:AmountsInUsd_Quote)
      }
    }
  }`;
}

function creatorQuery(mints) {
  return `query {
    Solana {
      TokenSupplyUpdates(
        limit:{count:${Math.min(Math.max(mints.length * 2, 40), 160)}}
        where:{
          TokenSupplyUpdate:{Currency:{MintAddress:{in:${gqlList(mints)}}}},
          Instruction:{Program:{Address:{is:"${PUMP_PROGRAM}"},Method:{in:["create","create_v2"]}}},
          Transaction:{Result:{Success:true}}
        }
      ) {
        Transaction { Signer }
        TokenSupplyUpdate { Currency { MintAddress } }
      }
    }
  }`;
}

function percentile(value, values) {
  const clean = values.filter(Number.isFinite).sort((a,b)=>a-b);
  if (!clean.length || !Number.isFinite(value)) return 0;
  if (clean.length === 1) return 1;
  const lv = Math.log1p(Math.max(0,value));
  const transformed = clean.map(v=>Math.log1p(Math.max(0,v))).sort((a,b)=>a-b);
  let below = 0;
  for (const v of transformed) if (v <= lv) below++;
  return Math.max(0, Math.min(1, (below - 1) / (transformed.length - 1)));
}
function short(addr='') {
  return addr.length > 10 ? `${addr.slice(0,4)}...${addr.slice(-3)}` : addr;
}

async function buildLeaderboard(range) {
  const hours = range === '7d' ? 168 : range === '30d' ? 720 : 24;

  // IMPORTANT: these are deliberately sequential. Do not use Promise.all here.
  const pairData = await bitquery(pairQuery(hours));
  await sleep(350);

  const t = pairData?.Trading || {};
  const peakRows = [...(t.pumpPeak || []), ...(t.swapPeak || [])];
  const currentRows = [...(t.pumpCurrent || []), ...(t.swapCurrent || [])];
  const graduatedSet = new Set(
    [...(t.swapPeak || []), ...(t.swapCurrent || [])]
      .map(x=>x?.Token?.Address)
      .filter(Boolean)
  );

  const byMint = new Map();
  for (const row of peakRows) {
    const mint = row?.Token?.Address;
    if (!mint) continue;
    const mc = Number(row?.Supply?.MarketCap || 0);
    const prev = byMint.get(mint) || {mint, token:row.Token, peakMc:0, currentMc:0, currentTime:''};
    prev.peakMc = Math.max(prev.peakMc, mc);
    prev.token = prev.token || row.Token;
    byMint.set(mint, prev);
  }
  for (const row of currentRows) {
    const mint = row?.Token?.Address;
    if (!mint) continue;
    const mc = Number(row?.Supply?.MarketCap || 0);
    const tm = row?.Block?.Time || '';
    const prev = byMint.get(mint) || {mint, token:row.Token, peakMc:mc, currentMc:0, currentTime:''};
    if (!prev.currentTime || tm > prev.currentTime) {
      prev.currentMc = mc;
      prev.currentTime = tm;
      prev.token = row.Token || prev.token;
    }
    prev.peakMc = Math.max(prev.peakMc, mc);
    byMint.set(mint, prev);
  }

  const candidates = [...byMint.values()]
    .filter(x=>x.peakMc > 0)
    .sort((a,b)=>b.peakMc-a.peakMc)
    .slice(0,40);
  const mints = candidates.map(x=>x.mint);
  if (!mints.length) throw new Error('No Pump.fun candidates returned by Bitquery');

  const metricData = await bitquery(metricsQuery(hours, mints));
  await sleep(500);
  const creatorData = await bitquery(creatorQuery(mints));

  const metrics = new Map();
  for (const row of metricData?.Trading?.Trades || []) {
    const mint = row?.Pair?.Token?.Address;
    if (!mint) continue;
    metrics.set(mint, {
      traders:Number(row.unique_traders || 0),
      txs:Number(row.transactions || 0),
      volume:Number(row.volume_usd || 0)
    });
  }

  const creators = new Map();
  for (const row of creatorData?.Solana?.TokenSupplyUpdates || []) {
    const mint = row?.TokenSupplyUpdate?.Currency?.MintAddress;
    const signer = row?.Transaction?.Signer;
    if (mint && signer && !creators.has(mint)) creators.set(mint, signer);
  }

  const enriched = candidates.map(c => {
    const m = metrics.get(c.mint) || {traders:0,txs:0,volume:0};
    const currentMc = c.currentMc || c.peakMc;
    const retention = c.peakMc > 0 ? Math.min(100, currentMc / c.peakMc * 100) : 0;
    return {
      ...c,
      ...m,
      currentMc,
      retention,
      creator:creators.get(c.mint),
      graduated:graduatedSet.has(c.mint)
    };
  }).filter(x=>x.creator && x.traders > 0);

  const mcVals = enriched.map(x=>x.currentMc);
  const trVals = enriched.map(x=>x.traders);
  const volVals = enriched.map(x=>x.volume);

  for (const x of enriched) {
    const tradersScore = percentile(x.traders,trVals)*30;
    const mcScore = percentile(x.currentMc,mcVals)*20;
    const retentionScore = Math.max(0,Math.min(1,x.retention/100))*20;
    const volumeScore = percentile(x.volume,volVals)*20;
    const graduationScore = x.graduated ? 10 : 0;
    x.score = tradersScore + mcScore + retentionScore + volumeScore + graduationScore;
  }

  const bestByCreator = new Map();
  for (const x of enriched) {
    const prev = bestByCreator.get(x.creator);
    if (!prev || x.score > prev.score) bestByCreator.set(x.creator, x);
  }

  const leaders = [...bestByCreator.values()]
    .sort((a,b)=>b.score-a.score)
    .slice(0,10)
    .map((x,i)=>({
      rank:i+1,
      creator:x.creator,
      creatorShort:short(x.creator),
      mint:x.mint,
      symbol:x.token?.Symbol || '?',
      name:x.token?.Name || '',
      currentMc:x.currentMc,
      peakMc:x.peakMc,
      retention:x.retention,
      traders:x.traders,
      transactions:x.txs,
      volume:x.volume,
      graduated:x.graduated,
      score:Number(x.score.toFixed(1))
    }));

  return {
    ok:true,
    range,
    generatedAt:new Date().toISOString(),
    methodology:'KING SCORE v1.1 — 30 traders / 20 current MC / 20 retention / 20 volume / 10 graduation',
    leaders
  };
}

module.exports = async function handler(req, res) {
  const range = String(req.query.range || '24h').toLowerCase();
  if (!['24h','7d','30d'].includes(range)) {
    return res.status(400).json({ok:false,error:'Unsupported range'});
  }

  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=900');

  const cached = memoryCache.get(range);
  if (cached && Date.now() - cached.time < CACHE_MS) {
    return res.status(200).json({...cached.data, cache:'HIT'});
  }

  try {
    let promise = inFlight.get(range);
    if (!promise) {
      promise = buildLeaderboard(range).finally(() => inFlight.delete(range));
      inFlight.set(range, promise);
    }
    const data = await promise;
    memoryCache.set(range, {time:Date.now(), data});
    return res.status(200).json({...data, cache:'MISS'});
  } catch (e) {
    return res.status(503).json({
      ok:false,
      error:String(e.message || e),
      hint:'If Bitquery reports a session limit, close Bitquery IDE tabs and retry after ~30 seconds.'
    });
  }
};
