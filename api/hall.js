function env(){const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';if(!url)throw new Error('SUPABASE_URL is not configured');if(!key)throw new Error('SUPABASE_SECRET_KEY is not configured');return{url,key}}
async function sbGet(path){const{url,key}=env();const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:key,authorization:`Bearer ${key}`,accept:'application/json'}});const text=await r.text();let body;try{body=JSON.parse(text)}catch{body=text}if(!r.ok)throw new Error(body?.message||`Supabase HTTP ${r.status}`);return body}
function short(a=''){return a.length>10?`${a.slice(0,4)}...${a.slice(-3)}`:a}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
  try{
    const kings=await sbGet('kings?select=id,period,creator,mint,score,market_cap_usd,volume_24h_usd,txns_24h,crowned_at&order=crowned_at.desc&limit=30');
    if(!Array.isArray(kings)||!kings.length)return res.status(200).json({ok:true,kings:[]});
    const mints=[...new Set(kings.map(k=>k.mint).filter(Boolean))];
    const tokenMap=new Map();
    if(mints.length){
      const tokens=await sbGet(`tokens?select=mint,name,symbol&mint=in.(${mints.join(',')})`);
      for(const t of tokens||[])tokenMap.set(t.mint,t);
    }
    return res.status(200).json({ok:true,kings:kings.map(k=>{const t=tokenMap.get(k.mint)||{};return{period:k.period,creator:k.creator,creatorShort:short(k.creator),mint:k.mint,name:t.name||'',symbol:t.symbol||'?',score:Number(k.score||0),marketCap:Number(k.market_cap_usd||0),volume:Number(k.volume_24h_usd||0),transactions:Number(k.txns_24h||0),crownedAt:k.crowned_at}})});
  }catch(e){return res.status(503).json({ok:false,error:String(e.message||e)})}
}
