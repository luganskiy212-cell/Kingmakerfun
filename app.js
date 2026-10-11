const DEMO = [
  {creatorShort:'7xQe...P4s',symbol:'BANANA',currentMc:3110000,observedPeakMc:4820000,retention:64.5,transactions:8421,volume:7400000,liquidity:420000,graduated:true,score:89.7},
  {creatorShort:'Ax71...Zp2',symbol:'ROBOT',currentMc:1660000,observedPeakMc:2310000,retention:71.8,transactions:6944,volume:4900000,liquidity:280000,graduated:true,score:89.2},
  {creatorShort:'4Lpm...83D',symbol:'CAT',currentMc:1020000,observedPeakMc:1760000,retention:58,transactions:5201,volume:3400000,liquidity:190000,graduated:true,score:79.6}
];

const DEMO_CHALLENGERS = [
  {creatorShort:'F4st...dev',symbol:'RUSH',currentMc:92000,observedPeakMc:118000,retention:78,transactions:1300,volume:81000,ageMinutes:22,eligibleInMinutes:38,graduated:false,score:73.2}
];

function money(v){
  const n=Number(v||0);
  if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B';
  if(n>=1e6)return '$'+(n/1e6).toFixed(2)+'M';
  if(n>=1e3)return '$'+(n/1e3).toFixed(0)+'K';
  return '$'+n.toFixed(0);
}
function num(v){return Number(v||0).toLocaleString('en-US')}
function setMode(text, live=false){
  const el=document.getElementById('dataMode'); if(!el)return;
  el.textContent=text; el.classList.toggle('live',live);
}
function drawdown(r){return Math.max(0,100-Number(r||0))}

function renderKing(k, isDemo=false){
  if(!k){
    document.getElementById('kingWallet').textContent='No eligible king yet';
    document.getElementById('kingToken').textContent='—';
    document.getElementById('kingScore').textContent='—';
    document.getElementById('kingMc').textContent='—';
    document.getElementById('kingRetention').textContent='—';
    document.getElementById('kingTraders').textContent='—';
    document.getElementById('kingGraduated').textContent='—';
    setMode(isDemo?'DEMO DATA':'LIVE ON-CHAIN',!isDemo);
    return;
  }
  document.getElementById('kingWallet').textContent=k.creatorShort||'—';
  document.getElementById('kingToken').textContent='$'+(k.symbol||'?');
  document.getElementById('kingScore').textContent=Number(k.score||0).toFixed(1);
  document.getElementById('kingMc').textContent=money(k.currentMc);
  document.getElementById('kingRetention').textContent=Number(k.retention||0).toFixed(1)+'%';
  document.getElementById('kingTraders').textContent=num(k.transactions);
  document.getElementById('kingGraduated').textContent=k.graduated?'Yes':'No';
  setMode(isDemo?'DEMO DATA':'LIVE ON-CHAIN',!isDemo);
}

function renderBoard(rows){
  const body=document.getElementById('leaderboardRows');
  if(!rows?.length){
    body.innerHTML='<tr><td colspan="7" class="empty-row">No launch has survived the first hour and met eligibility yet.</td></tr>';
    return;
  }
  body.innerHTML=rows.map((r,i)=>`<tr>
    <td class="rank">${i===0?'♛ ':''}${String(i+1).padStart(2,'0')}</td>
    <td><strong title="${r.creator||''}">${r.creatorShort||'—'}</strong></td>
    <td class="token-pill">$${r.symbol||'?'}</td>
    <td>${money(r.currentMc)}</td>
    <td>${money(r.volume)}</td>
    <td class="retention ${Number(r.retention)>=70?'good':Number(r.retention)<20?'bad':''}">${Number(r.retention||0).toFixed(1)}%</td>
    <td><span class="score-pill">${Number(r.score||0).toFixed(1)}</span></td>
  </tr>`).join('');
}

function renderChallengers(rows){
  const wrap=document.getElementById('challengerGrid');
  if(!rows?.length){
    wrap.innerHTML='<article class="challenger-card empty"><div class="challenger-label">LIVE CHALLENGERS</div><strong>No qualifying launches under 60 minutes right now.</strong></article>';
    return;
  }
  wrap.innerHTML=rows.map((r,i)=>`<article class="challenger-card">
    <div class="challenger-top"><span>#${i+1} CHALLENGER</span><span>${Math.max(0,Number(r.eligibleInMinutes||0))}m TO CROWN</span></div>
    <div class="challenger-main"><div><strong>$${r.symbol||'?'}</strong><small>${r.creatorShort||'—'}</small></div><b>${Number(r.score||0).toFixed(1)}</b></div>
    <div class="challenger-stats"><span>MC <b>${money(r.currentMc)}</b></span><span>VOL <b>${money(r.volume)}</b></span><span>DD <b>-${drawdown(r.retention).toFixed(0)}%</b></span></div>
  </article>`).join('');
}

function renderHall(){
  const hall=document.getElementById('hallGrid');
  hall.innerHTML=`<article class="history-card"><div class="date">SOON</div><div><div class="winner">History starts at launch</div><div class="best">Daily winners will be permanently recorded here.</div></div><div class="mini"><span>HALL</span><span>OF KINGS</span></div></article>`;
}

function updateMeta(data){
  const stamp=document.getElementById('updatedAt');
  if(stamp)stamp.textContent='Updated '+new Date(data.generatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const eligible=document.getElementById('eligibleCount');
  if(eligible)eligible.textContent=`${num(data.eligibleTokens||0)} crown-eligible • ${num(data.challengerTokens||0)} challengers • ${num(data.scannedTokens||0)} scanned`;
}

async function load(range='24h'){
  setMode('LOADING…',false);
  try{
    const r=await fetch(`/api/leaderboard?range=${encodeURIComponent(range)}`,{headers:{accept:'application/json'}});
    const data=await r.json();
    if(!r.ok||!data.ok)throw new Error(data.error||'API error');
    renderBoard(data.leaders||[]);
    renderChallengers(data.challengers||[]);
    renderKing(data.leaders?.[0]||null,false);
    updateMeta(data);
  }catch(e){
    renderBoard(DEMO); renderChallengers(DEMO_CHALLENGERS); renderKing(DEMO[0],true);
    const stamp=document.getElementById('updatedAt');
    if(stamp)stamp.textContent='Live data unavailable: '+(e.message||'temporary error');
    const eligible=document.getElementById('eligibleCount');
    if(eligible)eligible.textContent='Showing demo while live API recovers';
  }
}

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  load(btn.dataset.range);
}));

renderHall();
load('24h');
