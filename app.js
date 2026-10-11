const DEMO = [
  {creatorShort:'7xQe...P4s',symbol:'BANANA',peakMc:4820000,currentMc:3110000,retention:64.5,traders:8421,volume:7400000,graduated:true,score:94.7},
  {creatorShort:'Ax71...Zp2',symbol:'ROBOT',peakMc:2310000,currentMc:1660000,retention:71.8,traders:6944,volume:4900000,graduated:true,score:89.2},
  {creatorShort:'4Lpm...83D',symbol:'CAT',peakMc:1760000,currentMc:1020000,retention:58,traders:5201,volume:3400000,graduated:true,score:84.6}
];
let activeRange='24h';
function money(v){
  const n=Number(v||0); if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B'; if(n>=1e6)return '$'+(n/1e6).toFixed(2)+'M'; if(n>=1e3)return '$'+(n/1e3).toFixed(0)+'K'; return '$'+n.toFixed(0);
}
function num(v){return Number(v||0).toLocaleString('en-US')}
function setMode(text, live=false){
  const el=document.getElementById('dataMode'); if(!el)return; el.textContent=text; el.classList.toggle('live',live);
}
function renderKing(k, isDemo=false){
  document.getElementById('kingWallet').textContent=k.creatorShort||'—';
  document.getElementById('kingToken').textContent='$'+(k.symbol||'?');
  document.getElementById('kingScore').textContent=Number(k.score||0).toFixed(1);
  document.getElementById('kingMc').textContent=money(k.currentMc);
  document.getElementById('kingRetention').textContent=Number(k.retention||0).toFixed(1)+'%';
  document.getElementById('kingTraders').textContent=num(k.traders);
  document.getElementById('kingGraduated').textContent=k.graduated?'Yes':'No';
  setMode(isDemo?'DEMO DATA':'LIVE ON-CHAIN',!isDemo);
}
function renderBoard(rows){
  document.getElementById('leaderboardRows').innerHTML=rows.map((r,i)=>`<tr>
    <td class="rank">${i===0?'♛ ':''}${String(i+1).padStart(2,'0')}</td>
    <td><strong title="${r.creator||''}">${r.creatorShort||'—'}</strong></td>
    <td class="token-pill">$${r.symbol||'?'}</td>
    <td>${money(r.peakMc)}</td>
    <td class="retention good">${Number(r.retention||0).toFixed(1)}%</td>
    <td>${num(r.traders)}</td>
    <td><span class="score-pill">${Number(r.score||0).toFixed(1)}</span></td>
  </tr>`).join('');
}
function renderHall(){
  const hall=document.getElementById('hallGrid');
  hall.innerHTML=`<article class="history-card"><div class="date">SOON</div><div><div class="winner">History starts at launch</div><div class="best">Daily winners will be permanently recorded here.</div></div><div class="mini"><span>HALL</span><span>OF KINGS</span></div></article>`;
}
async function load(range='24h'){
  activeRange=range;
  setMode('LOADING…',false);
  try{
    const r=await fetch(`/api/leaderboard?range=${encodeURIComponent(range)}`,{headers:{accept:'application/json'}});
    const data=await r.json();
    if(!r.ok||!data.ok||!data.leaders?.length)throw new Error(data.error||'No live rows');
    renderBoard(data.leaders); renderKing(data.leaders[0],false);
    const stamp=document.getElementById('updatedAt');
    if(stamp)stamp.textContent='Updated '+new Date(data.generatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }catch(e){
    renderBoard(DEMO); renderKing(DEMO[0],true);
    const stamp=document.getElementById('updatedAt'); if(stamp)stamp.textContent='Live data unavailable: '+(e.message||'temporary error');
  }
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');load(btn.dataset.range);
}));
renderHall();load('24h');
