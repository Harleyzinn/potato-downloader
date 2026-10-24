import http from 'node:http';
import https from 'node:https';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {parsePublicURL,resolvePublic} from './security.ts';
import {ffmpegPath,type RawMedia} from './engine.ts';
import {config} from './config.ts';

const demuxers:Record<string,string>={mp4:'mov',m4v:'mov',m4a:'mov',mov:'mov',webm:'matroska',mkv:'matroska',mp3:'mp3',ogg:'ogg',oga:'ogg',ogv:'ogg',opus:'ogg',wav:'wav',flac:'flac',aac:'aac',ts:'mpegts'};
/** Range is advisory: enforce a byte cap even when the origin ignores it.
 * All redirect destinations are checked again and sockets use pinned public IPs.
 */
export async function readPublicPrefix(value:string,signal:AbortSignal,redirects=0):Promise<Buffer>{
  if(redirects>5)throw new Error('Muitos redirecionamentos.');
  const url=parsePublicURL(value),dest=await resolvePublic(url.hostname);
  const limited=AbortSignal.any([signal,AbortSignal.timeout(12000)]);
  const maximum=4*1024*1024;
  const result=await new Promise<Buffer|string>((done,fail)=>{
    let complete=false;
    const finish=(data:Buffer|string)=>{if(complete)return;complete=true;done(data);};
    const request=(url.protocol==='https:'?https.request:http.request)({hostname:dest.address,port:url.protocol==='https:'?443:80,servername:url.hostname,method:'GET',path:url.pathname+url.search,headers:{Host:url.host,Range:`bytes=0-${maximum-1}`,'User-Agent':'PotatoDumper/2.2'},signal:limited},response=>{
      if([301,302,303,307,308].includes(response.statusCode||0)){
        const location=response.headers.location;response.destroy();if(!location)return fail(new Error('Redirecionamento inválido.'));return finish(new URL(location,url).href);
      }
      if(![200,206].includes(response.statusCode||0)){response.destroy();return fail(new Error(`HTTP ${response.statusCode}`));}
      const chunks:Buffer[]=[];let bytes=0;
      response.on('data',(chunk:Buffer)=>{const part=chunk.subarray(0,maximum-bytes);chunks.push(part);bytes+=part.length;if(bytes>=maximum){finish(Buffer.concat(chunks,bytes));response.destroy();}});
      response.on('end',()=>finish(Buffer.concat(chunks,bytes)));
      response.on('error',error=>{if(!complete)fail(error);});
    });
    request.on('error',error=>{if(!complete)fail(error);});request.end();
  });
  return typeof result==='string'?readPublicPrefix(result,signal,redirects+1):result;
}
export async function probeUnknownFormats(raw:RawMedia,signal:AbortSignal):Promise<void>{
  const entries=raw.entries||[raw];
  for(const entry of entries.slice(0,8)){
    const formats=entry.formats||[entry];
    // Usually only Generic direct files lack codecs. Known manifests/extractors skip this path.
    const unknown=formats.filter(f=>!f.vcodec&&!f.acodec).slice(0,2);
    for(const format of unknown){
      const ext=format.ext||entry.ext||'',demuxer=demuxers[ext];
      const source=format.url||entry.url;if(!demuxer||!source)continue;
      const dir=await mkdtemp(join(config.tempRoot,'job-probe-'));
      try{
        const prefix=await readPublicPrefix(source,signal);const file=join(dir,`header.${ext}`);await writeFile(file,prefix);
        const output=await new Promise<string>((done,fail)=>{
          const child=spawn(ffmpegPath,['-hide_banner','-nostdin','-protocol_whitelist','file,pipe','-f',demuxer,'-i',file,'-t','0','-f','null','-'],{windowsHide:true,stdio:['ignore','ignore','pipe'],signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
          let stderr='';child.stderr?.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-32768);});child.on('error',fail);child.on('close',()=>done(stderr));
        });
        if(/encrypted|decryption|DRM|\bencv\b|\benca\b/i.test(output)){format.has_drm=true;continue;}
        const video=output.match(/^\s*Stream #\d+:\d+[^\r\n]*: Video: ([\w-]+)[^\r\n]*/m);
        const audio=output.match(/^\s*Stream #\d+:\d+[^\r\n]*: Audio: ([\w-]+)/m);
        if(!video&&!audio)continue;
        format.vcodec=video?.[1]||'none';format.acodec=audio?.[1]||'none';
        const dimensions=video?.[0].match(/\b(\d{2,5})x(\d{2,5})\b/);if(dimensions)format.height=Number(dimensions[2]);
        const time=output.match(/Duration: (\d+):(\d+):([\d.]+)/);if(time&&!entry.duration)entry.duration=Number(time[1])*3600+Number(time[2])*60+Number(time[3]);
      }finally{await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:200});}
    }
  }
}
