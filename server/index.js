import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomBytes} from 'node:crypto';
import {createGame,applyAction,publicRoom,RESOURCES,COSTS,getTile,neighbors} from './game.js';
const app=express();
const server=createServer(app);
const io=new Server(server,{maxHttpBufferSize:50_000});
const rooms=new Map();
const send=(room)=>io.to(room.code).emit('state',publicRoom(room));
const clean=s=>typeof s==='string'?s.trim().replace(/[<>]/g,'').slice(0,24):'';
const newCode=()=>{
  let code;
  do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
  return code;
};
const seat=(room,id)=>room.players.find(p=>p.id===id);
const perform=(room,id,action)=>{
  applyAction(room,id,action);
  send(room);
  maybeBot(room);
};
function maybeBot(room){
  const g=room.game;
  if(!g||g.phase!=='playing'||!room.players[g.turn].bot||room.botPending) return;
  room.botPending=true;
  setTimeout(()=>{
    room.botPending=false;
    if(!room.game||room.game.phase!=='playing')return;
    const bot=room.players[room.game.turn];
    if(!bot?.bot)return;
    try{
      perform(room,bot.id,{type:'roll'});
      const home=room.game.tiles.find(t=>t.owner===bot.id&&t.building);
      if(home&&bot.resources.ore>=1&&bot.resources.sheep>=1)perform(room,bot.id,{type:'recruit',tile:home.id});
      const advance=room.game.tiles
        .filter(t=>t.owner===bot.id&&t.army>1)
        .flatMap(t=>room.game.tiles.filter(u=>neighbors(t,u)&&u.owner!==bot.id)
          .map(u=>({t,u})))
        .sort((a,b)=>(a.u.owner?1:0)-(b.u.owner?1:0))[0];
      if(advance)perform(room,bot.id,{type:'march',from:advance.t.id,to:advance.u.id,amount:Math.max(1,advance.t.army-1)});
      if(room.game.phase==='playing')perform(room,bot.id,{type:'end'});
    }catch(e){
      try{if(room.game.phase==='playing'&&room.game.rolled)perform(room,bot.id,{type:'end'});}catch{}
    }
  },850);
}
app.get('/api/health',(_req,res)=>res.json({ok:true,rooms:rooms.size,app:'riskagon'}));
io.on('connection',socket=>{
  socket.on('room:create',({id,name}={},ack=()=>{})=>{
    id=clean(id);name=clean(name)||'Explorer';
    if(id.length<8)return ack({ok:false,error:'Invalid session ID.'});
    const code=newCode();
    const room={code,host:id,players:[{id,name,color:'blue',resources:{},connected:true,bot:false}],game:null,botPending:false};
    rooms.set(code,room);
    socket.join(code);socket.data={code,id};
    ack({ok:true,code});send(room);
  });
  socket.on('room:join',({code,id,name}={},ack=()=>{})=>{
    code=clean(code).toUpperCase();id=clean(id);name=clean(name)||'Explorer';
    const room=rooms.get(code);
    if(!room)return ack({ok:false,error:'Room not found. Ask the host for a new link.'});
    if(id.length<8)return ack({ok:false,error:'Invalid session ID.'});
    let player=seat(room,id);
    if(!player){
      if(room.game)return ack({ok:false,error:'This game has already started.'});
      if(room.players.length>=4)return ack({ok:false,error:'The room is full (4 players).'});
      player={id,name,color:['blue','red','green','yellow'][room.players.length],resources:{},connected:true,bot:false};
      room.players.push(player);
    }else{player.connected=true;}
    socket.join(code);socket.data={code,id};
    ack({ok:true,code});send(room);maybeBot(room);
  });
  socket.on('room:addBot',(_args={},ack=()=>{})=>{
    const room=rooms.get(socket.data?.code);
    if(!room||room.host!==socket.data.id)return ack({ok:false,error:'Host only.'});
    if(room.game||room.players.length>=4)return ack({ok:false,error:'Game started or room full.'});
    const id='bot-'+randomBytes(6).toString('hex');
    room.players.push({id,name:'Kingdom AI '+room.players.length,color:['blue','red','green','yellow'][room.players.length],resources:{},connected:true,bot:true});
    ack({ok:true});send(room);
  });
  socket.on('room:start',(_args={},ack=()=>{})=>{
    const room=rooms.get(socket.data?.code);
    if(!room||room.host!==socket.data.id)return ack({ok:false,error:'Only the host can start.'});
    if(room.game||room.players.length<2)return ack({ok:false,error:'Need at least two kingdoms.'});
    room.game=createGame(room.players);
    ack({ok:true});send(room);maybeBot(room);
  });
  socket.on('game:action',(action={},ack=()=>{})=>{
    const room=rooms.get(socket.data?.code);
    if(!room||!seat(room,socket.data?.id))return ack({ok:false,error:'Join a room first.'});
    try{perform(room,socket.data.id,action);ack({ok:true});}
    catch(e){ack({ok:false,error:String(e.message||e)});}
  });
  socket.on('disconnect',()=>{
    const room=rooms.get(socket.data?.code);
    if(!room)return;
    const p=seat(room,socket.data?.id);
    if(p)p.connected=false;
    if(!room.game && room.host===socket.data?.id){
      const next=room.players.find(x=>x.connected&&!x.bot);
      if(next)room.host=next.id;
    }
    send(room);
  });
});
if(process.env.NODE_ENV==='production'){
  const path=await import('node:path');
  app.use(express.static(path.resolve('dist')));
  app.get('*',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
}else{
  const {createServer:createVite}=await import('vite');
  const vite=await createVite({server:{middlewareMode:true},appType:'spa'});
  app.use(vite.middlewares);
}
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log('RISKAGON online at http://localhost:'+port));
