const $ = (id) => document.getElementById(id);
const metals = { XAU:{name:'طلا',full:'طلای جهانی',symbol:'Au'}, XAG:{name:'نقره',full:'نقره جهانی',symbol:'Ag'}, XPT:{name:'پلاتین',full:'پلاتین جهانی',symbol:'Pt'}, XPD:{name:'پالادیوم',full:'پالادیوم جهانی',symbol:'Pd'} };
let metal = 'XAU', data = null, points = [], busy = false;
const fmt = (value, digits=2) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(Number(value)) : '—';
function field(obj, ...keys) { for (const key of keys) if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key]; return undefined; }
function number(obj, ...keys) { const v=field(obj,...keys); return v === undefined ? NaN : Number(v); }
function currency(){ return $('currency').value; }
function setText(id,value){ $(id).textContent=value; }
function showError(message){ const el=$('error');el.textContent=message;el.classList.remove('hidden'); }
function render(payload){
  data=payload;
  const item=metals[metal], cur=payload.currency || currency();
  const price=number(payload,'price'), change=number(payload,'change','ch'), pct=number(payload,'change_percent','chp');
  document.title=`${item.name} ${fmt(price)} ${cur} | نرخ‌نما`;
  setText('crumbMetal',item.name);setText('titleMetal',item.name);setText('titleCode',metal);setText('assetName',item.full);setText('assetPair',`${metal} / ${cur} · اونس تروا`);setText('assetSymbol',item.symbol);
  setText('mainPrice',fmt(price,4));setText('mainCurrency',cur);setText('changeValue',`${change>0?'+':''}${fmt(change,4)} ${cur}`);setText('changePct',`${pct>0?'+':''}${fmt(pct,2)}%`);
  $('changeValue').classList.toggle('negative',change<0);$('changePct').classList.toggle('negative',pct<0);
  const ts=field(payload,'datetime') || (payload.timestamp ? new Date(payload.timestamp*1000).toLocaleString('fa-IR') : '—');setText('updatedAt',ts);setText('exchange',field(payload,'exchange','symbol') || '—');
  for(const [id,keys] of Object.entries({high:['high_price','high'],low:['low_price','low'],open:['open_price','open'],previous:['prev_close_price','previous_close_price'],ask:['ask'],bid:['bid']}))setText(id,fmt(number(payload,...keys),4));
  setText('highUnit',`واحد: ${cur}`);setText('lowUnit',`واحد: ${cur}`);
  const ppu=payload.price_per_unit||{}, melt=payload.melt_price_per_gram||{};
  setText('gram24',fmt(number(payload,'price_gram_24k') || number(ppu,'gram') || number(melt,'24k'),5));setText('kilo',fmt(number(ppu,'kilogram') || (price*1000/31.1034768),2));
  setText('gram22',fmt(number(payload,'price_gram_22k') || number(melt,'22k') || (number(ppu,'gram')*22/24),5));setText('gram18',fmt(number(payload,'price_gram_18k') || number(melt,'18k') || (number(ppu,'gram')*18/24),5));
  ['unitCurrency1','unitCurrency2','unitCurrency3','unitCurrency4'].forEach(id=>setText(id,cur));
  $('purityWrap').style.display=metal==='XAU'?'':'none';
  $('rawJson').textContent=JSON.stringify(payload,null,2);
  if(Number.isFinite(price)){points.push({at:Date.now(),price});if(points.length>90)points.shift();}
  updateCalc();drawChart();$('error').classList.add('hidden');
}
async function load(){if(busy)return;busy=true;$('refresh').disabled=true;$('refresh').classList.add('loading');try{const params=new URLSearchParams({metal,currency:currency()});const res=await fetch(`/api/price?${params}`);const body=await res.json();if(!res.ok)throw new Error(body.error||`خطای ${res.status}`);render(body);}catch(e){showError(e.message||'دریافت اطلاعات ناموفق بود.');}finally{busy=false;$('refresh').disabled=false;$('refresh').classList.remove('loading');}}
function updateCalc(){if(!data)return;const weight=Math.max(0,Number($('weight').value)||0),unit=$('weightUnit').value,price=number(data,'price'),perGram=number(data,'price_gram_24k')||number(data.price_per_unit||{},'gram')||price/31.1034768;let value=unit==='gram'?weight*perGram:unit==='kilogram'?weight*perGram*1000:weight*price;if(metal==='XAU')value*=Number($('purity').value.replace('k',''))/24;setText('calcResult',`${fmt(value,4)} ${currency()}`);}
function drawChart(){
  const canvas=$('chart'),ctx=canvas.getContext('2d'),box=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  if(!box.width)return;
  canvas.width=box.width*dpr;canvas.height=box.height*dpr;ctx.scale(dpr,dpr);
  const w=box.width,h=box.height;ctx.clearRect(0,0,w,h);
  if(!data){$('chartEmpty').style.display='grid';return;}
  const open=number(data,'open_price','open'),high=number(data,'high_price','high'),low=number(data,'low_price','low'),close=number(data,'price');
  if(![open,high,low,close].every(Number.isFinite)||high<low){$('chartEmpty').style.display='grid';return;}
  $('chartEmpty').style.display='none';
  const light=document.documentElement.dataset.theme==='light',grid=light?'#e1e6e1':'#29312c',muted=light?'#718077':'#849087';
  const span=Math.max(high-low,Math.abs(high)*.002,0.0001),min=low-span*.12,max=high+span*.12;
  const top=14,bottom=14,plotH=h-top-bottom,yFor=value=>top+(max-value)/(max-min)*plotH;
  ctx.font='10px DM Mono, monospace';ctx.textAlign='left';ctx.textBaseline='middle';
  for(let i=0;i<4;i++){const value=max-(max-min)*i/3,y=yFor(value);ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(42,y);ctx.lineTo(w-8,y);ctx.stroke();ctx.fillStyle=muted;ctx.fillText(fmt(value,2),2,y);}
  const rising=close>=open,color=rising?'#58c887':'#ef8177',x=42+(w-58)*.55,wickTop=yFor(high),wickBottom=yFor(low),bodyTop=Math.min(yFor(open),yFor(close)),bodyBottom=Math.max(yFor(open),yFor(close)),bodyHeight=Math.max(bodyBottom-bodyTop,4),bodyWidth=Math.min(30,(w-70)*.16);
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,wickTop);ctx.lineTo(x,wickBottom);ctx.stroke();
  ctx.fillStyle=color;ctx.fillRect(x-bodyWidth/2,bodyTop,bodyWidth,bodyHeight);
  const closeY=yFor(close);ctx.save();ctx.setLineDash([3,4]);ctx.strokeStyle=color+'99';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+bodyWidth/2+5,closeY);ctx.lineTo(w-8,closeY);ctx.stroke();ctx.restore();
  $('chartMinLabel').textContent='بازگشایی '+fmt(open,2);$('chartMaxLabel').textContent='آخرین '+fmt(close,2);
}
document.querySelectorAll('.metal-link').forEach(btn=>btn.addEventListener('click',()=>{metal=btn.dataset.metal;points=[];document.querySelectorAll('.metal-link').forEach(b=>b.classList.toggle('selected',b===btn));$('assetSymbol').className=`asset-symbol ${metal==='XAG'?'silver':metal==='XPT'?'platinum':metal==='XPD'?'palladium':'gold'}`;load()}));
$('currency').addEventListener('change',()=>{points=[];load()});$('refresh').addEventListener('click',load);['weight','weightUnit','purity'].forEach(id=>$(id).addEventListener('input',updateCalc));window.addEventListener('resize',drawChart);
const themeButton=$('themeToggle');
function applyTheme(theme){document.documentElement.dataset.theme=theme;const light=theme==='light';themeButton.textContent=light?'☾':'☼';themeButton.setAttribute('aria-label',light?'تغییر به تم تیره':'تغییر به تم روشن');themeButton.title=light?'تم تیره':'تم روشن';document.querySelector('meta[name="theme-color"]').content=light?'#f3f5f2':'#101311';try{localStorage.setItem('goldapi-theme',theme);}catch{}}
let savedTheme='dark';try{savedTheme=localStorage.getItem('goldapi-theme')||'dark';}catch{}
applyTheme(savedTheme);
themeButton.addEventListener('click',()=>{applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');drawChart();});
fetch('/api/health').then(r=>r.json()).then(s=>{setText('apiStatus',s.configured?'آماده دریافت داده':'کلید API تنظیم نشده');}).catch(()=>setText('apiStatus','سرور در دسترس نیست'));
load();
const AUTO_REFRESH_MS=15_000;
setInterval(()=>{if(!document.hidden)load();},AUTO_REFRESH_MS);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
