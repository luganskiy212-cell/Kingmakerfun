const BITQUERY_URL = 'https://streaming.bitquery.io/graphql';
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

function gqlEscape(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function gqlList(items) {
  return `[${items.map(x => `"${gqlEscape(x)}"`).join(',')}]`;
}
async function bitquery(query) {
  const token = process.env.BITQUERY_TOKEN;
  if (!token) throw new Error('BITQUERY_TOKEN is not configured');
  const r = await fetch(BITQUERY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query })
  });
  const payload = await r.json().catch(() => ({}));
  if (!r.ok || payload.errors) {
    const msg = payload?.errors?.[0]?.message || `Bitquery HTTP ${r.status}`;
    throw new Error(msg);
  }
  return payload.data;
}
function pairQuery(hours) {
  const where = family => `{
    Block:{Time:{since_relative:{hours_ago:${hours}}}},
    Interval:{Time:{Duration:{eq:1}}},
    Market:{ProtocolFamily:{is:"${family}"}},
    Token:{Network:{is:"Solana"}},
    Volume:{Usd:{gt:100}}
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
      pumpPeak: Pairs(limit:{count:60},limitBy:{count:1,by:Token_Id},orderBy:{descending:Supply_MarketCap},where:${where('Pumpfun')}) { ${fields} }
      swapPeak: Pairs(limit:{count:60},limitBy:{count:1,by:Token_Id},orderBy:{descending:Supply_MarketCap},where:${where('Pumpswap')}) { ${fields} }
      pumpCurrent: Pairs(limit:{count:120},limitBy:{count:1,by:Token_Id},orderBy:{descending:Block_Time},where:${where('Pumpfun')}) { ${fields} }
      swapCurrent: Pairs(limit:{count:120},limitBy:{count:1,by:Token_Id},orderBy:{descending:Block_Time},where:${where('Pumpswap')}) { ${fields} }
    }
  }`;
}
function metricsQuery(hours, mints) {
  return `query {
    Trading {
      Trades(
        limit:{count:250}
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
        buy_volume: sum(of:AmountsInUsd_Quote,if:{Side:{is:"Buy"}})
        sell_volume: sum(of:AmountsInUsd_Quote,if:{Side:{is:"Sell"}})
      }
    }
  }`;
}
function creatorQuery(mints) {
  return `query {
    Solana {
      TokenSupplyUpdates(
        limit:{count:${Math.min(Math.max(mints.length * 2, 50), 500)}}
        where:{
          TokenSupplyUpdate:{Currency:{MintAddress:{in:${gqlList(mints)}}}},
          Instruction:{Program:{Address:{is:"${PUMP_PROGRAM}"},Method:{in:["create","create_v2"]}}},
          Transaction:{Result:{Success:true}}
        }
      ) {
        Block { Time }
        Transaction { Signer Signature }
        TokenSupplyUpdate { Currency { MintAddress Name Symbol } }
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
function short(addr='') { return addr.length > 10 ? `${addr.slice(0,4)}...${addr.slice(-3)}` : addr; }

module.exports = async function handler(req, res) {
  const range = String(req.query.range || '24h').toLowerCase();
  const hours = range === '7d' ? 168 : range === '30d' ? 720 : 24;
  try {
    const pairData = await bitquery(pairQuery(hours));
    const t = pairData?.Trading || {};
    const peakRows = [...(t.pumpPeak || []), ...(t.swapPeak || [])];
    const currentRows = [...(t.pumpCurrent || []), ...(t.swapCurrent || [])];
    const graduatedSet = new Set([...(t.swapPeak || []), ...(t.swapCurrent || [])].map(x=>x?.Token?.Address).filter(Boolean));

    const byMint = new Map();
    for (const row of peakRows) {
      const mint = row?.Token?.Address; if (!mint) continue;
      const mc = Number(row?.Supply?.MarketCap || 0);
      const prev = byMint.get(mint) || { mint, token: row.Token, peakMc:0, currentMc:0, currentTime:'' };
      prev.peakMc = Math.max(prev.peakMc, mc);
      prev.token = prev.token || row.Token;
      byMint.set(mint, prev);
    }
    for (const row of currentRows) {
      const mint = row?.Token?.Address; if (!mint) continue;
      const mc = Number(row?.Supply?.MarketCap || 0);
      const tm = row?.Block?.Time || '';
      const prev = byMint.get(mint) || { mint, token: row.Token, peakMc:mc, currentMc:0, currentTime:'' };
      if (!prev.currentTime || tm > prev.currentTime) { prev.currentMc = mc; prev.currentTime = tm; prev.token = row.Token || prev.token; }
      prev.peakMc = Math.max(prev.peakMc, mc);
      byMint.set(mint, prev);
    }

    const candidates = [...byMint.values()]
      .filter(x=>x.peakMc > 0)
      .sort((a,b)=>b.peakMc-a.peakMc)
      .slice(0,80);
    const mints = candidates.map(x=>x.mint);
    if (!mints.length) throw new Error('No Pump.fun candidates returned by data provider');

    const [metricData, creatorData] = await Promise.all([
      bitquery(metricsQuery(hours, mints)),
      bitquery(creatorQuery(mints))
    ]);

    const metrics = new Map();
    for (const row of metricData?.Trading?.Trades || []) {
      const mint = row?.Pair?.Token?.Address; if (!mint) continue;
      metrics.set(mint, {
        traders:Number(row.unique_traders || 0),
        txs:Number(row.transactions || 0),
        volume:Number(row.volume_usd || 0),
        buyVolume:Number(row.buy_volume || 0),
        sellVolume:Number(row.sell_volume || 0)
      });
    }
    const creators = new Map();
    for (const row of creatorData?.Solana?.TokenSupplyUpdates || []) {
      const mint = row?.TokenSupplyUpdate?.Currency?.MintAddress;
      const signer = row?.Transaction?.Signer;
      if (mint && signer && !creators.has(mint)) creators.set(mint, signer);
    }

    const enriched = candidates.map(c => {
      const m = metrics.get(c.mint) || {traders:0,txs:0,volume:0,buyVolume:0,sellVolume:0};
      const currentMc = c.currentMc || c.peakMc;
      const retention = c.peakMc > 0 ? Math.min(100, currentMc / c.peakMc * 100) : 0;
      return { ...c, ...m, currentMc, retention, creator: creators.get(c.mint), graduated: graduatedSet.has(c.mint) };
    }).filter(x=>x.creator && x.traders > 0);

    const mcVals = enriched.map(x=>x.currentMc);
    const trVals = enriched.map(x=>x.traders);
    const volVals = enriched.map(x=>x.volume);
    for (const x of enriched) {
      // KING SCORE v1.0: traders 30, current MC 20, retention 20, volume 20, graduation 10.
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
    const leaders = [...bestByCreator.values()].sort((a,b)=>b.score-a.score).slice(0,10).map((x,i)=>({
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

    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      ok:true,
      range,
      generatedAt:new Date().toISOString(),
      methodology:'KING SCORE v1.0 — 30 traders / 20 current MC / 20 retention / 20 volume / 10 graduation',
      leaders
    });
  } catch (e) {
    res.status(500).json({ok:false,error:String(e.message || e)});
  }
}
