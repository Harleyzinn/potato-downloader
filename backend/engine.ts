import {spawn, type ChildProcess} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import type {Format,Media} from '../src/types.ts';

const require=createRequire(import.meta.url);
export const ffmpegPath=process.env.FFMPEG_PATH || require('ffmpeg-static') as string;
export const ytdlpPath=process.env.YTDLP_PATH || (existsSync(resolve('.runtime/yt-dlp.exe')) ? resolve('.runtime/yt-dlp.exe') : 'yt-dlp');
type RawFormat={format_id?:string;ext?:string;vcodec?:string;acodec?:string;height?:number;abr?:number;filesize?:number;filesize_approx?:number;protocol?:string;has_drm?:boolean};
export type RawMedia=RawFormat&{id?:string;title?:string;uploader?:string;creator?:string;duration?:number;formats?:RawFormat[];entries?:RawMedia[];webpage_url?:string;original_url?:string;url?:string;is_live?:boolean};
export function mediaOptions(raw:RawMedia,id:string):Media {
  if(raw.is_live)throw new Error('Transmissões ao vivo não são suportadas.');
  if((raw.duration||0)>1200)throw new Error('O limite desta instância é de 20 minutos por mídia.');
  const formats:Format[]=[];
  const available=(raw.formats || [raw]).filter(f=>!f.has_drm && ['http','https','m3u8_native','http_dash_segments'].includes(f.protocol||'https') && /^[\w.-]+$/.test(f.format_id||'') && (f.filesize||f.filesize_approx||0)<=100*1024*1024);
  const audio=available.filter(f=>f.acodec && f.acodec!=='none' && f.vcodec==='none');
  for(const f of available) {
    const size=f.filesize || f.filesize_approx;
    if(f.vcodec && f.vcodec!=='none') {
      // An exact source format is selected. Audio-only track is merged when needed.
      const needsAudio=f.acodec==='none';
      if(needsAudio && !audio.length)continue;
      formats.push({id:`v:${f.format_id}`,mode:'video',label:`${f.height ? `${f.height}p` : 'Vídeo'} / ${f.ext||'original'}${needsAudio ? ' + áudio' : ''}`,ext:f.ext||'mp4',size:needsAudio ? undefined : size,estimated:!f.filesize});
    }
    if(f.acodec && f.acodec!=='none')formats.push({id:`a:${f.format_id}`,mode:'audio',label:`Áudio de ${f.ext||'original'}${f.abr ? ` / ${Math.round(f.abr)} kbps` : ''}`,ext:f.ext||'m4a',size,estimated:!f.filesize});
  }
  if(!formats.length)throw new Error('Nenhum formato público compatível. A mídia pode estar restrita.');
  return {id,title:String(raw.title || 'Potato download').slice(0,250),author:raw.uploader||raw.creator,duration:raw.duration,formats:formats.reverse().slice(0,100)};
}
export function publicError(text:string):string {
  if(/private|login|sign in|members.only|age.restrict|403|restricted|not available in your country/i.test(text))return 'Conteúdo privado ou restrito. Use um link público que permita download.';
  if(/404|removed|not found|unavailable/i.test(text))return 'Conteúdo removido ou indisponível. Confira o link.';
  if(/429|too many|rate.limit/i.test(text))return 'A plataforma limitou os pedidos. Tente novamente mais tarde.';
  if(/format.*not available/i.test(text))return 'Este formato não está mais disponível. Analise o link novamente.';
  if(/unsupported url/i.test(text))return 'Este tipo de link ainda não é compatível com o motor.';
  if(/timed out|timeout/i.test(text))return 'Tempo limite atingido. Tente novamente.';
  if(/size|too large|limite|limit|exceeded/i.test(text))return 'A mídia ultrapassou o limite desta instância (100 MiB / 20 minutos).';
  return 'Não foi possível processar a mídia. Tente outro link público ou novamente mais tarde.';
}
export function launch(args:string[],proxy:string,signal:AbortSignal,onLine?:(line:string)=>void):{child:ChildProcess;result:Promise<string>} {
  const child=spawn(ytdlpPath,['--ignore-config','--no-plugin-dirs','--js-runtimes',`node:${process.execPath}`,'--no-cache-dir','--no-cookies','--no-playlist','--playlist-end','8','--socket-timeout','20','--retries','1','--fragment-retries','1','--proxy',proxy,'--ffmpeg-location',ffmpegPath,...args],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_PROXY:'',no_proxy:''}});
  const result=new Promise<string>((done,fail)=>{
    let out='',err='',pending='';let settled=false;
    const stop=()=>{
      if(process.platform==='win32' && child.pid)spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
      else child.kill('SIGKILL');
    };
    const abort=()=>{stop();};
    const finish=(error?:Error)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);if(error)fail(error);else done(out);};
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    child.stdout?.on('data',chunk=>{
      const text=chunk.toString();out+=text;
      if(out.length>8*1024*1024){stop();finish(new Error('size limit'));return;}
      if(onLine){pending+=text;const lines=pending.split(/\r?\n/);pending=lines.pop()||'';lines.forEach(onLine);}
    });
    child.stderr?.on('data',chunk=>{err=(err+chunk.toString()).slice(-8000);});
    child.on('error',()=>finish(new Error('Motor indisponível.')));
    child.on('close',code=>finish(signal.aborted ? new Error(String(signal.reason||'cancelled')) : code===0 ? undefined : new Error(err||'engine error')));
  });
  return {child,result};
}
