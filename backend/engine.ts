import {spawn, type ChildProcess} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import type {Format,Media} from '../src/types.ts';

const require=createRequire(import.meta.url);
export const ffmpegPath=process.env.FFMPEG_PATH || require('ffmpeg-static') as string;
export const ytdlpPath=process.env.YTDLP_PATH || (existsSync(resolve('.runtime/yt-dlp.exe')) ? resolve('.runtime/yt-dlp.exe') : 'yt-dlp');
type RawFormat={format_id?:string;ext?:string;vcodec?:string;acodec?:string;height?:number;abr?:number;filesize?:number;filesize_approx?:number;protocol?:string;has_drm?:boolean;url?:string};
export type RawMedia=RawFormat&{id?:string;title?:string;uploader?:string;creator?:string;duration?:number;formats?:RawFormat[];entries?:(RawMedia|null)[];webpage_url?:string;original_url?:string;url?:string;is_live?:boolean;live_status?:string;availability?:string;extractor_key?:string;extractor?:string;ie_key?:string;playlist_index?:number;playlist_count?:number;n_entries?:number;_type?:string};
export function mediaOptions(raw:RawMedia,id:string):Media {
  if(raw.is_live)throw new Error('Transmissões ao vivo não são suportadas.');
  if(raw.has_drm)throw new Error('DRM');
  if(['private','premium_only','subscriber_only','needs_auth'].includes(raw.availability||''))throw new Error('private or restricted media');
  const formats:Format[]=[];
  const available=(raw.formats || [raw]).filter(f=>!f.has_drm && ['http','https','m3u8_native','http_dash_segments'].includes(f.protocol||'https') && /^[\w.-]+$/.test(f.format_id||''));
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
  return {id,title:String(raw.title || 'Batatubo').slice(0,250),author:raw.uploader||raw.creator,duration:raw.duration,source:String(raw.extractor_key||raw.extractor||'generic').slice(0,100),identity:raw.id?`${raw.extractor_key||raw.extractor||'generic'}:${raw.id}`:undefined,formats:formats.reverse().slice(0,100)};
}
export {publicError} from './errors.ts';
export function launch(args:string[],proxy:string,signal:AbortSignal,onLine?:(line:string)=>void):{child:ChildProcess;result:Promise<string>} {
  const child=spawn(ytdlpPath,['--ignore-config','--no-plugin-dirs','--xff','never','--js-runtimes',`node:${process.execPath}`,'--no-cache-dir','--no-cookies','--no-playlist','--socket-timeout','20','--retries','1','--fragment-retries','1','--limit-rate','5M','--proxy',proxy,'--ffmpeg-location',ffmpegPath,...args],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_PROXY:'',no_proxy:''}});
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
      const text=chunk.toString();if(!onLine)out+=text;
      if(out.length>8*1024*1024){stop();finish(new Error('metadata limit'));return;}
      if(onLine){pending+=text;const lines=pending.split(/\r?\n/);pending=lines.pop()||'';lines.forEach(onLine);}
    });
    child.stderr?.on('data',chunk=>{err=(err+chunk.toString()).slice(-8000);});
    child.on('error',()=>finish(new Error('Motor indisponível.')));
    child.on('close',code=>finish(signal.aborted ? new Error(String(signal.reason||'cancelled')) : code===0 ? undefined : new Error(err||'engine error')));
  });
  return {child,result};
}
