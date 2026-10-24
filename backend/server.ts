import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,readdir,stat,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {config} from './config.ts';
import {createEgressProxy,validateSource,sanitizeFilename,platforms,resolvePublic} from './security.ts';
import {launch,mediaOptions,publicError,ytdlpPath,ffmpegPath,type RawMedia} from './engine.ts';
import type {Analysis,Job} from '../src/types.ts';

type Stored={analysis:Analysis;urls:string[];raw:RawMedia[]};
type Task={job:Job;controller:AbortController;expiresAt:number;dir:string;file?:string;activeStreams:number};
const analyses=new Map<string,Stored>(),jobs=new Map<string,Task>(),limits=new Map<string,{count:number;until:number}>();
let active=0;
const engineOK=()=>spawnSync(ytdlpPath,['--version'],{windowsHide:true,timeout:5000}).status===0 && spawnSync(ffmpegPath,['-version'],{windowsHide:true,timeout:5000}).status===0;
const online=engineOK();
await mkdir(config.tempRoot,{recursive:true});
const proxy=createEgressProxy();await new Promise<void>(done=>proxy.listen(0,'127.0.0.1',done));
const addr=proxy.address();if(!addr || typeof addr==='string')throw new Error('Proxy unavailable');
const proxyURL=`http://127.0.0.1:${addr.port}`;
async function dirSize(dir:string) {let total=0;for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);total+=entry.isDirectory()?await dirSize(path):(await stat(path)).size;}return total;}
async function body(req:http.IncomingMessage):Promise<Record<string,unknown>> {
  if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Use application/json.');
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw new Error('Pedido muito grande.');}
  try{const value=JSON.parse(raw);if(!value || typeof value!=='object' || Array.isArray(value))throw new Error();return value;}catch{throw new Error('Pedido inválido.');}
}
const server=http.createServer(async(req,res)=>{
  const send=(code:number,data:unknown)=>{if(res.destroyed)return;res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const origin=req.headers.origin;
  if(origin && !config.origins.includes(origin))return send(403,{message:'Origem não autorizada.'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const path=(req.url||'/').split('?')[0];
  if(path==='/api/health' && req.method==='GET')return send(200,{online,engine:'yt-dlp + ffmpeg',platforms:platforms.map(p=>p.name),limits:{maxBytes:config.maxBytes,maxDuration:config.maxDuration},temporary:config.temporary});
  const ip=req.socket.remoteAddress||'unknown';
  if(req.method==='POST'){
    const now=Date.now();for(const [key,v]of limits)if(v.until<now)limits.delete(key);
    const limit=limits.get(ip)||{count:0,until:now+600000};limits.set(ip,limit);
    if(++limit.count>30){res.setHeader('Retry-After','600');return send(429,{message:'Limite de pedidos atingido. Aguarde dez minutos.'});}
    if(!online)return send(503,{message:'Motor indisponível. O administrador precisa iniciar yt-dlp e ffmpeg.'});
  }
  try{
    if(path==='/api/analyze' && req.method==='POST'){
      if(active>=config.maxConcurrent)return send(429,{message:'Motor ocupado. Tente em instantes.'});
      if(analyses.size>=100)return send(429,{message:'Instância ocupada. Tente mais tarde.'});
      const data=await body(req);const url=validateSource(data.url);await resolvePublic(url.hostname);
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort('timeout'),90000);
      const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);active++;
      try{
        const output=await launch(['--dump-single-json','--skip-download','--',url.href],proxyURL,controller.signal).result;
        const raw=JSON.parse(output) as RawMedia;
        const entries=(raw.entries||[raw]).slice(0,8);const items:Analysis['items']=[],urls:string[]=[],valid:RawMedia[]=[];
        for(const entry of entries){const source=validateSource(entry.webpage_url||entry.original_url||url.href);const media=mediaOptions(entry,randomUUID());items.push(media);urls.push(source.href);valid.push(entry);}
        if(!items.length)throw new Error('No formats');
        const analysis:Analysis={id:randomUUID(),items,expiresAt:Date.now()+config.ttl};analyses.set(analysis.id,{analysis,urls,raw:valid});return send(200,analysis);
      }catch(error){return send(controller.signal.aborted?408:422,{message:controller.signal.aborted?'Análise cancelada ou tempo limite atingido.':publicError(String(error))});}
      finally{active--;clearTimeout(timer);res.removeListener('close',disconnected);}
    }
    if(path==='/api/jobs' && req.method==='POST'){
      if(active>=config.maxConcurrent || jobs.size>=50)return send(429,{message:'Motor ocupado. Tente em instantes.'});
      const data=await body(req),stored=analyses.get(String(data.analysisId));
      if(!stored || stored.analysis.expiresAt<Date.now())return send(410,{message:'A análise expirou. Analise o link novamente.'});
      const index=stored.analysis.items.findIndex(item=>item.id===data.itemId),media=stored.analysis.items[index];
      if(!media)return send(400,{message:'Mídia inválida.'});
      const format=media.formats.find(f=>f.id===data.formatId);if(!format)return send(400,{message:'Formato indisponível. Analise novamente.'});
      const conversion=String(data.conversion||'original');
      if(!['original','mp3','opus','wav'].includes(conversion) || (format.mode!=='audio' && conversion!=='original'))return send(400,{message:'Conversão indisponível para este formato.'});
      const id=randomUUID(),dir=await mkdtemp(join(config.tempRoot,'job-')),controller=new AbortController();
      const task:Task={job:{id,state:'preparing'},dir,controller,expiresAt:Date.now()+config.ttl,activeStreams:0};jobs.set(id,task);active++;
      const sourceId=format.id.slice(2);
      const rawFormat=stored.raw[index].formats?.find(f=>f.format_id===sourceId);
      const selector=format.mode==='video' && rawFormat?.acodec==='none' ? `${sourceId}+bestaudio` : sourceId;
      const args=['--no-simulate','--no-part','--downloader','native','--hls-prefer-native','--max-filesize',String(config.maxBytes),'--newline','--progress','--progress-delta','1','--progress-template','download:PROGRESS:%(progress.downloaded_bytes)s:%(progress.total_bytes)s','--print','after_move:FILE:%(filepath)s','-f',selector,'-o',join(dir,'media.%(ext)s')];
      if(format.mode==='audio')args.push('-x','--audio-format',conversion==='original'?'best':conversion);
      args.push('--',stored.urls[index]);
      const timer=setTimeout(()=>controller.abort('timeout'),8*60000);
      let checking=false;
      const watch=setInterval(async()=>{if(checking)return;checking=true;try{if(await dirSize(dir)>config.maxBytes)controller.abort('size');}catch{/* Directory may be removed after cancellation. */}finally{checking=false;}},1000);
      const execution=launch(args,proxyURL,controller.signal,line=>{
        if(line.startsWith('PROGRESS:')){
          const [downloaded,total]=line.slice(9).split(':').map(Number);task.job.state='downloading';
          if(Number.isFinite(downloaded)&&Number.isFinite(total)&&total>0)task.job.progress=Math.min(100,Math.round(downloaded/total*100));else delete task.job.progress;
          if(downloaded>config.maxBytes)controller.abort('size');
        }
      });
      void execution.result.then(async()=>{
        if(controller.signal.aborted)throw new Error('cancelled');
        const files=(await readdir(dir)).filter(x=>/^media\.[a-z0-9]+$/i.test(x));if(files.length!==1)throw new Error('output');
        const file=join(dir,files[0]),info=await stat(file);if(!info.size || info.size>config.maxBytes)throw new Error('size');
        task.file=file;task.job={id,state:'ready',filename:sanitizeFilename(media.title,extname(file).slice(1)),size:info.size};
      }).catch(async(error)=>{
        task.job={id,state:controller.signal.aborted && !['timeout','size'].includes(String(controller.signal.reason))?'cancelled':'error',message:controller.signal.reason==='size' ? 'Arquivo acima do limite de 100 MiB.' : controller.signal.reason==='timeout' ? 'Tempo limite atingido. Tente novamente.' : publicError(String(error))};
        await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:200});
      }).finally(()=>{active--;clearTimeout(timer);clearInterval(watch);});
      return send(202,task.job);
    }
    const match=path.match(/^\/api\/jobs\/([a-f0-9-]{36})(\/file)?$/);
    if(match){
      const task=jobs.get(match[1]);if(!task || task.expiresAt<Date.now())return send(410,{message:'Arquivo expirado. Analise o link novamente.'});
      if(req.method==='DELETE' && !match[2]){
        task.controller.abort();task.job={id:task.job.id,state:'cancelled'};
        if(!task.activeStreams && task.file)await rm(task.dir,{recursive:true,force:true,maxRetries:3,retryDelay:200});return send(200,task.job);
      }
      if(req.method==='GET' && !match[2])return send(200,task.job);
      if(req.method==='GET' && match[2]){
        if(task.job.state!=='ready'||!task.file)return send(409,{message:'O arquivo ainda não está pronto.'});
        const filename=task.job.filename||'potato.bin';
        res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':task.job.size,'Content-Disposition':`attachment; filename="potato${extname(task.file)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,'Cache-Control':'no-store'});
        task.activeStreams++;const stream=createReadStream(task.file);stream.on('error',()=>res.destroy());stream.pipe(res);res.on('close',()=>{stream.destroy();task.activeStreams--;});return;
      }
    }
    return send(404,{message:'Rota não encontrada.'});
  }catch(error){return send(400,{message:error instanceof Error && /Pedido|Use application|Informe|Endereços|Plataforma|Use HTTP/.test(error.message)?error.message:'Pedido inválido ou destino bloqueado. Confira o link.'});}
});
server.requestTimeout=100000;server.headersTimeout=10000;
const cleanup=setInterval(async()=>{
  const now=Date.now();for(const[id,item]of analyses)if(item.analysis.expiresAt<now)analyses.delete(id);
  for(const[id,task]of jobs)if(task.expiresAt<now && !task.activeStreams){task.controller.abort();await rm(task.dir,{recursive:true,force:true});jobs.delete(id);}
},30000);cleanup.unref();
server.listen(config.port,config.host,()=>console.log(`Potato API http://${config.host}:${config.port} / engine ${online?'online':'offline'}`));
async function shutdown(){for(const task of jobs.values())task.controller.abort();server.close();proxy.close();await Promise.all([...jobs.values()].map(task=>rm(task.dir,{recursive:true,force:true})));process.exit(0);}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
// Do not log URLs, metadata, raw extractor errors, or download capability IDs.
