const leaderboard = require('./leaderboard.js');
function env(){const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';if(!url)throw new Error('SUPABASE_URL is not configured');if(!key)throw new Error('SUPABASE_SECRET_KEY is not configured');return{url,key}}
async function sbGet(path){const{url,key}=env();const r=await fetch(`${url}/rest/v1/${path}`,{headers:{apikey:key,authorization:`Bearer ${key}`,accept:'application/json'}});const text=await r.text();let body;try{body=JSON.parse(text)}catch{body=text}if(!r.ok)throw new Error(body?.message||`Supabase HTTP ${r.status}`);return body}
async function sbPost(table,payload){const{url,key}=env();const r=await fetch(`${url}/rest/v1/${table}`,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',prefer:'return=representation'},body:JSON.stringify(payload)});const text=await r.text();let body;try{body=JSON.parse(text)}catch{body=text}if(!r.ok)throw new Error(body?.message||`Supabase HTTP ${r.status}`);return body}
module.exports=async function handler(req,res){
  try{
    const secret=process.env.CRON_SECRET||'';if(!secret)return res.status(500).json({ok:false,error:'CRON_SECRET is not configured'});
    if(req.headers.authorization!==`Bearer ${secret}`)return res.status(401).json({ok:false,error:'Unauthorized'});
    const period=new Date(Date.now()-86400000).toISOString().slice(0,10);
    const existing=await sbGet(`kings?select=id,period&period=eq.${period}&limit=1`);if(existing?.length)return res.status(200).json({ok:true,period,skipped:true,reason:'Already crowned'});
    const data=await leaderboard.buildLeaderboard('24h');const winner=data.leaders?.[0];if(!winner)return res.status(200).json({ok:true,period,skipped:true,reason:'No eligible king'});
    const inserted=await sbPost('kings',{period,creator:winner.creator,mint:winner.mint,score:winner.score,market_cap_usd:winner.currentMc,volume_24h_usd:winner.volume,txns_24h:winner.transactions,crowned_at:new Date().toISOString()});
    return res.status(200).json({ok:true,period,winner,inserted:inserted?.[0]||null});
  }catch(e){return res.status(503).json({ok:false,error:String(e.message||e)})}
}
