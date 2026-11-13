// Download a curated, legally reusable subset of KayKit's CC0 glTF collection.
// Run npm run assets:sync from a Codespace or local Node 20+ environment.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root='https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/main/';
const prefix='addons/kaykit_medieval_hexagon_pack/Assets/gltf/';
const target=path.resolve('public/assets/kaykit');
const objects=[
  ...['blue','red','green','yellow'].flatMap(color=>['home_A','castle','tower_A','barracks'].map(name=>'buildings/'+color+'/building_'+name+'_'+color)),
  ...['trees_A_small','trees_B_small','tree_single_A','rock_single_A','hills_A','mountain_A_grass'].map(name=>'decoration/nature/'+name)
];
const loaded=new Set();
async function download(rel){
  if(loaded.has(rel))return;
  loaded.add(rel);
  const response=await fetch(root+prefix+rel);
  if(!response.ok)throw Error('Failed '+response.status+': '+rel);
  const bytes=Buffer.from(await response.arrayBuffer());
  const local=path.join(target,rel);
  await mkdir(path.dirname(local),{recursive:true});
  await writeFile(local,bytes);
  if(rel.endsWith('.gltf')){
    const json=JSON.parse(bytes.toString('utf8'));
    const extras=[...(json.buffers||[]).map(b=>b.uri),...(json.images||[]).map(i=>i.uri)];
    for(const ref of extras){
      if(ref && !ref.startsWith('data:'))await download(path.posix.join(path.posix.dirname(rel),ref));
    }
  }
}
for(let i=0;i<objects.length;i+=4){
  await Promise.all(objects.slice(i,i+4).map(x=>download(x+'.gltf')));
  process.stdout.write('.');
}
const license=await fetch(root+'LICENSE.txt');
if(!license.ok)throw Error('Could not retrieve CC0 license.');
await writeFile(path.join(target,'LICENSE-KAYKIT.txt'),await license.text());
await writeFile(path.join(target,'manifest.json'),JSON.stringify({source:root,license:'CC0-1.0',models:objects,generated:new Date().toISOString()},null,2));
console.log('\n'+objects.length+' KayKit models synchronized. Restart or refresh Riskagon.');
