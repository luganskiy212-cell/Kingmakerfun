const DEMO = [
  {creator:'7xQeDemoP4s',creatorShort:'7xQe...P4s',mint:'DemoMint111111111111111111111111111111111',symbol:'BANANA',currentMc:3110000,retention:64.5,transactions:8421,volume:7400000,ageMinutes:220,graduated:true,score:89.7},
  {creator:'Ax71DemoZp2',creatorShort:'Ax71...Zp2',mint:'DemoMint222222222222222222222222222222222',symbol:'ROBOT',currentMc:1660000,retention:71.8,transactions:6944,volume:4900000,ageMinutes:190,graduated:true,score:89.2}
];
const DEMO_CHALLENGERS = [{creator:'F4stDemoDev',creatorShort:'F4st...dev',mint:'DemoMint333333333333333333333333333333333',symbol:'RUSH',currentMc:92000,retention:78,transactions:1300,volume:81000,ageMinutes:22,eligibleInMinutes:38,graduated:false,score:73.2}];
let currentRange = '24h';

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function attr(v=''){return esc(v)}
function money(v){const n=Number(v||0);if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return '$'+(n/1e6).toFixed(2)+'M';if(n>=1e3)return '$'+(n/1e3).toFixed(n>=1e5?0:1)+'K';return '$'+n.toFixed(0)}
function num(v){return Number(v||0).toLocaleString('en-US')}
function age(v){const m=Math.max(0,Number(v||0));if(m>=1440)return Math.floor(m/1440)+'d '+Math.floor((m%1440)/60)+'h';if(m>=60)return Math.floor(m/60)+'h '+Math.floor(m%60)+'m';return Math.round(m)+'m'}
function drawdown(r){return Math.max(0,100-Number(r||0))}
function pumpUrl(mint){return `https://pump.fun/coin/${encodeURIComponent(mint||'')}`}
function dexUrl(mint){return `https://dexscreener.com/solana/${encodeURIComponent(mint||'')}`}
function solscanAccount(wallet){return `https://solscan.io/account/${encodeURIComponent(wallet||'')}`}
function devUrl(wallet){return `dev.html?wallet=${encodeURIComponent(wallet||'')}`}
function setMode(text, live=false){const el=document.getElementById('dataMode');if(!el)return;el.textContent=text;el.classList.toggle('live',live)}

