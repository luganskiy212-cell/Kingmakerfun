function env(){const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';if(!url)throw new Error('SUPABASE_URL is not configured');if(!key)throw new Error('SUPABASE_SECRET_KEY is not configured');return{url,key}}
async function sbGet(path){const{url,key}=env();const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:key,authorization:`Bearer ${key}`,accept:'application/json'}});const text=await r.text();let body;try{body=JSON.parse(text)}catch{body=text}if(!r.ok)throw new Error(body?.message||`Supabase HTTP ${r.status}`);return body}
function short(a=''){return a.length>10?`${a.slice(0,4)}...${a.slice(-3)}`:a}
function safe(v=''){return String(v).replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80)}
function ageMinutes(createdAt){const t=Date.parse(createdAt||'');return Number.isFinite(t)?Math.max(0,(Date.now()-t)/60000):0}
async function fetchCreatorTokens(wallet){const pageSize=1000,rows=[];let offset=0;while(true){const qs=new URLSearchParams();qs.set('select','mint,creator,name,symbol,created_at,graduated,market_cap_usd,peak_market_cap_usd,volume_24h_usd,liquidity_usd,txns_24h,buys_24h,sells_24h,price_change_24h');qs.set('creator',`eq.${wallet}`);qs.set('order','created_at.desc');qs.set('limit',String(pageSize));qs.set('offset',String(offset));const page=await sbGet(`tokens?${qs.toString()}`);rows.push(...(page||[]));if(!page||page.length<pageSize)break;offset+=pageSize}return rows}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
  try{
    const wallet=String(req.query.wallet||'').trim();if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet))return res.status(400).json({ok:false,error:'Invalid Solana wallet'});
    const rows=await fetchCreatorTokens(wallet);
    const tokens=rows.map(r=>{const currentMc=Number(r.market_cap_usd||0),peak=Math.max(Number(r.peak_market_cap_usd||0),currentMc);return{mint:r.mint,name:safe(r.name||''),symbol:safe(r.symbol||'?'),createdAt:r.created_at,ageMinutes:Math.round(ageMinutes(r.created_at)),graduated:Boolean(r.graduated),currentMc,observedPeakMc:peak,volume:Number(r.volume_24h_usd||0),liquidity:Number(r.liquidity_usd||0),transactions:Number(r.txns_24h||0),buys:Number(r.buys_24h||0),sells:Number(r.sells_24h||0),retention:peak>0?Math.max(0,Math.min(100,currentMc/peak*100)):0}});
    const kings=await sbGet(`kings?select=period,mint,score,market_cap_usd,crowned_at&creator=eq.${wallet}&order=crowned_at.desc&limit=100`);
    const symbolByMint=new Map(tokens.map(t=>[t.mint,t.symbol]));
    const best=tokens.reduce((a,b)=>!a||b.observedPeakMc>a.observedPeakMc?b:a,null);
    return res.status(200).json({ok:true,creator:wallet,creatorShort:short(wallet),stats:{launches:tokens.length,graduated:tokens.filter(t=>t.graduated).length,bestObservedMc:best?.observedPeakMc||0,bestTokenSymbol:best?.symbol||'?',combinedVolume24h:tokens.reduce((s,t)=>s+t.volume,0),kingTitles:Array.isArray(kings)?kings.length:0},tokens:tokens.slice(0,100),kings:(kings||[]).map(k=>({period:k.period,mint:k.mint,symbol:symbolByMint.get(k.mint)||'?',score:Number(k.score||0),marketCap:Number(k.market_cap_usd||0),crownedAt:k.crowned_at}))});
  }catch(e){return res.status(503).json({ok:false,error:String(e.message||e)})}
}
