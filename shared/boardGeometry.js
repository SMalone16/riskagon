// One coordinate system for the rendered board and its authoritative colliders.
export const DIE_SIZE = 1.04;
export const TILE_TOP = .16;
export const hexPosition = ({q,r}) => ({x:Math.sqrt(3)*(q+r/2),z:1.5*r});
export const DIRECTIONS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export const TERRAIN_PHYSICS = {
 fields:{friction:.28,restitution:.28,drag:0},
 pasture:{friction:.4,restitution:.2,drag:.15},
 forest:{friction:.88,restitution:.08,drag:2.8},
 hills:{friction:1,restitution:0,drag:6},
 mountains:{friction:.22,restitution:.78,drag:0},
 lake:{friction:.1,restitution:.05,drag:2,water:true},
 river:{friction:.1,restitution:.05,drag:2,water:true},
 desert:{friction:.5,restitution:.15,drag:.2}
};
export function tileUnder(tiles,x,z){
 return tiles.find(t=>{
  const p=hexPosition(t),dx=Math.abs(x-p.x),dz=Math.abs(z-p.z);
  return dx<=Math.sqrt(3)/2+.001 && dz+dx/Math.sqrt(3)<=1.001;
 });
}
// Rows and columns are spaced farther apart than a hex half-extent.
// Check both surrounding coordinates to preserve tileUnder's edge tolerance and input-order ties.
export function indexTileSurfaces(tiles){
 const rows=new Map();
 tiles.forEach((tile,index)=>{
  if(!rows.has(tile.r))rows.set(tile.r,new Map());
  rows.get(tile.r).set(tile.q,{tile,index,...hexPosition(tile)});
 });
 return (x,z)=>{
  let first;
  const row=Math.floor(z/1.5);
  for(let r=row;r<=row+1;r++){
   const columns=rows.get(r);
   if(!columns)continue;
   const column=Math.floor(x/Math.sqrt(3)-r/2);
   for(let q=column;q<=column+1;q++){
    const entry=columns.get(q);
    if(!entry)continue;
    const dx=Math.abs(x-entry.x),dz=Math.abs(z-entry.z);
    if(dx<=Math.sqrt(3)/2+.001 && dz+dx/Math.sqrt(3)<=1.001 && (!first||entry.index<first.index))first=entry;
   }
  }
  return first?.tile;
 };
}
export function boundaryEdges(tiles){
 const ids=new Set(tiles.map(t=>`${t.q},${t.r}`));
 return tiles.flatMap(t=>DIRECTIONS.flatMap(([q,r])=>{
  if(ids.has(`${t.q+q},${t.r+r}`))return [];
  const p=hexPosition(t),d=hexPosition({q,r});
  return [{x:p.x+d.x/2,z:p.z+d.z/2,angle:Math.atan2(-d.z,d.x)+Math.PI/2}];
 }));
}
// Small, permanent rocks remain visible even when mountain scenery condenses.
export const mountainRocks = tile => {
 const p=hexPosition(tile);
 return [{x:p.x-.27,z:p.z-.16,radius:.34,height:.95},{x:p.x+.29,z:p.z+.21,radius:.26,height:.65}];
};