function rankTrend(rows, range){
  const key=`kingmaker:ranks:${range}`;
  let prev={};try{prev=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
  const current={};rows.forEach((r,i)=>current[r.creator]=i+1);
  try{localStorage.setItem(key,JSON.stringify(current))}catch{}
  return rows.map((r,i)=>{const old=prev[r.creator],now=i+1;if(!old)return {...r,trend:null};const d=old-now;return {...r,trend:d};});
}

function renderKing(k,isDemo=false){
  const wallet=document.getElementById('kingWallet'), token=document.getElementById('kingToken');
  if(!k){wallet.textContent='No eligible king yet';wallet.removeAttribute('href');token.textContent='—';token.removeAttribute('href');['kingScore','kingMc','kingRetention','kingTraders','kingGraduated'].forEach(id=>document.getElementById(id).textContent='—');setMode(isDemo?'DEMO DATA':'LIVE ON-CHAIN',!isDemo);return}
  wallet.textContent=k.creatorShort||'—';wallet.href=devUrl(k.creator);wallet.title=k.creator||'';
  token.textContent='$'+(k.symbol||'?');token.href=pumpUrl(k.mint);token.target='_blank';token.rel='noopener noreferrer';
  document.getElementById('kingScore').textContent=Number(k.score||0).toFixed(1);
  document.getElementById('kingMc').textContent=money(k.currentMc);
  document.getElementById('kingRetention').textContent=Number(k.retention||0).toFixed(1)+'%';
  document.getElementById('kingTraders').textContent=num(k.transactions);
  document.getElementById('kingGraduated').textContent=k.graduated?'Yes':'No';
  setMode(isDemo?'DEMO DATA':'LIVE ON-CHAIN',!isDemo);
}

function renderBoard(input){
  const body=document.getElementById('leaderboardRows');
  if(!input?.length){body.innerHTML='<tr><td colspan="8" class="empty-row">No launch has survived the first hour and met eligibility yet.</td></tr>';return}
  const rows=rankTrend(input,currentRange);
  body.innerHTML=rows.map((r,i)=>{
    const t=r.trend==null?'':r.trend>0?`<small class="trend up" title="Up since your last load">↑${r.trend}</small>`:r.trend<0?`<small class="trend down" title="Down since your last load">↓${Math.abs(r.trend)}</small>`:'<small class="trend flat" title="Unchanged since your last load">–</small>';
    return `<tr>
      <td class="rank">${i===0?'♛ ':''}${String(i+1).padStart(2,'0')} ${t}</td>
      <td><a class="row-link" href="${attr(devUrl(r.creator))}" title="${attr(r.creator||'')}">${esc(r.creatorShort||'—')}</a><a class="micro-link" href="${attr(solscanAccount(r.creator))}" target="_blank" rel="noopener noreferrer">Solscan ↗</a></td>
      <td><a class="token-pill" href="${attr(pumpUrl(r.mint))}" target="_blank" rel="noopener noreferrer">$${esc(r.symbol||'?')}</a><div class="row-actions"><a href="${attr(dexUrl(r.mint))}" target="_blank" rel="noopener noreferrer">DEX ↗</a><a href="${attr(pumpUrl(r.mint))}" target="_blank" rel="noopener noreferrer">Pump ↗</a></div></td>
      <td>${age(r.ageMinutes)}</td>
      <td>${money(r.currentMc)}</td>
      <td>${money(r.volume)}</td>
      <td class="retention ${Number(r.retention)>=70?'good':Number(r.retention)<20?'bad':''}">${Number(r.retention||0).toFixed(1)}%</td>
      <td><span class="score-pill">${Number(r.score||0).toFixed(1)}</span></td>
    </tr>`;
  }).join('');
}

function renderChallengers(rows){
  const wrap=document.getElementById('challengerGrid');
  if(!rows?.length){wrap.innerHTML='<article class="challenger-card empty"><div class="challenger-label">LIVE CHALLENGERS</div><strong>No qualifying launches under 60 minutes right now.</strong></article>';return}
  wrap.innerHTML=rows.map((r,i)=>`<article class="challenger-card">
    <div class="challenger-top"><span>#${i+1} CHALLENGER</span><span>${Math.max(0,Number(r.eligibleInMinutes||0))}m TO CROWN</span></div>
    <div class="challenger-main"><div><a class="token-link" href="${attr(pumpUrl(r.mint))}" target="_blank" rel="noopener noreferrer"><strong>$${esc(r.symbol||'?')}</strong></a><a class="micro-link dev-mini" href="${attr(devUrl(r.creator))}">${esc(r.creatorShort||'—')}</a></div><b>${Number(r.score||0).toFixed(1)}</b></div>
    <div class="challenger-stats"><span>MC <b>${money(r.currentMc)}</b></span><span>VOL <b>${money(r.volume)}</b></span><span>DD <b>-${drawdown(r.retention).toFixed(0)}%</b></span></div>
  </article>`).join('');
}

async function loadHall(){
  const hall=document.getElementById('hallGrid');
  try{
    const r=await fetch('/api/hall',{headers:{accept:'application/json'}});const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.error||'Hall unavailable');
    if(!data.kings?.length){hall.innerHTML='<article class="history-card"><div class="date">SOON</div><div><div class="winner">The first crown has not been archived yet</div><div class="best">Daily winners will appear here automatically after the UTC day closes.</div></div><div class="mini"><span>HALL</span><span>OF KINGS</span></div></article>';return}
    hall.innerHTML=data.kings.map(k=>`<article class="history-card">
      <div class="date">${esc(k.period||'—')}</div>
      <div><a class="winner" href="${attr(devUrl(k.creator))}">${esc(k.creatorShort||k.creator||'—')}</a><div class="best">Best launch <a class="token-link" href="${attr(pumpUrl(k.mint))}" target="_blank" rel="noopener noreferrer">$${esc(k.symbol||'?')}</a></div></div>
      <div class="mini"><span>${Number(k.score||0).toFixed(1)} PTS</span><span>${money(k.marketCap)}</span></div>
    </article>`).join('');
  }catch(e){hall.innerHTML=`<article class="history-card"><div class="date">OFFLINE</div><div><div class="winner">Hall temporarily unavailable</div><div class="best">${esc(e.message||'Temporary error')}</div></div><div class="mini"><span>HALL</span><span>OF KINGS</span></div></article>`}
}

