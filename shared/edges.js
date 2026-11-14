export const vertexId=(x,z)=>`${x}:${z}`;
export const edgeKey=(a,b)=>[a,b].sort().join('~');
export function hexEdges(tile){
 const corners=[[0,2],[1,1],[1,-1],[0,-2],[-1,-1],[-1,1]].map(([x,z])=>vertexId(2*tile.q+tile.r+x,3*tile.r+z));
 return corners.map((a,i)=>({a,b:corners[(i+1)%6],key:edgeKey(a,corners[(i+1)%6])}));
}
export const vertexPosition=id=>{const [x,z]=id.split(':').map(Number);return {x:x*Math.sqrt(3)/2,z:z/2};};
export function borderBetween(a,b){return hexEdges(a).find(e=>hexEdges(b).some(f=>f.key===e.key))?.key;}
