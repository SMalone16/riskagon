import './style.css';
import {harvestEffects} from './harvest.js';
import {MAPS,COLORS,BIOMES,FACTIONS} from '../shared/maps.js';
import {io} from 'socket.io-client';
import {Board} from './board.js';
import {NAVAL_COSTS,isWater,coastal} from '../server/naval.js';
import {BoardDice} from './dice.js';
const socket=io(),root=document.getElementById('app');
const id=sessionStorage.getItem('riskagon:id')||crypto.randomUUID().slice(0,22);
sessionStorage.setItem('riskagon:id',id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const kinds={forest:'Forest',fields:'Wheat Fields',pasture:'Pasture',hills:'Clay Hills',mountains:'Iron Mountains',desert:'Desert',river:'River Crossing',lake:'Lake'};
const terrainName=tile=>BIOMES[tile.biome]?.name||kinds[tile.terrain];
const icons={wood:'🌲',brick:'🧱',wheat:'🌾',sheep:'🐑',ore:'⛏️'};
const costs={...NAVAL_COSTS,road:{wood:1,brick:1},bridge:{wood:2,brick:1,ore:1},outpost:{wood:1,brick:1},settlement:{wood:2,brick:2,wheat:2,sheep:1},homes:{wood:2,brick:1,wheat:1},walls:{brick:2,ore:1},armory:{ore:2,brick:1},farm:{wood:2,wheat:1},lumberyard:{wood:1,brick:1},quarry:{wood:1,brick:2},mine:{wood:2,ore:1},ranch:{wood:1,sheep:2},barracks:{wood:2,brick:2,ore:1},stables:{wood:2,wheat:2,sheep:1}};
const notes={shipyard:'Build boats on adjacent water',dock:'Allows naval troops to land here',cannons:'Return fire against naval bombardment',outpost:'+2 troops per turn; deployment point',settlement:'Upgrade outpost: 3 troops per turn',homes:'+1 native resource on matching roll',walls:'Defense bonus and stored charges',armory:'Stores attack bonuses on matching roll',farm:'+2 wheat on matching roll',lumberyard:'+2 wood on matching roll',quarry:'+2 brick on matching roll',mine:'+2 ore on matching roll',ranch:'+2 sheep on matching roll',barracks:'+3 troops per turn; adds 3 to tile production',stables:'Cavalry quarters',bridge:'Cross this river with armies'};
let code=new URLSearchParams(location.search).get('room')?.toUpperCase()||'';
let lastPreview=null;
let borderMode=null,originVertex=null,tradeOpen=false;
let state=null,selected=null,roadMode=false,marchFrom=null,amount=1,buildOpen=false,hudOpen=false,lastFlow='',navalMode=null,lastTurnView='',lastEventSeq=0,allocationBusy=false;
root.innerHTML=`
<header><b>RISKAGON <small>THE FRONTIER</small></b><nav><span id="online">Connecting…</span><button data-action="hud" id="hudToggle" aria-expanded="false" aria-controls="hud">Kingdom & treasury</button><button data-action="help">Rules</button></nav></header>
<div id="treasury" class="treasury" aria-label="Your resources"></div><main class="map"><div class="playfield"><div id="board" aria-label="Interactive hexagonal game board"></div>
<div id="turnBanner" class="turn-banner" aria-live="polite"></div>
<div id="entry" class="panel entry"><h1>Shape your kingdom.</h1><p>Harvest the land. Build your roads. Claim the frontier.</p><label for="name">Commander name</label><input id="name" maxlength="24" required placeholder="Your player name"/>
<button class="primary" id="create">Create a realm</button><div class="join"><input id="codeInput" maxlength="6" aria-label="Room code" placeholder="ROOM CODE"/><button id="join">Join</button></div></div>
<button id="prevMap" class="map-arrow prev" data-action="prevMap" aria-label="Previous map" hidden>‹</button>
<button id="nextMap" class="map-arrow next" data-action="nextMap" aria-label="Next map" hidden>›</button>


<aside id="hud" class="panel hud" aria-label="Kingdom information" hidden><h2>Kingdoms</h2><div id="players"></div><h2>Treasury</h2><div id="resources"></div><details><summary>Chronicles & battles</summary><div id="log"></div></details><button data-action="copy">Copy invite link</button></aside>
<div class="map-tools"><button data-action="home" title="Show my kingdom">⌂ My kingdom</button><button data-action="reset">View realm</button></div><div id="mapGuide" class="map-guide">Drag to orbit · Scroll to zoom</div>
</div><section id="lobby" class="panel entry" hidden></section><section id="control" class="panel context" aria-label="Current turn controls" hidden></section></main><div id="toast" role="status"></div>
<dialog id="rules"><button class="close" data-action="help" aria-label="Close rules">×</button><h1>How to conquer.</h1>
<p>Draft a unique banner, then choose any homeland at least four hex steps from earlier picks, in reverse order. Water picks become islands. Every kingdom starts with 3 soldiers and an outpost. Reach <b>32 victory points</b> to win.</p>
<p><b>1 · Roll.</b> Grab either large die on the hex board, hold, drag and release. Or press Roll dice. Mountains rebound dice; forests slow them; clay sticks; fields are neutral; water floats them. Everyone watches the same server-recorded throw. The upward faces determine production.</p>
<p><b>2 · Reinforce.</b> From round two, earn 1 troop per pair of occupied tiles of the same resource, 2 per outpost or 3 per settlement, plus 3 per barracks. On your roll, matching owned tiles also contribute their troop output: a settlement with a barracks yields 6. All troops enter a pool; bonuses on other players’ rolls wait for your next placement phase. Click an outpost or settlement and use +/−, W/S or arrow keys to allocate troops. Escape returns to your discovered territory. Review the plan, then confirm it to begin orders. The opening round grants no reinforcements, including roll bonuses.</p>
<p><b>3 · Orders.</b> Select an owned tile to march, attack or open its build recipes. Armies leave one soldier behind. Roads follow shared edges, halve movement cost and improve attacks. Bridges allow river crossings. Coastal shipyards launch boats carrying up to four existing soldiers each. Embark from a coastal outpost, sail through adjacent water, and land only through a dock. Build a landing dock on unclaimed shore from a neighboring crewed boat. Bombardment reduces an adjacent enemy garrison without return fire unless it has cannons. Sailing, landing and bombardment each cost one movement point. Buildings and troops reveal nearby territory; numbers appear within five hexes.</p>
<p>Outposts upgrade into settlements; their base troop outputs replace each other. Matching rolls produce for all owners. Bonus troops from other players’ rolls wait for your next reinforcement phase. Settlement upgrades also score a point.</p><button data-action="help" class="primary">Return to game</button></dialog>`;
$('#codeInput').value=code;
const admissionKey='riskagon:admitted';
function toast(message,error=false){const t=$('#toast');t.textContent=message;t.className=error?'show error':'show';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.className='',4000);}
function me(){return state?.players.find(p=>p.id===id);}
function isActive(){return state?.game?.phase==='playing'&&state.players[state.game.turn]?.id===id;}
function canOrder(){return isActive()&&state.game.turnStage==='orders';}
function command(event,data,onSuccess){socket.timeout(15000).emit(event,data,(error,response)=>{if(error||!response?.ok){toast(response?.error||'Connection interrupted. Try again.',true);return;}onSuccess?.(response);});}
function act(data,done){command('game:action',data,done);}
function displayRoom(value){code=value;history.replaceState(null,'','?room='+code);}
function enterRoom(create=false){
 const name=$('#name').value.trim();
 if(!name){$('#name').focus();return;}
 const roomCode=$('#codeInput').value.trim().toUpperCase();
 command(create?'room:create':'room:join',{id,name,code:roomCode},r=>{
  sessionStorage.setItem(admissionKey,JSON.stringify({code:r.code,id,name}));displayRoom(r.code);
 });
}
function validateEntry(){
 $('#create').disabled=!$('#name').value.trim();
 $('#join').disabled=$('#create').disabled||!$('#codeInput').value.trim();
}
$('#name').addEventListener('input',validateEntry);$('#codeInput').addEventListener('input',validateEntry);validateEntry();
function btn(text,action,enabled=true,cls=''){return `<button data-action="${action}" class="${cls}" ${enabled?'':'disabled'}>${text}</button>`;}
const costLabel=k=>Object.entries(costs[k]||{}).map(([r,n])=>n+' '+icons[r]).join(' · ');
function canPay(kind){return Object.entries(costs[kind]||{}).every(([r,n])=>(me()?.resources?.[r]||0)>=n);}
function canBridge(tile){return tile?.terrain==='river'&&!tile.bridge&&state.game.tiles.some(t=>t.owner===id&&Math.max(Math.abs(t.q-tile.q),Math.abs(t.r-tile.r),Math.abs(t.q+t.r-tile.q-tile.r))===1);}
function preview(){
 const tiles=[],terrain=['forest','fields','pasture','hills','mountains'];
 for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)if(Math.abs(q+r)<=5){const key=q+','+r;tiles.push({q,r,id:key,terrain:['0,0','1,0','0,1','-1,1','1,-1'].includes(key)?'lake':terrain[(Math.floor((q+5)/2)+Math.floor((r+5)/2)*3+10)%5],number:null,owner:null,army:0,building:0,structures:[],masked:true});}
 return tiles;
}
const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function canDock(tile){return tile&&!tile.owner&&coastal(state.game,tile)&&state.game.tiles.some(t=>t.owner===id&&t.boats&&t.navy&&distance(t,tile)===1);}
function backToTerritory(){borderMode=null;originVertex=null;tradeOpen=false;selected=null;buildOpen=false;roadMode=false;marchFrom=null;navalMode=null;board.fitDiscovered();render();}
const board=new Board($('#board'),tile=>{
 const g=state?.game;if(!g)return;
 if(g.phase==='draft'){if(g.draftStage==='spawn'&&g.spawnChoices.includes(tile))command('draft:pick',{kind:'spawn',value:tile});return;}
 if(navalMode&&canOrder()){
  const mode=navalMode;if(!moveTo(mode,tile))return;navalMode=null;

  selected=tile;render();return;
 }
 if(marchFrom&&canOrder()){
  if(!moveTo({type:'march',from:marchFrom},tile))return;
  marchFrom=null;selected=tile;render();return;
 }
 selected=tile;amount=Math.max(1,(g.tiles.find(t=>t.id===tile)?.army||g.tiles.find(t=>t.id===tile)?.navy||1)-(g.tiles.find(t=>t.id===tile)?.navy?0:1));buildOpen=false;roadMode=false;
 if(isActive()&&g.turnStage==='deploy'){
  const target=g.tiles.find(t=>t.id===tile);if(target?.owner===id&&target.building&&!isWater(target))board.focus(tile);
 }
 render();
},edge=>{
 if(!canOrder()||!borderMode||!edge.vertex)return;
 const sides=optionsFor(borderMode,selected).map(o=>o.target.split('~'));
 if(!sides.some(side=>side.includes(edge.vertex)&&(!originVertex||edge.vertex!==originVertex&&side.includes(originVertex))))return;
 if(!originVertex){originVertex=edge.vertex;render();return;}
 act({type:borderMode==='road'?'road':borderMode==='gate'?'gate':'edgeWall',vertices:[originVertex,edge.vertex],material:borderMode,tile:selected});originVertex=null;render();
});
board.onHover=tile=>{$('#mapGuide').textContent=tile?`${terrainName(tile)} · ${tile.numberHidden?'Number undiscovered':'Roll '+(tile.number??'—')} · ${tile.owner===id&&tile.moveReady?'Ready: '+(isWater(tile)?tile.moveReady.navy:tile.moveReady.army)+' troops · ':''}${tile.masked?'Unscouted':isWater(tile)?(tile.boats||0)+' boats · '+(tile.navy||0)+' naval troops':tile.army+' troops'}`:'WASD / arrows to pan · Scroll to zoom · Hover to inspect';};
board.update(preview(),{});
const dice=new BoardDice(board,throwData=>new Promise((resolve,reject)=>{
 socket.timeout(15000).emit('game:action',{type:'roll',throw:throwData},(error,r)=>{if(error||!r?.ok){reject(Error(r?.error||'Roll interrupted. Try again.'));return;}resolve();});
}),message=>toast(message,true));
board.onFrame=now=>dice.update(now);
const effects=harvestEffects(board,icons,r=>me()?.resources?.[r]||0);
let harvestId=null,serverOffset=0;
function updateClock(){
 const el=$('#turnClock');if(!el)return;
 const seconds=Math.max(0,Math.ceil((state.game.deadline-Date.now()-serverOffset)/1000));
 el.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
setInterval(updateClock,250);
const optionsFor=(type,tile)=> (state?.game?.orders||[]).filter(o=>o.type===type&&(!tile||o.tile===tile));
function buildPanel(tile){
 const options=optionsFor('build',tile.id).map(o=>o.target);
 if(optionsFor('bridge',tile.id).length)options.push('bridge');
 return `<div class="builder"><h2>Build · ${safe(terrainName(tile))}</h2>${options.map(kind=>`<button class="recipe" data-build="${kind}"><b>${safe(kind)}</b><small>${safe(notes[kind])}</small><span>${costLabel(kind)}</span></button>`).join('')}</div>${btn('Back to orders','closeBuild')}`;
}
function destinations(){
 const mode=navalMode||(marchFrom?{type:'march',from:marchFrom}:null);
 return mode?optionsFor(mode.type,mode.from).map(o=>o.target):[];
}
function moveTo(mode,tile){
 const order=optionsFor(mode.type,mode.from).find(o=>o.target===tile);
 if(!order)return false;
 act({type:mode.type,from:mode.from,to:tile,amount:order.max?Math.min(order.max,Math.max(order.min,amount)):amount});
 return true;
}
function changeAllocation(delta){
 const g=state?.game,tile=g?.tiles.find(t=>t.id===selected);
 if(allocationBusy||!isActive()||g.turnStage!=='deploy'||tile?.owner!==id||!tile.building||isWater(tile))return;
 const count=(g.allocations?.[id]?.[selected]||0)+delta;
 if(count<0||delta>0&&!g.reinforcements[id])return;
 allocationBusy=true;
 socket.timeout(10000).emit('game:action',{type:'allocate',tile:selected,count},(error,r)=>{allocationBusy=false;if(error||!r?.ok)toast(r?.error||'Allocation interrupted. Try again.',true);});
}
function cycleMap(direction){
 if(!state||state.game||state.host!==id)return;
 const maps=Object.keys(MAPS),index=maps.indexOf(state.mapId);
 command('room:map',{mapId:maps[(index+direction+maps.length)%maps.length]});
}
window.addEventListener('keydown',e=>{
 if(state&&!state.game&&state.host===id&&!e.target.closest?.('input,textarea,select,dialog')&&!document.querySelector('dialog[open]')&&['ArrowLeft','ArrowRight'].includes(e.key)){
  e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)cycleMap(e.key==='ArrowLeft'?-1:1);return;
 }
 if(e.target.closest?.('input,textarea,select,dialog')||!state?.game)return;
 if(e.key==='Escape'){e.preventDefault();board.keys.clear();backToTerritory();return;}
 const tile=state.game.tiles.find(t=>t.id===selected);
 if(isActive()&&state.game.turnStage==='deploy'&&tile?.owner===id&&tile.building&&['w','s','W','S','ArrowUp','ArrowDown','ArrowRight','ArrowLeft'].includes(e.key)){
  e.preventDefault();e.stopImmediatePropagation();board.keys.clear();changeAllocation(['w','W','ArrowUp','ArrowRight'].includes(e.key)?1:-1);
 }
},true);
function render(){
 const g=state?.game,phase=g?.phase,stage=g?.turnStage;
 const flow=phase+':'+g?.round+':'+g?.turn+':'+stage;
 if(flow!==lastFlow){buildOpen=false;roadMode=false;marchFrom=null;navalMode=null;lastFlow=flow;borderMode=null;originVertex=null;tradeOpen=false;}
 $('#entry').hidden=!!state;$('#lobby').hidden=!state||!!g;$('#control').hidden=!g;$('#turnBanner').hidden=!g;
 $('#hud').hidden=!hudOpen;$('#hudToggle').setAttribute('aria-expanded',String(hudOpen));
 const current=state?.players[g?.turn],tile=g?.tiles.find(t=>t.id===selected),own=tile?.owner===id,reserve=g?.reinforcements?.[id]||0;
 $('#prevMap').hidden=$('#nextMap').hidden=!state||!!g||state.host!==id;
 if(state&&!g){
  $('#lobby').innerHTML=`<h2>${safe(MAPS[state.mapId])}</h2><strong class="room-code">${safe(state.code)}</strong><p>${state.players.length}/8 kingdoms · Share the code or invite link.</p>${btn('Copy invite link','copy')}<div class="lobby-players">${state.players.map(p=>`<p>${safe(p.name)} ${p.bot?'· AI':''} ${p.id===state.host?'· Host':''}</p>`).join('')}</div>${state.host===id?btn('Add AI kingdom','bot',state.players.length<COLORS.length)+btn('Begin draft','start',state.players.length>=2,'primary'):'<p>Waiting for the host.</p>'}`;
 }
 let controls='',guide='WASD / arrows to pan · Scroll to zoom · Hover to inspect';
 if(phase==='draft'){
  const order=g.draftStage==='color'?g.draftOrder:[...g.draftOrder].reverse(),drafter=order[g.draftIndex],mine=drafter===id,name=state.players.find(p=>p.id===drafter)?.name;
  $('#turnBanner').innerHTML=`<b>${mine?'Your pick':safe(name)+' is drafting'}</b> · ${g.draftStage==='color'?'Choose a banner':'Choose your homeland'}`;
  controls=g.draftStage==='color'?`<h2>Choose your kingdom</h2><div class="color-draft">${COLORS.map(c=>`<button data-color="${c}" ${mine&&!state.players.some(p=>p.color===c)?'':'disabled'}><i style="background:#${FACTIONS[c].toString(16).padStart(6,'0')}"></i>${c}</button>`).join('')}</div>`:`<h2>${mine?'Choose a homeland at least 4 hexes from other starts':'Waiting for a homeland pick'}</h2><details><summary>Starting locations</summary><div class="draft-options">${g.spawnChoices.map(x=>`<button data-spawn="${x}" ${mine?'':'disabled'}>${x}</button>`).join('')}</div></details>`;
  guide='3 starting troops · No opening-round reinforcements';
 }else if(g){
  const active=isActive(),orders=canOrder(),rolling=stage==='rolling';
  $('#turnBanner').innerHTML=`<b>${phase==='finished'?'Conquest complete':active?'Your turn':safe(current.name)+"’s turn"}</b> · Round ${g.round}${phase==='playing'?`<span class="steps"><em class="${stage==='roll'||rolling?'current':''}">1 Roll</em><em class="${stage==='deploy'?'current':''}">2 Reinforce</em><em class="${orders?'current':''}">3 Orders</em></span>`:''}`;
  if(phase==='finished')controls=`<h2>${safe(state.players.find(p=>p.id===g.winner)?.name)} united the frontier!</h2>`;
  else if(rolling){controls='<h2>Dice in motion…</h2><p>Watch the upward faces. Production follows when both dice settle.</p>';guide='Mountains rebound · Forests slow · Clay sticks · Water floats';}
  else if(active&&stage==='roll'){
   controls=`<h2>Roll for production</h2><p>Roll to collect income, then choose where your reinforcements go.</p>${btn('Roll dice','physicalRoll',!dice.running,'primary')}`;
   guide='Dice react to the terrain beneath them';
  }else if(active&&stage==='deploy'){
   const legal=own&&tile.building&&!isWater(tile),allocated=g.allocations?.[id]?.[selected]||0;
   const income=g.income||{};
   controls=`<div class="deployment-head"><h2>${reserve} troops left to allocate</h2><small>Outposts ${income.outposts||0} · Settlements ${income.settlements||0} · Barracks ${income.barracks||0} · Resource pairs ${income.territory||0} · Rolled ${income.production||0}</small></div>
   <div class="deployment-actions">${legal?`${btn('← Territory view','territory')}<b>${safe(terrainName(tile))} ${tile.building>=2?'settlement':'outpost'}</b><div class="allocation-stepper">${btn('−','less',allocated>0)}<output aria-live="polite">${allocated} assigned</output>${btn('+','more',reserve>0)}</div><small>W / ↑ adds · S / ↓ removes · Esc returns</small>`:'<p>Choose a highlighted outpost or settlement. Allocations stay editable until you confirm.</p>'}${btn('Confirm placements & begin orders','confirmDeployment',reserve===0,'primary')}</div>`;
   guide='Reinforcements first · Movement and building unlock afterwards';
  }else{
   controls=tile?'':`<div class="context-heading"><b>${active?'Issue orders':'Observing the realm'}</b>${g.lastRoll?`<span>⚄ ${g.lastRoll.dice.join(' + ')} = ${g.lastRoll.sum}</span>`:''}</div>`;
   if(tile){
    controls+=`<div class="province"><b>${safe(terrainName(tile))}</b>${btn('←','territory',true,'close-selection')}<small>${tile.numberHidden?'Number hidden':`Roll ${tile.number??'—'}`} · ${own&&tile.moveReady?'Ready: '+(isWater(tile)?tile.moveReady.navy:tile.moveReady.army)+' troops · ':''}${tile.masked?'Unscouted':isWater(tile)?(tile.boats||0)+' boats · '+(tile.navy||0)+' naval troops':tile.army+' soldiers'}${tile.owner?' · '+safe(state.players.find(p=>p.id===tile.owner)?.name):''}</small></div>`;
    if(buildOpen&&orders&&(!isWater(tile)||canBridge(tile))&&(own||canBridge(tile)))controls+=buildPanel(tile);
    else if(orders){
     amount=Math.min(Math.max(1,amount),Math.max(1,isWater(tile)&&!marchFrom?tile.navy:(tile.army||0)-1));
     if(marchFrom)controls+=`<div class="quantity move-picker"><label for="amount">Troops to move</label><button data-action="moveLess">−</button><input id="amount" type="number" min="1" max="${tile.army-1}" value="${amount}"/><button data-action="moveMore">+</button><button data-action="moveAll">All available</button></div><p>Select an adjacent hex to move or attack.</p>${btn('Cancel march','march')}`;
     else if(roadMode)controls+=`<p>Click a golden shared edge. Cost: ${costLabel('road')}</p>${btn('Cancel road','road')}`;
     else if(navalMode)controls+=`<div class="quantity move-picker"><label for="amount">Troops for naval order</label><input id="amount" type="number" min="1" value="${amount}"/></div><p>${safe(navalMode.type)}: click a highlighted neighboring tile.</p>${btn('Cancel naval order','cancelNaval')}`;
     else if(own){
      if(isWater(tile)){
       controls+=`<div class="actions">${btn('Sail…','sail',tile.navy>0&&(tile.moveReady?.navy??tile.navy)>0)}${btn('Bombard…','bombard',tile.navy>0&&(tile.moveReady?.navy??tile.navy)>0)}${btn('Land at dock…','land',tile.navy>0&&(tile.moveReady?.navy??tile.navy)>0)}</div>`;
       if(optionsFor('march',tile.id).length)controls+=btn('March / attack','march');
       if(canBridge(tile))controls+=btn('Build bridge','openBuild');
       if(!tile.navy)controls+='<p>Select a neighboring coastal outpost to embark troops onto this boat.</p>';
      }else{
       controls+=`<div class="actions">${btn('Build…','openBuild')}${btn('March / attack','march',tile.army>1&&(tile.moveReady?.fastArmy??tile.army)>0)}${tile.structures.includes('shipyard')?btn('Launch boat… · '+costLabel('boat'),'launch',canPay('boat')):''}${tile.building&&coastal(g,tile)?btn('Embark…','embark',tile.army>1):''}</div>`;
      }
      controls+=`<details class="border-tools"><summary>Borders</summary>${btn('Road vertices','road')}${btn('Wood wall','wood')}${btn('Stone wall','stone')}${btn('Gate','gate')}</details>`;
      if(tile.army>1||tile.navy>0)controls+=`<div class="quantity"><label for="amount">Troops for order</label><input id="amount" type="number" min="1" max="${isWater(tile)?tile.navy:tile.army-1}" value="${amount}"/></div>`;
     }
     else if(canDock(tile))controls+=btn('Construct landing dock · '+costLabel('dock'),'landingDock',canPay('dock'));
     else if(canBridge(tile))controls+=btn('Build bridge…','openBuild');
    }
   }else controls+='<p>Choose a territory on the map to see its available orders.</p>';
   if(active)controls+=`<div class="turn-end"><small>Each troop: 2 movement · roads / boats: ½ cost${g.round===1?' · Opening round: no troop income':''}</small>${btn('End turn →','end',orders,'primary')}</div>`;
   guide=navalMode?'Choose an adjacent highlighted naval destination':marchFrom?'Choose an adjacent destination':roadMode?'Click a glowing shared hex edge':'Select a territory · Build recipes open only on request';
  }
 }
 if(borderMode)controls=`<p>${safe(borderMode)}: choose ${originVertex?'destination':'origin'} vertex. Roads are free; occupy both adjoining tiles. Wood walls cost 1 wood; stone costs 2 ore. Gates are free, two per tile.</p>${btn('Cancel border construction','cancelBorder')}`;
 if(canOrder()&&optionsFor('trade').length)controls+=btn('Trade','trade');
 if(tradeOpen&&canOrder()&&optionsFor('trade').length){
  controls=`<div class="trade-form"><label>Partner<select id="tradePartner">${g.tiles.filter(t=>optionsFor('trade').some(o=>o.target==='tavern:'+t.id)).map(t=>`<option value="tavern:${t.id}">Tavern ${t.id}</option>`).join('')}${state.players.filter(p=>optionsFor('trade').some(o=>o.target===p.id)).map(p=>`<option value="${p.id}">${safe(p.name)}</option>`).join('')}</select></label><label>Give<select id="give">${Object.keys(icons).map(r=>`<option>${r}</option>`).join('')}</select><input id="giveCount" aria-label="Offer amount" type="number" min="1" value="1"/></label><label>Receive<select id="receive">${Object.keys(icons).map(r=>`<option ${r==='ore'?'selected':''}>${r}</option>`).join('')}</select><input id="receiveCount" aria-label="Receive amount" type="number" min="1" value="1"/></label><small>${g.tiles.filter(t=>t.tavern&&t.tavernRates).map(t=>'Tavern '+t.id+': '+Object.entries(t.tavernRates).map(([r,n])=>r+' '+n+':1').join(' · ')).join('<br>')}</small><small>Taverns: local resource 1:1; imports cost 2–4 offered units per item. Player trades require acceptance.</small>${btn('Send offer / buy','sendTrade')}${btn('Close trade','trade')}</div>`;
 }
 if(g?.trade?.to===id)controls+=`<p>Trade offer: receive ${g.trade.giveCount} ${safe(g.trade.give)} for ${g.trade.receiveCount} ${safe(g.trade.receive)}.</p>${btn('Accept trade','acceptTrade',(me()?.resources?.[g.trade.receive]||0)>=g.trade.receiveCount)}${btn('Reject trade','rejectTrade')}`;
 $('#treasury').innerHTML=Object.entries(icons).map(([r,icon])=>`<span>${icon} ${r} <b data-balance="${r}">${me()?.resources?.[r]||0}</b></span>`).join('');
 effects.refresh();
 if(phase==='playing')$('#turnBanner').insertAdjacentHTML('beforeend',' <strong id="turnClock" aria-label="Time remaining"></strong>');
 updateClock();
 $('#control').innerHTML=controls;
 if(canOrder()&&tile&&!borderMode&&!marchFrom&&!navalMode){
  const types={openBuild:['build','bridge'],road:['road'],wood:['wood'],stone:['stone'],gate:['gate'],march:['march'],sail:['sail'],land:['land'],bombard:['bombard'],launch:['launch'],embark:['embark'],landingDock:['landingDock']};
  for(const button of $('#control').querySelectorAll('[data-action]')){
   const kinds=types[button.dataset.action];if(kinds&&!kinds.some(k=>optionsFor(k,tile.id).length))button.remove();
  }
 }
 const bordersMenu=$('.border-tools');if(bordersMenu&&!bordersMenu.querySelector('button'))bordersMenu.remove();
 validateTrade();$('#mapGuide').textContent=guide;
 board.update(g?.tiles||state?.preview||preview(),{selected,borderMode,validEdges:borderMode?optionsFor(borderMode,selected).map(o=>o.target):[],originVertex,borders:g?.borders||{},deploy:isActive()&&stage==='deploy',allocations:g?.allocations?.[id]||{},destinations:destinations(),roadMode:canOrder()&&roadMode,roads:g?.roads||{},players:state?.players||[],myId:id,spawnChoices:phase==='draft'&&g.draftStage==='spawn'?g.spawnChoices:[]});
 const previewKey=state&&!g?state.mapId+':'+state.preview.length:null;
 if(previewKey&&previewKey!==lastPreview)requestAnimationFrame(()=>{board.resize();board.fitTiles(board.tiles);});
 lastPreview=previewKey;
 const viewKey=phase==='playing'&&isActive()?g.round+':'+g.turn:'';
 if(viewKey&&viewKey!==lastTurnView){selected=null;requestAnimationFrame(()=>{board.resize();board.fitDiscovered();});lastTurnView=viewKey;toast('Your turn — command your kingdom.');}
 $('#turnBanner').classList.toggle('your-turn',isActive());
 dice.setMode(isActive()&&stage==='roll'?'resource':'idle');
 if(g?.lastRoll)dice.play(g.lastRoll,g.serverNow);
 $('#players').innerHTML=state?.players.map(p=>`<div class="player"><i style="background:#${(FACTIONS[p.color]??0xacbcae).toString(16).padStart(6,'0')}"></i><b>${safe(p.name)}${p.id===id?' · You':''}</b><span>${g?.scores?.[p.id]??0} VP</span></div>`).join('')||'<p>Create a realm to begin.</p>';
 $('#resources').innerHTML=me()?.resources?Object.entries(icons).map(([key,icon])=>`<div class="resource"><span>${icon} ${key}</span><b>${me().resources[key]||0}</b></div>`).join(''):'<p>Available after drafting.</p>';

 $('#log').innerHTML=(g?.lastBattle?`<p>⚔ ${safe(g.lastBattle.attacker)} attacked ${safe(g.lastBattle.defender)} · ${safe(g.lastBattle.result)}</p>`:'')+(g?.log.map(line=>`<p>${safe(line)}</p>`).join('')||'');
}
$('#create').onclick=()=>enterRoom(true);
$('#join').onclick=()=>enterRoom();
$('#codeInput').onkeydown=e=>{if(e.key==='Enter'&&!$('#join').disabled)enterRoom();};
root.addEventListener('click',async e=>{
 const el=e.target.closest('[data-action],[data-color],[data-spawn],[data-build]');if(!el||el.disabled)return;
 if(el.dataset.color){command('draft:pick',{kind:'color',value:el.dataset.color});return;}
 if(el.dataset.spawn){command('draft:pick',{kind:'spawn',value:el.dataset.spawn});return;}
 if(el.dataset.build){act(el.dataset.build==='bridge'?{type:'bridge',tile:selected}:{type:'build',tile:selected,kind:el.dataset.build});return;}
 const action=el.dataset.action;
 if(action==='prevMap'||action==='nextMap'){cycleMap(action==='prevMap'?-1:1);return;}
 if(action==='trade'){tradeOpen=!tradeOpen;render();return;}
 if(action==='acceptTrade'||action==='rejectTrade'){act({type:action});return;}
 if(action==='sendTrade'){
  const partner=$('#tradePartner').value,give=$('#give').value,receive=$('#receive').value,count=Number($('#receiveCount').value);
  act(partner.startsWith('tavern:')?{type:'tavernTrade',tile:partner.slice(7),give,receive,count}:{type:'offerTrade',player:partner,give,receive,giveCount:Number($('#giveCount').value),receiveCount:count});tradeOpen=false;render();return;
 }
 if(action==='cancelBorder'){borderMode=null;originVertex=null;render();return;}
 if(['moveMore','moveLess','moveAll'].includes(action)){const t=state.game.tiles.find(t=>t.id===selected);amount=action==='moveAll'?Math.min(t.army-1,t.moveReady?.army??t.army-1):Math.max(1,Math.min(t.army-1,amount+(action==='moveMore'?1:-1)));render();return;}

 if(action==='help'){const d=$('#rules');d.open?d.close():d.showModal();return;}
 if(action==='hud'){hudOpen=!hudOpen;render();return;}
 if(action==='copy'){try{await navigator.clipboard.writeText(location.href);toast('Invite link copied.');}catch{toast(location.href);}return;}
 if(action==='bot'||action==='start'){command('room:'+(action==='bot'?'addBot':'start'),{});return;}
 if(action==='physicalRoll'){dice.throw();return;}
 if(action==='reset'){board.reset();return;}
 if(action==='home'||action==='territory'){backToTerritory();return;}
 if(action==='openBuild'){buildOpen=true;marchFrom=null;navalMode=null;roadMode=false;}
 if(action==='closeBuild')buildOpen=false;
 if(action==='deselect'){selected=null;buildOpen=false;roadMode=false;marchFrom=null;}
 if(['road','wood','stone','gate'].includes(action)){borderMode=action;originVertex=null;marchFrom=null;buildOpen=false;}
 if(action==='march'){marchFrom=marchFrom?null:selected;roadMode=false;buildOpen=false;}
 if(action==='more'||action==='less'){changeAllocation(action==='more'?1:-1);return;}
 if(action==='confirmDeployment'){act({type:'confirmDeployment'},backToTerritory);return;}
 if(action==='landingDock'){act({type:'dock',tile:selected});return;}
 if(['launch','embark','sail','land','bombard'].includes(action)){navalMode={type:action,from:selected};if(['sail','land'].includes(action))amount=state.game.tiles.find(t=>t.id===selected)?.navy||1;marchFrom=null;buildOpen=false;if(!destinations().length){navalMode=null;toast('No legal adjacent destinations for this naval order.',true);}render();return;}
 if(action==='cancelNaval')navalMode=null;
 if(action==='end'){act({type:'end'});return;}
 render();
});
function validateTrade(){
 const form=$('.trade-form');if(!form)return;
 const give=$('#give').value,receive=$('#receive').value,n=Number($('#receiveCount').value),offer=Number($('#giveCount').value);
 const partner=$('#tradePartner').value,shop=partner.startsWith('tavern:');
 const rate=shop?state.game.tiles.find(t=>t.id===partner.slice(7))?.tavernRates?.[receive]:1;
 $('#giveCount').disabled=shop;
 form.querySelector('[data-action=sendTrade]').disabled=!partner||give===receive||!Number.isSafeInteger(n)||n<1||(!shop&&(!Number.isSafeInteger(offer)||offer<1||offer>999||n>999))||(me().resources[give]||0)<(shop?n*rate:offer);
}
root.addEventListener('input',validateTrade);root.addEventListener('change',validateTrade);
root.addEventListener('input',e=>{
 if(e.target.id==='amount')amount=Math.max(1,Math.floor(Number(e.target.value)||1));
});
socket.on('connect',()=>{
 $('#online').textContent='● Connected';
 const admitted=JSON.parse(sessionStorage.getItem(admissionKey)||'null');
 if(code&&admitted?.code===code&&admitted.id===id)socket.emit('room:join',admitted,r=>{
  if(!r?.ok){sessionStorage.removeItem(admissionKey);state=null;render();toast(r?.error||'Could not rejoin.',true);}
 });
});
socket.on('disconnect',()=>{$('#online').textContent='Reconnecting…';dice.cancel();});
socket.on('state',next=>{
 const changedRoom=state?.code!==next.code;if(changedRoom)lastTurnView='';
 const fresh=changedRoom?[]:(next.game?.events||[]).filter(e=>e.seq>lastEventSeq);
 if(changedRoom){effects.reset();harvestId=next.game?.harvest?.id||null;}
 state=next;serverOffset=(next.game?.serverNow??Date.now())-Date.now();lastEventSeq=next.game?.eventSeq||0;
 if(code!==state.code)displayRoom(state.code);render();
 if(next.game?.harvest&&next.game.harvest.id!==harvestId){harvestId=next.game.harvest.id;effects.play(next.game.harvest);}
 for(const event of fresh)board.playEvent(event,state.players);
});
render();
