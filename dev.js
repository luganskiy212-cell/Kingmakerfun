function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function attr(v=''){return esc(v)}
function money(v){const n=Number(v||0);if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return '$'+(n/1e6).toFixed(2)+'M';if(n>=1e3)return '$'+(n/1e3).toFixed(n>=1e5?0:1)+'K';return '$'+n.toFixed(0)}
function num(v){return Number(v||0).toLocaleString('en-US')}
function age(v){const m=Math.max(0,Number(v||0));if(m>=1440)return Math.floor(m/1440)+'d '+Math.floor((m%1440)/60)+'h';if(m>=60)return Math.floor(m/60)+'h '+Math.floor(m%60)+'m';return Math.round(m)+'m'}
function pumpUrl(m){return `https://pump.fun/coin/${encodeURIComponent(m||'')}`}
function dexUrl(m){return `https://dexscreener.com/solana/${encodeURIComponent(m||'')}`}
function solscanAccount(w){return `https://solscan.io/account/${encodeURIComponent(w||'')}`}

const params=new URLSearchParams(location.search);const wallet=params.get('wallet')||'';
async function load(){
  if(!wallet){document.getElementById('devShort').textContent='Wallet missing';return}
  try{
    const r=await fetch(`/api/dev?wallet=${encodeURIComponent(wallet)}`,{headers:{accept:'application/json'}});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Profile unavailable');
    document.title=`${d.creatorShort} — KINGMAKER`;
    document.getElementById('devShort').textContent=d.creatorShort;document.getElementById('devAddress').textContent=d.creator;document.getElementById('solscanLink').href=solscanAccount(d.creator);
    document.getElementById('statLaunches').textContent=num(d.stats.launches);document.getElementById('statGraduated').textContent=num(d.stats.graduated);document.getElementById('statBestMc').textContent=money(d.stats.bestObservedMc);document.getElementById('statVolume').textContent=money(d.stats.combinedVolume24h);document.getElementById('statTitles').textContent=num(d.stats.kingTitles);document.getElementById('statBestToken').textContent='$'+(d.stats.bestTokenSymbol||'?');
    document.getElementById('profileMeta').textContent=`${num(d.stats.launches)} launches captured since KINGMAKER started tracking this wallet`;
    const body=document.getElementById('devRows');
    body.innerHTML=d.tokens.length?d.tokens.map(t=>`<tr><td><a class="dev-table-name" href="${attr(pumpUrl(t.mint))}" target="_blank" rel="noopener noreferrer">$${esc(t.symbol||'?')}<small>${esc(t.name||'')}</small></a><div class="row-actions"><a href="${attr(dexUrl(t.mint))}" target="_blank" rel="noopener noreferrer">DEX ↗</a><a href="${attr(pumpUrl(t.mint))}" target="_blank" rel="noopener noreferrer">Pump ↗</a></div></td><td>${age(t.ageMinutes)}</td><td>${money(t.currentMc)}</td><td>${money(t.observedPeakMc)}</td><td>${money(t.volume)}</td><td>${num(t.transactions)}</td><td class="retention ${Number(t.retention)>=70?'good':Number(t.retention)<20?'bad':''}">${Number(t.retention||0).toFixed(1)}%</td><td><span class="tag ${t.graduated?'yes':''}">${t.graduated?'YES':'NO'}</span></td></tr>`).join(''):'<tr><td colspan="8" class="empty-row">No tracked launches.</td></tr>';
    const kings=document.getElementById('devKings');
    kings.innerHTML=d.kings.length?d.kings.map(k=>`<article class="history-card"><div class="date">${esc(k.period)}</div><div><div class="winner">DEV KING</div><div class="best">$${esc(k.symbol||'?')}</div></div><div class="mini"><span>${Number(k.score||0).toFixed(1)} PTS</span><span>${money(k.marketCap)}</span></div></article>`).join(''):'<article class="history-card"><div class="date">—</div><div><div class="winner">No crown yet</div><div class="best">Daily KING titles will appear here.</div></div><div class="mini"><span>0</span><span>TITLES</span></div></article>';
  }catch(e){document.getElementById('devShort').textContent='Profile unavailable';document.getElementById('devAddress').textContent=e.message||'Temporary error'}
}
document.getElementById('copyWallet').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(wallet);document.getElementById('copyWallet').textContent='Copied';setTimeout(()=>document.getElementById('copyWallet').textContent='Copy wallet',1200)}catch{}});
load();
