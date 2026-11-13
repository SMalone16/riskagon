
import './style.css';
import {io} from 'socket.io-client';
import {Board} from './board.js';
import {DiceTray} from './dice.js';
const socket=io();
const root=document.getElementById('app');
const id=sessionStorage.getItem('riskagon:id')||crypto.randomUUID().slice(0,22);
sessionStorage.setItem('riskagon:id',id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const kinds={forest:'Forest',fields:'Wheat Fields',pasture:'Pasture',hills:'Clay Hills',mountains:'Iron Mountains',desert:'Desert',river:'River Crossing',lake:'Lake'};
const icons={wood:'🌲',brick:'🧱',wheat:'🌾',sheep:'🐑',ore:'⛏️'};
let code=new URLSearchParams(location.search).get('room')?.toUpperCase()||'';
let state=null,selected=null,roadMode=false,marchFrom=null,amount=2,buildOpen=false,lastBattleKey='',lastRollSeen='';
root.innerHTML=`
<header><div class="logo"><span class="seal">R</span><div><b>RISKAGON</b><small>THE FRONTIER AWAITS</small></div></div><span class="header-caption">HEXAGONAL STRATEGY · MULTIPLAYER</span><div class="header-actions"><span id="online">CONNECTING</span><button id="helpBtn">? RULES</button></div></header>
<main class="layout">
<aside class="left"><div class="eyebrow">THE CONQUEST BEGINS</div><h1>Shape your<br><em>kingdom.</em></h1><p class="sub">Harvest the land. Build your roads. March your armies. Claim the frontier.</p>
<section id="welcome"><div class="eyebrow">YOUR KINGDOM</div><label>Commander name</label><input id="name" maxlength="24" placeholder="Commander" value="Commander"/><button class="primary full" id="create">✦ Create new realm</button><div class="separate">OR JOIN FRIENDS</div><div class="inline"><input id="codeInput" maxlength="6" placeholder="ROOM CODE"/><button id="join">JOIN</button></div><p class="hint">Invite up to 3 friends, or challenge an AI kingdom.</p></section>
<section id="lobby" hidden></section><section id="control" hidden></section>
<div class="footnote">✦ BUILT FOR THE FRONTIER · EARLY ACCESS</div></aside>
<div class="center"><div class="maphead"><div><div class="eyebrow">THE KNOWN WORLD</div><h2 id="mapTitle">A land worth fighting for.</h2></div><div class="round"><span id="round">91 TERRITORIES</span><small id="turn">ROLL · BUILD · CONQUER</small></div></div>
<div class="map"><div id="board"></div><div class="dice-hud" id="diceHUD"><div class="dice-caption"><span>⚄ PHYSICAL DICE</span><small id="diceHint">WAITING FOR YOUR TURN</small></div><div class="dice-stage" id="diceStage"></div><button id="diceFallback" data-action="physicalRoll" disabled>ROLL THE DICE</button><div class="dice-note" id="diceNote">Drag, release &amp; watch them tumble</div></div><div class="watermark">✦ THE FRONTIER</div><div class="compass">N<br>↑</div><div id="mapGuide">DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A HEX</div></div><div class="mapfooter" id="mapFooter">✦ Select any hexagon to inspect its resources.</div></div>
<aside class="right"><section><div class="eyebrow">KINGDOMS OF THE REALM</div><div id="players" class="list"></div></section><section><div class="eyebrow">YOUR TREASURY</div><div id="resources" class="list"></div></section><section><div class="eyebrow">CHRONICLES OF WAR</div><div id="log" class="list"></div></section></aside>
</main><div id="toast" role="status"></div>
<div id="rules" class="rules" hidden><div class="rules-content"><button id="closeRules" class="close">×</button><div class="eyebrow">FIELD MANUAL</div><h2>How to conquer.</h2>
<p>Be the first kingdom to reach <b>32 points.</b> Territories, outposts and upgrades score points. Draft colors and starting hexes before the first turn.</p>
<p><b>1. Physically roll:</b> Drag the 3D dice into the walled rolling tray. Matching numbered provinces produce resources. Numbers are visible within 5 hexes of your scouts.</p><p><b>2. Build:</b> Select your territory to zoom in, then choose houses, walls, industries, barracks, stables, and armories. Click Build Road to highlight eligible shared hex edges in gold. Bridges unlock river hex crossings.</p>
<p><b>3. Deploy:</b> From round two, each kingdom gets two free troops per turn to assign at its outposts. A barracks produces troops when its tile number is rolled. <b>4. March:</b> Move between adjacent hexes, always leaving one garrison.</p>
<p><b>5. Battle:</b> Risk-style dice resolve attacks; defenders win ties. Roads boost attacks and reduce movement cost. Walls improve defense; armories store attack boosts.</p>
<button class="primary full" id="doneRules">RETURN TO GAME</button></div></div>`;
$('#name').value=localStorage.getItem('riskagon:name')||'Commander';
function toast(message,error=false){const t=$('#toast');t.textContent=message;t.className=error?'show error':'show';setTimeout(()=>t.className='',3500);}
const preview=()=>{
 const resources=['forest','pasture','fields','hills','mountains','fields','forest','hills','pasture','desert','mountains','fields','forest','pasture','hills','fields','forest','pasture','mountains'];
 let i=0,tiles=[];for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(Math.abs(q+r)<=2)tiles.push({q,r,id:q+','+r,terrain:resources[i++],number:i===10?null:[3,5,9,4,6,10,11,8,2,0,12,5,6,3,9,10,4,8,11][i-1],owner:null,army:0,building:0});
 return tiles;
};
function me(){return state?.players.find(p=>p.id===id);}
function isActive(){return state?.game?.phase==='playing'&&state.players[state.game.turn]?.id===id;}
function canAct(){return isActive()&&state.game.rolled;}
function act(data){socket.emit('game:action',data,response=>{if(!response?.ok)toast(response?.error||'Action failed',true);});}
function command(event,data,onSuccess){
 socket.emit(event,data,response=>{
  if(!response?.ok){toast(response?.error||'Request failed',true);return;}
  onSuccess?.(response);
 });
}
function displayRoom(codeValue){code=codeValue;history.replaceState(null,'','?room='+code);}
function username(){const name=$('#name').value.trim().slice(0,24)||'Commander';localStorage.setItem('riskagon:name',name);return name;}
function joinRoom(value){command('room:join',{code:value.trim().toUpperCase(),id,name:username()},r=>{displayRoom(r.code);toast('Joined realm '+r.code);});}

const board=new Board($('#board'),tile=>{
 const g=state?.game;if(!g||g.phase==='finished')return;
 if(g.phase==='draft'){
  if(g.draftStage==='spawn'&&g.spawnChoices.includes(tile)){
   command('draft:pick',{kind:'spawn',value:tile},()=>toast('Your starting location is secured.'));
  }return;
 }
 if(marchFrom){
  if(tile===marchFrom){marchFrom=null;render();return;}
  const source=g.tiles.find(t=>t.id===marchFrom);
  if(!source)return;
  act({type:'march',from:marchFrom,to:tile,amount:Math.min(Math.max(1,amount),source.army-1)});
  marchFrom=null;selected=tile;buildOpen=false;render();return;
 }
 selected=tile;roadMode=false;
 const owner=g.tiles.find(t=>t.id===tile)?.owner;
 buildOpen=owner===id;
 if(buildOpen)board.focus(tile);else board.reset();
 render();
},edge=>{if(roadMode)act({type:'road',edge});});
board.update(preview(),{});
const dice=new DiceTray($('#diceStage'),()=>new Promise((resolve,reject)=>{
 if(!isActive()||state.game.rolled){reject(Error('Wait for your turn.'));return;}
 socket.emit('game:action',{type:'roll'},response=>{
  if(!response?.ok){toast(response?.error||'Roll failed',true);reject(Error(response?.error));return;}
  resolve(response.roll);
 });
}));
const costs={
 road:{wood:1,brick:1},bridge:{wood:2,brick:1,ore:1},outpost:{wood:1,brick:1},
 homes:{wood:2,brick:1,wheat:1},walls:{brick:2,ore:1},armory:{ore:2,brick:1},
 farm:{wood:2,wheat:1},lumberyard:{wood:1,brick:1},quarry:{wood:1,brick:2},
 mine:{wood:2,ore:1},ranch:{wood:1,sheep:2},barracks:{wood:2,brick:2,ore:1},
 stables:{wood:2,wheat:2,sheep:1}
};
const structureNotes={
 outpost:'Enables building and troop deployment',homes:'+1 native resource when rolled',
 walls:'Stores defense charges on matching rolls',armory:'Stores attack bonuses when rolled',
 farm:'+2 wheat on a matching roll',lumberyard:'+2 wood on a matching roll',
 quarry:'+2 brick on a matching roll',mine:'+2 ore on a matching roll',ranch:'+2 sheep on a matching roll',
 barracks:'+2 troops on a matching roll',stables:'Stores a mobility point when rolled',
 bridge:'Cross this river with armies'
};
const industry={forest:'lumberyard',fields:'farm',hills:'quarry',mountains:'mine',pasture:'ranch'};
const costLabel=k=>Object.entries(costs[k]||{}).map(([r,n])=>n+' '+icons[r]).join(' · ');
function buildPanel(tile){
 if(!tile||tile.owner!==id)return '';
 const options=tile.terrain==='river'?['bridge']:(tile.building?['homes','walls','armory',industry[tile.terrain],'barracks','stables'].filter(Boolean):['outpost']);
 return `<div class="builder"><div class="eyebrow">BUILD IN ${safe(kinds[tile.terrain]).toUpperCase()}</div><div class="builder-caption">Select a structure. Upgrades activate when this province's dice number is rolled.</div>
 ${options.map(kind=>`<button class="build-option" data-build="${kind}" ${canAct()&&canPay(kind)&&!tile.structures?.includes(kind)?'':'disabled'}><strong>${safe(kind[0].toUpperCase()+kind.slice(1))}</strong><small>${safe(structureNotes[kind])}</small><span>${costLabel(kind)} ${tile.structures?.includes(kind)?' · BUILT':''}</span></button>`).join('')}
 ${btn('← Close settlement view','closeBuild',true,'secondary full')}</div>`;
}
function canPay(type){return Object.entries(costs[type]||{}).every(([key,n])=>(me()?.resources?.[key]||0)>=n);}
function btn(text,action,enabled=true,cls=''){return `<button data-action="${action}" class="${cls}" ${enabled?'':'disabled'}>${text}</button>`;}

function render(){
 const g=state?.game,phase=g?.phase;
 $('#welcome').hidden=!!state;
 $('#lobby').hidden=!state||!!g;
 $('#control').hidden=!g;
 $('#round').textContent=g?'ROUND '+g.round+' · '+g.tiles.length+' HEXES':'91 TERRITORIES';
 $('#mapTitle').textContent=phase==='draft'?'Choose your banner and homeland.':phase==='finished'?'A kingdom has risen.':g?'The war for the frontier.':state?'Gather your kingdoms.':'A land worth fighting for.';
 $('#turn').textContent=phase==='draft'?'KINGDOM DRAFT IN PROGRESS':phase==='finished'?'CONQUEST COMPLETE':g?(isActive()?'YOUR TURN':'WAITING FOR '+state.players[g.turn].name.toUpperCase()):'ROLL · BUILD · CONQUER';
 $('#diceFallback').disabled=!(g&&isActive()&&!g.rolled&&!dice.running);
 $('#diceHint').textContent=phase==='playing'?(isActive()&&!g.rolled?'YOUR TURN · DRAG TO THROW':g.rolled?'DICE RESOLVED':'AWAITING NEXT TURN'):'THE DICE WILL AWAIT YOUR KINGDOM';
 $('#diceNote').textContent=g?.lastRoll?'⚄ '+g.lastRoll.dice.join(' + ')+' = '+g.lastRoll.sum:'Drag either die and release over the tray';
 if(!dice.running)dice.setMode(isActive()&&!g?.rolled?'resource':'idle');
 if(state&&!g){
  $('#lobby').innerHTML=`<div class="eyebrow">YOUR PRIVATE REALM</div><div class="room-code">${safe(state.code)}</div><p class="hint">Share this code with your friends.</p>${btn('↗ Copy invite link','copy',true,'secondary full')}<div class="eyebrow spaced">COMMANDERS · ${state.players.length}/4</div>${state.players.map(p=>`<div class="lobby-player"><i class="color ${p.color||''}"></i>${safe(p.name)} ${p.bot?'[AI]':''} ${p.id===state.host?'[HOST]':''}</div>`).join('')}${state.host===id?btn('+ Add AI kingdom','bot',state.players.length<4,'secondary full')+btn('⚔ Begin color draft','start',state.players.length>=2,'primary full'):'<p class="hint">Waiting for the host to begin.</p>'}`;
 }
 const tile=g?.tiles.find(t=>t.id===selected);
 if(phase==='draft'){
  const order=g.draftStage==='color'?g.draftOrder:[...g.draftOrder].reverse();
  const drafter=order[g.draftIndex],isMine=drafter===id,playerName=state.players.find(p=>p.id===drafter)?.name||'Commander';
  $('#turn').textContent=isMine?'YOU ARE DRAFTING':'WAITING FOR '+playerName.toUpperCase();
  $('#control').innerHTML=`<div class="eyebrow">DRAFT · ${g.draftStage==='color'?'ROUND 1: BANNER':'ROUND 2: HOMELAND'}</div><div class="current-player"><span>♛</span><div><small>CURRENT PICK</small><b>${safe(playerName)}</b></div></div>
  ${g.draftStage==='color'? `<p class="hint">Pick a unique kingdom color. The reverse-order starting-location draft follows.</p><div class="color-draft">${['blue','red','green','yellow'].map(c=>`<button data-color="${c}" ${isMine&&!state.players.some(p=>p.color===c)?'':'disabled'}><i class="color ${c}"></i>${c.toUpperCase()}</button>`).join('')}</div>`:
  `<p class="hint">Click one of the <strong>glowing golden starting hexes</strong> on the board. The last color chooser gets the first homeland pick.</p><div class="draft-options">${g.spawnChoices.map(x=>`<button data-spawn="${x}" ${isMine?'':'disabled'}>✦ ${x}</button>`).join('')}</div>`}
  <div class="hint">Each kingdom starts with only 3 troops and no free first-round reinforcements.</div>`;
  $('#mapGuide').textContent=g.draftStage==='spawn'?'CLICK A GOLDEN STARTING HEX':'DRAFT COLORS FIRST · THEN STARTING LOCATIONS';
  board.update(g.tiles,{players:state.players,myId:id,spawnChoices:g.draftStage==='spawn'?g.spawnChoices:[]});
  $('#mapFooter').textContent='✦ All terrain is public. Territory ownership and hidden units depend on scouting.';
 }else if(g){
  const own=tile?.owner===id,max=own?Math.max(1,tile.army-1):1;amount=Math.min(amount,max);
  const winner=state.players.find(p=>p.id===g.winner);
  const canMove=canAct()&&own&&tile.army>1&&g.mobilityUsed<(g.mobilityCap||2);
  const reserve=g.reinforcements?.[id]||0;
  $('#control').innerHTML=`<div class="eyebrow">ROUND ${g.round} · COMMANDER ${g.turn+1}</div><div class="current-player"><span>♜</span><div><small>CURRENT TURN</small><b>${safe(state.players[g.turn].name)}</b></div></div>
  ${phase==='finished'?'<div class="victory">✦ '+safe(winner?.name)+' has united the frontier!</div>':`
  <div class="dice-prompt">${isActive()&&!g.rolled?'⚄ Drag and throw the dice on the board to begin your turn.':g.lastRoll?'⚄ RESOURCE ROLL: '+g.lastRoll.dice.join(' + ')+' = '+g.lastRoll.sum:'⚄ Waiting for the next dice roll.'}</div>
  <div class="mobility">MOBILITY LEFT <b>${((g.mobilityCap||2)-g.mobilityUsed).toFixed(1)} / ${g.mobilityCap||2}</b></div>
  <div class="mobility">TROOPS TO DEPLOY <b>${reserve} remaining</b></div>
  <div class="eyebrow spaced">SELECTED PROVINCE</div>
  <div class="selected">${tile?`<b>${safe(kinds[tile.terrain])}</b><p>${tile.numberHidden?'Dice number hidden · scout within 5 hexes':'Dice: '+(tile.number??'—')}<br>${tile.owner?state.players.find(p=>p.id===tile.owner)?.name:'Unclaimed or hidden'} · ${tile.masked?'Forces unknown':tile.army+' soldiers'}<br>${tile.structures?.length?'Structures: '+safe(tile.structures.join(', ')):'No structures'}</p>`:'<p>Click a hexagon to inspect it. Your territories have gold borders.</p>'}</div>
  ${own&&buildOpen?buildPanel(tile):`<div class="eyebrow spaced">BUILD & EXPAND</div>${btn('⌂ Zoom into selected settlement','openBuild',own,'secondary full')}`}
  <div class="eyebrow spaced">ROAD NETWORK</div>
  ${btn(roadMode?'✕ Exit road construction':'══ BUILD ROAD · '+costLabel('road'),'road',canAct()&&canPay('road'),roadMode?'secondary full chosen':'secondary full')}
  <p class="hint">${roadMode?'Golden markers show every legal shared edge. Click one to place a road.':'Roads belong on the hex sides. Roads you own reveal land two hexes away.'}</p>
  <div class="eyebrow spaced">ARMY ORDERS</div>
  <div class="march-controls"><label for="amount">Troops to march</label><input id="amount" type="number" min="1" max="${max}" value="${amount}"/></div>
  ${btn(marchFrom?'✕ Cancel march':'⚔ March / Attack','march',canMove,'secondary full')}
  ${btn('♟ Deploy '+Math.max(1,reserve)+' troops here','deploy',canAct()&&own&&tile.building&&reserve>0,'secondary full')}
  <p class="hint">${marchFrom?'Choose an adjacent hex. River crossings require a bridge.':'2 reinforcements per turn from round 2; deploy at an outpost.'}</p>
  ${btn('End turn →','end',isActive()&&g.rolled,'endturn full')}
  `}`;
  board.update(g.tiles,{selected,roadMode,roads:g.roads,players:state.players,myId:id});
  $('#mapFooter').textContent=tile?safe(kinds[tile.terrain])+' · '+(tile.masked?'ENEMY FORCES HIDDEN':tile.army+' troops')+' · '+(tile.owner?state.players.find(p=>p.id===tile.owner)?.name:'Unclaimed or fogged'):'✦ Gold borders mark your territories. Select an outpost to build.';
  $('#mapGuide').textContent=roadMode?'CLICK A GLOWING SHARED EDGE TO PLACE A ROAD':marchFrom?'CLICK AN ADJACENT HEX TO MARCH':'DRAG MAP TO ORBIT · DRAG DICE TO THROW · CLICK A HEX TO BUILD';
 }else{
  board.update(preview(),{});
  $('#mapFooter').textContent='✦ A world of 91 hexagons awaits.';
  $('#mapGuide').textContent='DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A HEX';
 }
 $('#players').innerHTML=state?.players.map(p=>{
  const owned=g?.tiles.filter(t=>t.owner===p.id)||[];
  const vp=g?.scores?.[p.id]??owned.reduce((n,t)=>n+1+(t.building?1:0)+(t.structures?.filter(x=>x!=='outpost').length||0),0);
  return `<div class="player ${p.id===id?'self':''}"><span class="avatar ${p.color||''}">${safe(p.name[0])}</span><div><b>${safe(p.name)} ${p.id===id?'· YOU':''}</b><small>${g?g.phase==='draft'?'Drafting kingdom':owned.length+' visible territories':p.bot?'AI Kingdom':'Ready to play'}</small></div><strong>${g?.phase==='playing'||g?.phase==='finished'?vp+' VP':'—'}</strong></div>`;
 }).join('')||'<p class="hint">Your rival kingdoms will appear here.</p>';
 $('#resources').innerHTML=g&&me()?.resources?Object.entries(icons).map(([k,ico])=>`<div class="resource"><span>${ico}</span><label>${k[0].toUpperCase()+k.slice(1)}</label><b>${me().resources[k]||0}</b></div>`).join(''):'<p class="hint">Treasury opens after the homeland draft.</p>';
 $('#log').innerHTML=g?.log.slice(0,8).map(line=>`<div class="log"><span>✦</span>${safe(line)}</div>`).join('')||'<p class="hint">The chronicles await their first story.</p>';
}
$('#create').onclick=()=>command('room:create',{id,name:username()},r=>{displayRoom(r.code);toast('Realm created. Invite your friends!');});
$('#join').onclick=()=>joinRoom($('#codeInput').value);
$('#codeInput').onkeydown=e=>{if(e.key==='Enter')joinRoom(e.target.value);};
root.addEventListener('click',async e=>{
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(!action)return;
 if(action==='copy'){try{await navigator.clipboard.writeText(location.href);toast('Invitation copied!');}catch{toast(location.href);}return;}
 if(action==='bot'||action==='start'){command('room:'+(action==='bot'?'addBot':'start'),{},()=>toast(action==='bot'?'AI kingdom joined.':'Conquest begins!'));return;}
 if(action==='road'){roadMode=!roadMode;marchFrom=null;render();return;}
 if(action==='march'){marchFrom=marchFrom?null:selected;roadMode=false;render();return;}
 if(action==='end'||action==='roll'){act({type:action});return;}
 if(['settlement','fort','recruit'].includes(action)){act({type:action,tile:selected});}
});
root.addEventListener('change',e=>{if(e.target.id==='amount')amount=Math.max(1,Math.floor(Number(e.target.value)||1));});
const toggleHelp=()=>{$('#rules').hidden=!$('#rules').hidden;};
$('#helpBtn').onclick=toggleHelp;$('#closeRules').onclick=toggleHelp;$('#doneRules').onclick=toggleHelp;
socket.on('connect',()=>{
 $('#online').textContent='● CONNECTED';$('#online').className='connected';
 if(code)socket.emit('room:join',{code,id,name:localStorage.getItem('riskagon:name')||'Commander'},r=>{
  if(!r?.ok){toast(r?.error||'Could not join room.',true);code='';history.replaceState(null,'',location.pathname);}
 });
});
socket.on('disconnect',()=>{$('#online').textContent='● RECONNECTING';$('#online').className='';});
socket.on('state',next=>{state=next;if(code!==state.code)displayRoom(state.code);render();});
render();
