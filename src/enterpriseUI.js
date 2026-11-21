import {CREWS,PRODUCTS,SITES,SALES,PLANS,MATERIALS,hexDist,SALES_GOAL} from '../shared/enterprise.js';
import {feedPhoto} from './cityArt.js';
const money=n=>'$'+Number(n||0).toLocaleString('en-US');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function label(o,crew){
 const [k,to]=o.target.split('@');
 if(k==='outpost')return 'Build '+crew.base;
 if(PLANS[k])return (['boat','hire'].includes(k)?'':'Build ')+SITES[k]+(to?' → '+to:'');
 if(to)return 'Ship all '+PRODUCTS[k]+' → lab '+to;
 if(k.startsWith('sell'))return 'Sell '+k.slice(3)+' · '+money(SALES[k.slice(3)]);
 return {refineRock:'Grind 1 rock into dust',refineCompound:'Bind 1 compound into glue',craft:'Cast 1 die · 1 dust + 1 glue',upgrade:'Equip upgrade · 1 die'}[k];
}
export function businessPanel(g,player,tile){
 const crew=CREWS[player.color],opts=g.orders.filter(o=>o.type==='enterprise'&&o.tile===tile?.id);
 const stock=tile?.stock;
 return '<section class="business-panel"><h2>Dice enterprise</h2><p>'+money(player.business.cash)+' available · '+money(player.sales)+' / '+money(SALES_GOAL)+' sales</p><p>'+player.business.rock+' rock · '+player.business.compound+' compound · Grade '+player.grade+' dice (+'+Math.max(0,player.grade-1)+' in battle)</p>'+
 (stock?'<p>On site · '+stock.dust+' dust · '+stock.glue+' glue · '+stock.dice+' dice</p>':'')+
 (opts.length?opts.map(o=>'<button data-enterprise="'+escape(o.target)+'">'+escape(label(o,crew))+(o.cash?' · '+money(o.cash):'')+(PLANS[o.target.split('@')[0]]?'<small>'+Object.entries(PLANS[o.target.split('@')[0]]).filter(([name])=>name!=='cash').map(([name,n])=>n+' '+MATERIALS[name]).join(' · ')+'</small>':'')+'</button>').join(''):
 '<p>Claim Keys for a pulverizer, beach for binder works, and Miami for a lab. Join sites with owned roads or coastal docks to ship stock.</p>')+'</section>';
}
export function pursuitPanel(g,id){
 const c=g.pursuit,t=g.tiles.find(n=>n.id===c.against),fight=g.policeBattle;
 const near=g.tiles.filter(n=>n.owner===id&&hexDist(n,t)===1&&(n.biome!=='ocean'||t.biome==='ocean'||n.boats*4>n.navy));
 return '<section class="pursuit"><h2>Police pursuit</h2><p>'+c.strength+' officers · '+escape(c.position)+' → '+escape(c.against)+'</p>'+
 (fight?'<p>Last clash · '+(fight.rounds.at(-1)?.attack.join(' / ')||'—')+' vs '+(fight.rounds.at(-1)?.defense.join(' / ')||'—')+'</p>':'')+
 (id!==c.target?'<p>The defending crew is responding.</p>':'<button data-response="defend">Stand and roll defense</button>'+(near.length?'<p>Or move all '+(t.army+t.navy)+' members to friendly turf.</p>'+near.map(n=>'<label>'+escape(n.id)+' <input type="number" min="0" max="'+(t.army+t.navy)+'" data-evac="'+escape(n.id)+'" value="0"></label>').join('')+'<button data-response="retreat">Confirm retreat</button>':''))+'</section>';
}
export function makePhone(){
 const phone=document.createElement('aside');phone.id='crewPhone';phone.hidden=true;
 phone.innerHTML='<header>Biscayne Wire <button aria-label="Close phone">×</button></header><div class="wire-feed" role="log"></div>';
 document.body.append(phone);const feed=phone.querySelector('.wire-feed');
 let last=0,roomCode,hold=0,scrollTimer;
 const scroll=()=>{if(!phone.hidden&&Date.now()>=hold)feed.scrollTop=feed.scrollHeight;};
 feed.addEventListener('wheel',()=>{hold=Date.now()+5000;clearTimeout(scrollTimer);scrollTimer=setTimeout(scroll,5010);},{passive:true});
 phone.querySelector('button').onclick=()=>phone.hidden=true;
 return {toggle(){phone.hidden=!phone.hidden;scroll();},update(state){
  if(state?.game?.mapId!=='florida'){phone.hidden=true;return;}
  if(roomCode!==state.code){roomCode=state.code;feed.replaceChildren();last=0;}
  for(const entry of state.game.feed||[]){
   if(entry.seq<=last)continue;
   const crew=CREWS[entry.color],card=document.createElement('article');
   const img=document.createElement('img');img.alt=entry.text;img.loading='lazy';img.width=360;img.height=200;
   img.src=feedPhoto(entry);card.append(img);
   const caption=document.createElement('p'),name=document.createElement('strong');name.textContent=crew?.name||'Biscayne Police';caption.append(name,document.createTextNode((crew?' · '+crew.voice+' · ':' · ')+entry.text));card.append(caption);feed.append(card);last=entry.seq;
   if(feed.children.length>100)feed.firstChild.remove();scroll();
  }
 }};
}
