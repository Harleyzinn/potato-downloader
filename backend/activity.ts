import {readdir,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';

// Filesystem changes count as activity even when FFmpeg does not emit percentages.
async function fingerprint(dir:string):Promise<string>{
  const values:string[]=[];
  for(const item of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,item.name);
    if(item.isDirectory())values.push(item.name+await fingerprint(path));
    else{const info=await stat(path);values.push(`${item.name}:${info.size}:${info.mtimeMs}`);}
  }return values.sort().join('|');
}
export function activityWatch(dir:string,controller:AbortController,idleMs:number){
  let changedAt=Date.now(),previous='',checking=false,closed=false;
  const touch=()=>{changedAt=Date.now();};
  const timer=setInterval(()=>{if(checking||closed)return;checking=true;void fingerprint(dir).then(value=>{
    if(value!==previous){previous=value;touch();}
    else if(Date.now()-changedAt>=idleMs)controller.abort('stalled');
  }).catch(()=>{if(!closed&&Date.now()-changedAt>=idleMs)controller.abort('stalled');}).finally(()=>{checking=false;});},Math.min(2000,Math.max(100,idleMs/3)));
  timer.unref();return {touch,stop:()=>{closed=true;clearInterval(timer);}};
}
export async function removeTemporary(dir:string):Promise<void>{
  try{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:250});}catch{/* The orphan sweeper retries locked files. */}
}
export async function removeIntermediates(dir:string,keep:string):Promise<void>{
  for(const name of await readdir(dir)){const path=join(dir,name);if(path!==keep)await removeTemporary(path);}
}