function updateMeta(data){
  const stamp=document.getElementById('updatedAt');if(stamp)stamp.textContent='Updated '+new Date(data.generatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const eligible=document.getElementById('eligibleCount');if(eligible)eligible.textContent=`${num(data.eligibleTokens||0)} crown-eligible • ${num(data.challengerTokens||0)} challengers • ${num(data.qualifiedTokensFetched||data.scannedTokens||0)} qualified scanned`;
}

async function load(range='24h'){
  currentRange=range;setMode('LOADING…',false);
  try{
    const r=await fetch(`/api/leaderboard?range=${encodeURIComponent(range)}`,{headers:{accept:'application/json'}});const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.error||'API error');
    renderBoard(data.leaders||[]);renderChallengers(data.challengers||[]);renderKing(data.leaders?.[0]||null,false);updateMeta(data);
  }catch(e){renderBoard(DEMO);renderChallengers(DEMO_CHALLENGERS);renderKing(DEMO[0],true);const stamp=document.getElementById('updatedAt');if(stamp)stamp.textContent='Live data unavailable: '+(e.message||'temporary error');const eligible=document.getElementById('eligibleCount');if(eligible)eligible.textContent='Showing demo while live API recovers'}
}

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');load(btn.dataset.range)}));
loadHall();load('24h');

// v3.1 — official token config
(function applyProjectConfig(){
  const c=window.KINGMAKER_CONFIG||{};
  const mint=String(c.tokenMint||'').trim();
  const sym=String(c.tokenSymbol||'KING').replace(/^\$/,'');
  const cta=document.getElementById('projectTokenCta');
  const mintEl=document.getElementById('officialMint');
  const copy=document.getElementById('copyMint');
  const pump=document.getElementById('officialPumpLink');
  const title=document.getElementById('tokenLaunchTitle');
  const copyText=document.getElementById('tokenLaunchCopy');
  const footer=document.getElementById('footerContract');
  if(!mint){return;}
  const short=mint.length>16?`${mint.slice(0,6)}…${mint.slice(-6)}`:mint;
  if(cta){cta.textContent=`$${sym} — LIVE`;cta.href=pumpUrl(mint);cta.target='_blank';cta.rel='noopener noreferrer';cta.classList.remove('disabled');cta.removeAttribute('aria-disabled')}
  if(mintEl)mintEl.textContent=mint;
  if(title)title.textContent=`$${sym} is live.`;
  if(copyText)copyText.textContent='Verify the contract here before using any third-party link. This is the only official KINGMAKER mint.';
  if(footer)footer.textContent=short;
  if(pump){pump.href=pumpUrl(mint);pump.target='_blank';pump.rel='noopener noreferrer';pump.classList.remove('disabled');pump.removeAttribute('aria-disabled')}
  if(copy){copy.disabled=false;copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(mint);const old=copy.textContent;copy.textContent='Copied';setTimeout(()=>copy.textContent=old,1300)}catch{copy.textContent='Copy failed'}})}
})();
