import './style.css';
import {io} from 'socket.io-client';
import {Board} from './board.js';
import {BoardDice} from './dice.js';
const socket=io(),root=document.getElementById('app');
const id=sessionStorage.getItem('riskagon:id')||crypto.randomUUID().slice(0,22);
sessionStorage.setItem('riskagon:id',id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const kinds={forest:'Forest',fields:'Wheat Fields',pasture:'Pasture',hills:'Clay Hills',mountains:'Iron Mountains',desert:'Desert',river:'River Crossing',lake:'Lake'};
const icons={wood:'🌲',brick:'🧱',wheat:'🌾',sheep:'🐑',ore:'⛏️'};
const costs={road:{wood:1,brick:1},bridge:{wood:2,brick:1,ore:1},outpost:{wood:1,brick:1},settlement:{wood:2,brick:2,wheat:2,sheep:1},homes:{wood:2,brick:1,wheat:1},walls:{brick:2,ore:1},armory:{ore:2,brick:1},farm:{wood:2,wheat:1},lumberyard:{wood:1,brick:1},quarry:{wood:1,brick:2},mine:{wood:2,ore:1},ranch:{wood:1,sheep:2},barracks:{wood:2,brick:2,ore:1},stables:{wood:2,wheat:2,sheep:1}};
const notes={outpost:'+2 troops per turn; deployment point',settlement:'Upgrade outpost: 3 troops per turn',homes:'+1 native resource on matching roll',walls:'Defense bonus and stored charges',armory:'Stores attack bonuses on matching roll',farm:'+2 wheat on matching roll',lumberyard:'+2 wood on matching roll',quarry:'+2 brick on matching roll',mine:'+2 ore on matching roll',ranch:'+2 sheep on matching roll',barracks:'+3 troops per turn; adds 3 to tile production',stables:'Stores movement on matching roll',bridge:'Cross this river with armies'};
const industry={forest:'lumberyard',fields:'farm',hills:'quarry',mountains:'mine',pasture:'ranch'};
let code=new URLSearchParams(location.search).get('room')?.toUpperCase()||'';
let state=null,selected=null,roadMode=false,marchFrom=null,amount=1,deployAmount=1,buildOpen=false,hudOpen=false,lastFlow='';
root.innerHTML=`
<header><b>RISKAGON <small>THE FRONTIER</small></b><nav><span id="online">Connecting…</span><button data-action="hud" id="hudToggle" aria-expanded="false" aria-controls="hud">Kingdom & treasury</button><button data-action="help">Rules</button></nav></header>
<main class="map"><div id="board" aria-label="Interactive hexagonal game board"></div>
<div id="turnBanner" class="turn-banner" aria-live="polite"></div>
<div id="entry" class="panel entry"><h1>Shape your kingdom.</h1><p>Harvest the land. Build your roads. Claim the frontier.</p><label for="name">Commander name</label><input id="name" maxlength="24" value="Commander"/>
<button class="primary" id="create">Create a realm</button><div class="join"><input id="codeInput" maxlength="6" aria-label="Room code" placeholder="ROOM CODE"/><button id="join">Join</button></div></div>
<section id="lobby" class="panel entry" hidden></section>
<section id="control" class="panel context" aria-label="Current turn controls" hidden></section>
<aside id="hud" class="panel hud" aria-label="Kingdom information" hidden><h2>Kingdoms</h2><div id="players"></div><h2>Treasury</h2><div id="resources"></div><details><summary>Chronicles & battles</summary><div id="log"></div></details><button data-action="copy">Copy invite link</button></aside>
<div class="map-tools"><button data-action="home" title="Show my kingdom">⌂ My kingdom</button><button data-action="reset">View realm</button></div><div id="mapGuide" class="map-guide">Drag to orbit · Scroll to zoom</div>
</main><div id="toast" role="status"></div>
<dialog id="rules"><button class="close" data-action="help" aria-label="Close rules">×</button><h1>How to conquer.</h1>
<p>Draft a unique banner, then choose a homeland in reverse order. Every kingdom starts with 3 soldiers and an outpost. Reach <b>32 victory points</b> to win.</p>
<p><b>1 · Roll.</b> Grab either large die on the hex board, hold, drag and release. Or press Roll dice. Mountains rebound dice; forests slow them; clay sticks; fields are neutral; water floats them. Everyone watches the same server-recorded throw. The upward faces determine production.</p>
<p><b>2 · Reinforce.</b> From round two, earn 1 troop per pair of occupied tiles of the same resource, 2 per outpost or 3 per settlement, plus 3 per barracks. On your roll, matching owned tiles also contribute their troop output: a settlement with a barracks yields 6. All troops enter a pool; bonuses on other players’ rolls wait for your next placement phase. Place every troop on your occupied land or structures before issuing orders. The opening round grants no reinforcements, including roll bonuses.</p>
<p><b>3 · Orders.</b> Select an owned tile to march, attack or open its build recipes. Armies leave one soldier behind. Roads follow shared edges, halve movement cost and improve attacks. Bridges allow river crossings; lakes remain closed to armies. Buildings and troops reveal nearby territory; numbers appear within five hexes.</p>
<p>Outposts upgrade into settlements; their base troop outputs replace each other. Matching rolls produce for all owners. Bonus troops from other players’ rolls wait for your next reinforcement phase. Settlement upgrades also score a point.</p><button data-action="help" class="primary">Return to game</button></dialog>`;
$('#name').value=localStorage.getItem('riskagon:name')||'Commander';
function toast(message,error=false){const t=$('#toast');t.textContent=message;t.className=error?'show error':'show';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.className='',4000);}
function me(){return state?.players.find(p=>p.id===id);}
function isActive(){return state?.game?.phase==='playing'&&state.players[state.game.turn]?.id===id;}
function canOrder(){return isActive()&&state.game.turnStage==='orders';}
function command(event,data,onSuccess){socket.timeout(15000).emit(event,data,(error,response)=>{if(error||!response?.ok){toast(response?.error||'Connection interrupted. Try again.',true);return;}onSuccess?.(response);});}
function act(data){command('game:action',data);}
function displayRoom(value){code=value;history.replaceState(null,'','?room='+code);}
function username(){const name=$('#name').value.trim().slice(0,24)||'Commander';localStorage.setItem('riskagon:name',name);return name;}
function joinRoom(value){command('room:join',{code:value.trim().toUpperCase(),id,name:username()},r=>displayRoom(r.code));}
function btn(text,action,enabled=true,cls=''){return `<button data-action="${action}" class="${cls}" ${enabled?'':'disabled'}>${text}</button>`;}
const costLabel=k=>Object.entries(costs[k]||{}).map(([r,n])=>n+' '+icons[r]).join(' · ');
function canPay(kind){return Object.entries(costs[kind]||{}).every(([r,n])=>(me()?.resources?.[r]||0)>=n);}
function canBridge(tile){return tile?.terrain==='river'&&!tile.bridge&&state.game.tiles.some(t=>t.owner===id&&Math.max(Math.abs(t.q-tile.q),Math.abs(t.r-tile.r),Math.abs(t.q+t.r-tile.q-tile.r))===1);}
function preview(){
 const tiles=[],terrain=['forest','fields','pasture','hills','mountains'];
 for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)if(Math.abs(q+r)<=5){const key=q+','+r;tiles.push({q,r,id:key,terrain:['0,0','1,0','0,1','-1,1','1,-1'].includes(key)?'lake':terrain[(Math.floor((q+5)/2)+Math.floor((r+5)/2)*3+10)%5],number:null,owner:null,army:0,building:0,structures:[],masked:true});}
 return tiles;
}
const board=new Board($('#board'),tile=>{
 const g=state?.game;if(!g)return;
 if(g.phase==='draft'){if(g.draftStage==='spawn'&&g.spawnChoices.includes(tile))command('draft:pick',{kind:'spawn',value:tile});return;}
 if(marchFrom&&canOrder()){
  if(tile!==marchFrom)act({type:'march',from:marchFrom,to:tile,amount});
  marchFrom=null;selected=tile;render();return;
 }
 selected=tile;buildOpen=false;roadMode=false;render();
},edge=>{if(roadMode&&canOrder())act({type:'road',edge});});
board.update(preview(),{});
const dice=new BoardDice(board,throwData=>new Promise((resolve,reject)=>{
 socket.timeout(15000).emit('game:action',{type:'roll',throw:throwData},(error,r)=>{if(error||!r?.ok){reject(Error(r?.error||'Roll interrupted. Try again.'));return;}resolve();});
}),message=>toast(message,true));
board.onFrame=now=>dice.update(now);
function buildPanel(tile){
 const options=canBridge(tile)?['bridge']:!tile.building?['outpost']:[...(tile.building===1?['settlement']:[]),'homes','walls','armory',industry[tile.terrain],'barracks','stables'].filter(Boolean);
 return `<div class="builder"><h2>Build · ${safe(kinds[tile.terrain])}</h2>${options.map(kind=>`<button class="recipe" data-build="${kind}" ${canOrder()&&canPay(kind)&&!tile.structures.includes(kind)&&(kind==='settlement'||kind==='outpost'||kind==='bridge'||tile.structures.filter(k=>k!=='settlement').length<5)?'':'disabled'}><b>${safe(kind)}</b><small>${notes[kind]}</small><span>${costLabel(kind)}${tile.structures.includes(kind)?' · Built':''}</span></button>`).join('')}</div>${btn('Back to orders','closeBuild')}`;
}
function render(){
 const g=state?.game,phase=g?.phase,stage=g?.turnStage;
 const flow=phase+':'+g?.turn+':'+stage;
 if(flow!==lastFlow){buildOpen=false;roadMode=false;marchFrom=null;lastFlow=flow;}
 $('#entry').hidden=!!state;$('#lobby').hidden=!state||!!g;$('#control').hidden=!g;$('#turnBanner').hidden=!g;
 $('#hud').hidden=!hudOpen;$('#hudToggle').setAttribute('aria-expanded',String(hudOpen));
 const current=state?.players[g?.turn],tile=g?.tiles.find(t=>t.id===selected),own=tile?.owner===id,reserve=g?.reinforcements?.[id]||0;
 if(state&&!g){
  $('#lobby').innerHTML=`<h2>Your private realm</h2><strong class="room-code">${safe(state.code)}</strong><p>Share this code or copy the invite link.</p>${btn('Copy invite link','copy')}<div class="lobby-players">${state.players.map(p=>`<p>${safe(p.name)} ${p.bot?'· AI':''} ${p.id===state.host?'· Host':''}</p>`).join('')}</div>${state.host===id?btn('Add AI kingdom','bot',state.players.length<4)+btn('Begin draft','start',state.players.length>=2,'primary'):'<p>Waiting for the host.</p>'}`;
 }
 let controls='',guide='Drag to orbit · Scroll to zoom · Click a hex';
 if(phase==='draft'){
  const order=g.draftStage==='color'?g.draftOrder:[...g.draftOrder].reverse(),drafter=order[g.draftIndex],mine=drafter===id,name=state.players.find(p=>p.id===drafter)?.name;
  $('#turnBanner').innerHTML=`<b>${mine?'Your pick':safe(name)+' is drafting'}</b> · ${g.draftStage==='color'?'Choose a banner':'Choose your homeland'}`;
  controls=g.draftStage==='color'?`<h2>Choose your kingdom</h2><div class="color-draft">${['blue','red','green','yellow'].map(c=>`<button data-color="${c}" ${mine&&!state.players.some(p=>p.color===c)?'':'disabled'}><i class="${c}"></i>${c}</button>`).join('')}</div>`:`<h2>${mine?'Choose a glowing starting hex':'Waiting for a homeland pick'}</h2><details><summary>Starting locations</summary><div class="draft-options">${g.spawnChoices.map(x=>`<button data-spawn="${x}" ${mine?'':'disabled'}>${x}</button>`).join('')}</div></details>`;
  guide='3 starting troops · No opening-round reinforcements';
 }else if(g){
  const active=isActive(),orders=canOrder(),rolling=stage==='rolling';
  $('#turnBanner').innerHTML=`<b>${phase==='finished'?'Conquest complete':active?'Your turn':safe(current.name)+"’s turn"}</b> · Round ${g.round}${phase==='playing'?`<span class="steps"><em class="${stage==='roll'||rolling?'current':''}">1 Roll</em><em class="${stage==='deploy'?'current':''}">2 Reinforce</em><em class="${orders?'current':''}">3 Orders</em></span>`:''}`;
  if(phase==='finished')controls=`<h2>${safe(state.players.find(p=>p.id===g.winner)?.name)} united the frontier!</h2>`;
  else if(rolling){controls='<h2>Dice in motion…</h2><p>Watch the upward faces. Production follows when both dice settle.</p>';guide='Mountains rebound · Forests slow · Clay sticks · Water floats';}
  else if(active&&stage==='roll'){
   controls=`<h2>Roll on the frontier</h2><p>Grab either die, hold, drag and release over a hex.</p>${btn('Roll dice','physicalRoll',!dice.running,'primary')}`;
   guide='Dice react to the terrain beneath them';
  }else if(active&&stage==='deploy'){
   const legal=own&&(tile.army>0||tile.building)&&!['lake','river'].includes(tile.terrain);
   deployAmount=Math.min(Math.max(1,deployAmount),reserve);
   controls=`<h2>Place ${reserve} reinforcement${reserve===1?'':'s'}</h2><p>Select your occupied land or a structure. Place every troop to unlock orders.</p><details><summary>Income · ${g.income?.total||0} troops</summary><p>Resource pairs: ${g.income?.territory||0} · Structures: ${g.income?.structures||0} · Rolled production: ${g.income?.production||0}</p></details>${legal?`<b>${safe(kinds[tile.terrain])} · ${tile.army} soldiers</b><div class="quantity"><label for="deployAmount">Troops</label><input id="deployAmount" type="number" min="1" max="${reserve}" value="${deployAmount}"/>${btn('Place troops','deploy',true,'primary')}${btn('Place all','deployAll')}</div>`:'<p>Click a territory with your banner.</p>'}`;
   guide='Reinforcements first · Movement and building unlock afterwards';
  }else{
   controls=`<div class="context-heading"><b>${active?'Issue orders':'Observing the realm'}</b>${g.lastRoll?`<span>⚄ ${g.lastRoll.dice.join(' + ')} = ${g.lastRoll.sum}</span>`:''}</div>`;
   if(tile){
    controls+=`<div class="province"><b>${safe(kinds[tile.terrain])}</b>${btn('×','deselect',true,'close-selection')}<small>${tile.numberHidden?'Number hidden':`Roll ${tile.number??'—'}`} · ${tile.masked?'Unscouted':tile.army+' soldiers'}${tile.owner?' · '+safe(state.players.find(p=>p.id===tile.owner)?.name):''}</small></div>`;
    if(buildOpen&&orders&&(own||canBridge(tile)))controls+=buildPanel(tile);
    else if(orders){
     amount=Math.min(Math.max(1,amount),Math.max(1,(tile.army||0)-1));
     if(marchFrom)controls+=`<p>Select an adjacent hex to move or attack.</p>${btn('Cancel march','march')}`;
     else if(roadMode)controls+=`<p>Click a golden shared edge. Cost: ${costLabel('road')}</p>${btn('Cancel road','road')}`;
     else if(own)controls+=`<div class="actions">${btn('Build…','openBuild',true)}${btn('Road…','road',canPay('road'))}${btn('March / attack','march',tile.army>1&&g.mobilityUsed<(g.mobilityCap||2))}</div>${tile.army>1?`<div class="quantity"><label for="amount">Troops to march</label><input id="amount" type="number" min="1" max="${tile.army-1}" value="${amount}"/></div>`:''}`;
     else if(canBridge(tile))controls+=btn('Build bridge…','openBuild');
    }
   }else controls+='<p>Select a territory to inspect it and issue orders.</p>';
   if(active)controls+=`<div class="turn-end"><small>${((g.mobilityCap||2)-g.mobilityUsed).toFixed(1)} movement left${g.round===1?' · Opening round: no troop income':''}</small>${btn('End turn →','end',orders,'primary')}</div>`;
   guide=marchFrom?'Choose an adjacent destination':roadMode?'Click a glowing shared hex edge':'Select a territory · Build recipes open only on request';
  }
 }
 $('#control').innerHTML=controls;$('#mapGuide').textContent=guide;
 board.update(g?.tiles||preview(),{selected,roadMode:canOrder()&&roadMode,roads:g?.roads||{},players:state?.players||[],myId:id,spawnChoices:phase==='draft'&&g.draftStage==='spawn'?g.spawnChoices:[]});
 dice.setMode(isActive()&&stage==='roll'?'resource':'idle');
 if(g?.lastRoll)dice.play(g.lastRoll,g.serverNow);
 $('#players').innerHTML=state?.players.map(p=>`<div class="player"><i class="${p.color||''}"></i><b>${safe(p.name)}${p.id===id?' · You':''}</b><span>${g?.scores?.[p.id]??0} VP</span></div>`).join('')||'<p>Create a realm to begin.</p>';
 $('#resources').innerHTML=me()?.resources?Object.entries(icons).map(([key,icon])=>`<div class="resource"><span>${icon} ${key}</span><b>${me().resources[key]||0}</b></div>`).join(''):'<p>Available after drafting.</p>';
 $('#log').innerHTML=(g?.lastBattle?`<p>⚔ ${safe(g.lastBattle.attacker)} attacked ${safe(g.lastBattle.defender)} · ${safe(g.lastBattle.result)}</p>`:'')+(g?.log.map(line=>`<p>${safe(line)}</p>`).join('')||'');
}
$('#create').onclick=()=>command('room:create',{id,name:username()},r=>displayRoom(r.code));
$('#join').onclick=()=>joinRoom($('#codeInput').value);
$('#codeInput').onkeydown=e=>{if(e.key==='Enter')joinRoom(e.target.value);};
root.addEventListener('click',async e=>{
 const el=e.target.closest('[data-action],[data-color],[data-spawn],[data-build]');if(!el||el.disabled)return;
 if(el.dataset.color){command('draft:pick',{kind:'color',value:el.dataset.color});return;}
 if(el.dataset.spawn){command('draft:pick',{kind:'spawn',value:el.dataset.spawn});return;}
 if(el.dataset.build){act(el.dataset.build==='bridge'?{type:'bridge',tile:selected}:{type:'build',tile:selected,kind:el.dataset.build});return;}
 const action=el.dataset.action;
 if(action==='help'){const d=$('#rules');d.open?d.close():d.showModal();return;}
 if(action==='hud'){hudOpen=!hudOpen;render();return;}
 if(action==='copy'){try{await navigator.clipboard.writeText(location.href);toast('Invite link copied.');}catch{toast(location.href);}return;}
 if(action==='bot'||action==='start'){command('room:'+(action==='bot'?'addBot':'start'),{});return;}
 if(action==='physicalRoll'){dice.throw();return;}
 if(action==='reset'){board.reset();return;}
 if(action==='home'){const home=state?.game?.tiles.find(t=>t.owner===id);if(home)board.focus(home.id);return;}
 if(action==='openBuild'){buildOpen=true;marchFrom=null;roadMode=false;}
 if(action==='closeBuild')buildOpen=false;
 if(action==='deselect'){selected=null;buildOpen=false;roadMode=false;marchFrom=null;}
 if(action==='road'){roadMode=!roadMode;marchFrom=null;buildOpen=false;}
 if(action==='march'){marchFrom=marchFrom?null:selected;roadMode=false;buildOpen=false;}
 if(action==='deploy'||action==='deployAll'){act({type:'deploy',tile:selected,count:action==='deployAll'?state.game.reinforcements[id]:deployAmount});return;}
 if(action==='end'){act({type:'end'});return;}
 render();
});
root.addEventListener('input',e=>{
 if(e.target.id==='amount')amount=Math.max(1,Math.floor(Number(e.target.value)||1));
 if(e.target.id==='deployAmount')deployAmount=Math.max(1,Math.floor(Number(e.target.value)||1));
});
socket.on('connect',()=>{
 $('#online').textContent='● Connected';
 if(code)socket.emit('room:join',{code,id,name:localStorage.getItem('riskagon:name')||'Commander'},r=>{if(!r?.ok){toast(r?.error||'Could not join room.',true);code='';history.replaceState(null,'',location.pathname);}});
});
socket.on('disconnect',()=>{$('#online').textContent='Reconnecting…';dice.cancel();});
socket.on('state',next=>{state=next;if(code!==state.code)displayRoom(state.code);render();});
render();
