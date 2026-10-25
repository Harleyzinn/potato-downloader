import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import engines from './engines.json';
export async function hashFile(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function enginesReady(folder:string){try{for(const e of engines)if(await hashFile(join(folder,e.name))!==(e.unpackedSha256||e.sha256))return false;return true;}catch{return false;}}
export async function prepareEngines(folder:string,notify:(data:{message:string;bytes:number;total?:number})=>void,signal:AbortSignal){await mkdir(folder,{recursive:true});for(const e of engines){const target=join(folder,e.name),download=target+'.download',partial=target+'.partial';try{if(await hashFile(target)===(e.unpackedSha256||e.sha256))continue;}catch{/* Obtain missing or altered dependency from the pinned upstream. */}
    let idle:ReturnType<typeof setTimeout>;const inactive=new AbortController();const renew=()=>{clearTimeout(idle);idle=setTimeout(()=>inactive.abort(),120000);};renew();
    try{const response=await fetch(e.url,{signal:AbortSignal.any([signal,inactive.signal]),redirect:'follow',headers:{'User-Agent':'Batatubo/4 dependency-manager'}});if(!response.ok||!response.body)throw Error('dependency unavailable');const total=Number(response.headers.get('content-length'))||undefined;let bytes=0,last=0;const meter=new Transform({transform(chunk,_encoding,done){renew();bytes+=chunk.length;if(Date.now()-last>100){last=Date.now();notify({message:`[ATIVO] ${e.name}: ${(bytes/1048576).toFixed(1)} MiB recebidos${total?' / '+(total/1048576).toFixed(1)+' MiB':' / total desconhecido'}`,bytes,total});}done(null,chunk);}});await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),meter,createWriteStream(download),{signal:AbortSignal.any([signal,inactive.signal])});if(await hashFile(download)!==e.sha256)throw Error('checksum mismatch');notify({message:`[ATIVO] Verificando e preparando ${e.name}...`,bytes});if(e.gzip)await pipeline(createReadStream(download),createGunzip(),createWriteStream(partial),{signal});else await rename(download,partial);if(await hashFile(partial)!==(e.unpackedSha256||e.sha256))throw Error('unpacked checksum mismatch');await rm(target,{force:true});await rename(partial,target);
    }finally{clearTimeout(idle!);await rm(download,{force:true}).catch(()=>{});await rm(partial,{force:true}).catch(()=>{});}}
  // License texts accompany end-user downloads. No extractor/codec binaries ship in our installer.
  for(const [name,url]of Object.entries({'yt-dlp-LICENSE.txt':'https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.10.21/LICENSE','yt-dlp-THIRD-PARTY.txt':'https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.10.21/THIRD_PARTY_LICENSES.txt','ffmpeg-LICENSE.txt':'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/win32-x64.LICENSE','ffmpeg-README.txt':'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/win32-x64.README'})){
    try{await readFile(join(folder,name));}catch{const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});if(!response.ok)throw Error('license unavailable');await writeFile(join(folder,name),await response.text());}}
  await writeFile(join(folder,'versions-and-sources.json'),JSON.stringify(engines,null,2));
}
