import {join,basename,extname,resolve,relative,isAbsolute} from 'node:path';
import {lstat,open,unlink,link,realpath,copyFile} from 'node:fs/promises';
import {createWriteStream,constants} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
export function safeName(input:string):string{let name=basename(input.replaceAll('\\','/')).replace(/[<>:"/\\|?*]/g,'_').split('').map(c=>c.charCodeAt(0)<32?'_':c).join('').replace(/[. ]+$/,'').slice(0,180);if(!name||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='batatubo-'+(name||'arquivo');return name;}
export function inside(folder:string,file:string){const part=relative(resolve(folder),resolve(file));return part!==''&&!part.startsWith('..')&&!isAbsolute(part);}
export async function uniqueDestination(folder:string,input:string){const directory=await realpath(folder);const name=safeName(input),ext=extname(name),stem=name.slice(0,name.length-ext.length);for(let i=0;i<10000;i++){const file=join(directory,i?`${stem} (${i})${ext}`:name);if(!inside(directory,file))throw Error('invalid path');try{await lstat(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {file,renamed:i>0};throw error;}}throw Error('too many conflicts');}
export async function writeDownload(response:Response,destination:string,signal:AbortSignal,onProgress:(bytes:number)=>void){if(!response.ok||!response.body)throw Error('source unavailable');const partial=destination+'.'+randomUUID()+'.partial';const handle=await open(partial,'wx');await handle.close();let count=0;try{const meter=new Transform({transform(chunk,_encoding,done){count+=chunk.length;onProgress(count);done(null,chunk);}});await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),meter,createWriteStream(partial,{flags:'r+'}),{signal});if(signal.aborted)throw Error('cancelled');
    // Atomic no-overwrite publication, including a conflict created while downloading.
    try{await link(partial,destination);}catch(error){
      if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV'].includes((error as NodeJS.ErrnoException).code||''))throw error;
      // FAT/exFAT and shares may not support hard links. OS copy still refuses overwrites.
      await copyFile(partial,destination,constants.COPYFILE_EXCL);
      if(signal.aborted){await unlink(destination);throw Error('cancelled',{cause:error});}
    }await unlink(partial);return count;
  }catch(error){await unlink(partial).catch(()=>{});throw error;}}
