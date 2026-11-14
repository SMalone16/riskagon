export function cohorts(g,t,kind){g.movement??={};const key=t.id+':'+kind;
 if(!g.movement[key])g.movement[key]=[{n:t[kind]||0,left:2}];
 const list=g.movement[key],delta=(t[kind]||0)-list.reduce((n,c)=>n+c.n,0);
 if(delta>0)list.push({n:delta,left:2});
 if(delta<0){let loss=-delta;for(const c of list){const n=Math.min(loss,c.n);c.n-=n;loss-=n;}}
 return list;}
export const ready=(g,t,kind,cost)=>cohorts(g,t,kind).filter(c=>c.left>=cost).reduce((n,c)=>n+c.n,0);
export function prepareMovement(g,a){
 if(!['march','sail','land','embark','bombard'].includes(a.type))return ()=>{};
 const from=g.tiles.find(t=>t.id===a.from),to=g.tiles.find(t=>t.id===a.to);if(!from||!to)return ()=>{};
 const kind=['sail','land','bombard'].includes(a.type)?'navy':'army',targetKind=['land','march'].includes(a.type)?'army':'navy';
 const cost=a.type==='march'?(a.road ? .5 : 1):a.type==='bombard'?1:.5;
 const count=a.type==='bombard'?from.navy:a.amount;
 if(!Number.isSafeInteger(count)||count<1)return ()=>{};
 const source=cohorts(g,from,kind),target=cohorts(g,to,targetKind),oldFrom=from[kind],oldTo=to[targetKind]||0,oldOwner=to.owner;
 if(ready(g,from,kind,cost)<count)throw Error('These troops have used their two movement points.');
 const moved=[],left=source.map(c=>({...c}));let remaining=count;
 for(const c of left)if(c.left>=cost&&remaining){const n=Math.min(c.n,remaining);c.n-=n;remaining-=n;moved.push({n,left:c.left-cost});}
 return ()=>{
  const conquered=to.owner!==oldOwner,arrival=conquered?(to[targetKind]||0):Math.max(0,(to[targetKind]||0)-oldTo),returned=Math.max(0,from[kind]-(oldFrom-count));
  const take=(n)=>{const out=[];for(const c of moved){const used=Math.min(n,c.n);if(used)out.push({n:used,left:c.left});n-=used;}return out;};
  g.movement[from.id+':'+kind]=[...left.filter(c=>c.n),...take(returned)];
  g.movement[to.id+':'+targetKind]=[...(conquered?[]:target),...take(arrival)];
 };
}
