import http from 'node:http';
import {randomUUID,randomBytes} from 'node:crypto';
import {ZipArchive} from 'archiver';
import {discovery} from './discovery.ts';
import {mkdir,mkdtemp,readdir,stat,rm} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {join,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {config} from './config.ts';
import {createEgressProxy,validateSource,sanitizeFilename,resolvePublic} from './security.ts';
import {readCompatibility} from './catalog.ts';
import {probeUnknownFormats} from './probe.ts';
import {launch,mediaOptions,publicError,ytdlpPath,ffmpegPath,type RawMedia} from './engine.ts';
import type {Analysis,Job} from '../src/types.ts';

type Stored={owner:string;analysis:Analysis;urls:string[];raw:RawMedia[]};
type Task={input?:{url:string;title:string;index:number;formatId:string;conversion:string;numbering:boolean};owner:string;requestKey?:string;fileToken:string;job:Job;controller:AbortController;expiresAt:number;dir:string;file?:string;activeStreams:number};
const analyses=new Map<string,Stored>(),jobs=new Map<string,Task>(),limits=new Map<string,{count:number;until:number}>();
const creating=new Set<string>();
const sessions=new Map<string,{until:number;traffic:number}>();
let active=0,streams=0;
const engineOK=()=>spawnSync(ytdlpPath,['--version'],{windowsHide:true,timeout:5000}).status===0 && spawnSync(ffmpegPath,['-version'],{windowsHide:true,timeout:5000}).status===0;
const online=engineOK();
const compatibility=readCompatibility();
await mkdir(config.tempRoot,{recursive:true});
const proxy=createEgressProxy();await new Promise<void>(done=>proxy.listen(0,'127.0.0.1',done));
const addr=proxy.address();if(!addr || typeof addr==='string')throw new Error('Proxy unavailable');
const proxyURL=`http://127.0.0.1:${addr.port}`;
async function dirSize(dir:string) {let total=0;for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);total+=entry.isDirectory()?await dirSize(path):(await stat(path)).size;}return total;}
async function body(req:http.IncomingMessage):Promise<Record<string,unknown>> {
  if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Use application/json.');
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32768)throw new Error('Pedido muito grande.');}
  try{const value=JSON.parse(raw);if(!value || typeof value!=='object' || Array.isArray(value))throw new Error();return value;}catch{throw new Error('Pedido inválido.');}
}
const server=http.createServer(async(req,res)=>{
  const send=(code:number,data:unknown)=>{if(res.destroyed)return;res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const origin=req.headers.origin;
  if(origin && !config.origins.includes(origin))return send(403,{message:'Origem não autorizada.'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Potato-Session');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const path=(req.url||'/').split('?')[0];
  if(path==='/api/health' && req.method==='GET')return send(200,{online,engine:`yt-dlp ${compatibility.version} + ffmpeg`,platforms:compatibility.groups.filter(p=>p.installed).map(p=>p.name),limits:{maxBytes:config.maxBytes,maxDuration:config.maxDuration},temporary:config.temporary,batch:{maxItems:config.maxBatch,pageSize:config.playlistPage,maxPlaylist:config.maxPlaylist,concurrency:1,maxZipBytes:config.maxZip,ttl:config.ttl}});
  if(path==='/api/compatibility' && req.method==='GET')return send(200,compatibility);
  const ip=req.socket.remoteAddress||'unknown';
  if(req.method==='POST'){
    const now=Date.now();for(const [key,v]of limits)if(v.until<now)limits.delete(key);
    const limit=limits.get(ip)||{count:0,until:now+600000};limits.set(ip,limit);
    if(++limit.count>150){res.setHeader('Retry-After','600');return send(429,{message:'Limite de pedidos atingido. Aguarde dez minutos.'});}
    if(!online)return send(503,{message:'Motor indisponível. O administrador precisa iniciar yt-dlp e ffmpeg.'});
  }
  if(path==='/api/session' && req.method==='POST'){
    if(sessions.size>=200)return send(429,{message:'Instância ocupada.'});
    const token=randomBytes(32).toString('hex');sessions.set(token,{until:Date.now()+3600000,traffic:0});return send(201,{token});
  }
  const owner=String(req.headers['x-potato-session']||''),session=sessions.get(owner);
  const fileRequest=/^\/api\/jobs\/[a-f0-9-]{36}\/file$/.test(path)&&req.method==='GET';
  if(!fileRequest&&(!session||session.until<Date.now()))return send(401,{message:'Sessão expirada. Recarregue a página e analise novamente.'});
  if(session)session.until=Date.now()+3600000;
  try{
    if(path==='/api/session/jobs'&&req.method==='GET')return send(200,{items:[...jobs.values()].filter(t=>t.owner===owner&&t.input&&t.expiresAt>Date.now()).map(t=>({job:t.job,...t.input}))});
    if(path==='/api/discover' && req.method==='POST'){
      if(active>=config.maxConcurrent)return send(429,{message:'Motor ocupado. Aguarde alguns instantes.'});
      const data=await body(req),url=validateSource(data.url);await resolvePublic(url.hostname);
      const start=Number(data.start||1);if(!Number.isInteger(start)||start<1||start>config.maxPlaylist)return send(400,{message:'Página fora do limite de 200 itens.'});
      if(active>=config.maxConcurrent)return send(429,{message:'Motor ocupado.'});
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort('timeout'),90000);
      const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);active++;
      try{
        const single=data.scope==='single'||(data.scope!=='playlist'&&url.searchParams.has('v')&&url.searchParams.has('list'));
        const output=await launch(['--dump-single-json','--skip-download','--flat-playlist','--ignore-errors',single?'--no-playlist':'--yes-playlist','--playlist-items',`${start}:${start+config.playlistPage}`,'--',url.href],proxyURL,controller.signal).result;
        const raw=JSON.parse(output) as RawMedia;if(!raw)throw new Error('unavailable');return send(200,discovery(raw,url,start));
      }catch(error){return send(controller.signal.aborted?408:422,{message:publicError(String(error))});}
      finally{active--;clearTimeout(timer);res.removeListener('close',disconnected);}
    }
    if(path==='/api/analyze' && req.method==='POST'){
      if(active>=config.maxConcurrent)return send(429,{message:'Motor ocupado. Tente em instantes.'});
      if(analyses.size>=100)return send(429,{message:'Instância ocupada. Tente mais tarde.'});
      const data=await body(req);const url=validateSource(data.url);await resolvePublic(url.hostname);
      if(active>=config.maxConcurrent)return send(429,{message:'Motor ocupado. Tente em instantes.'});
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort('timeout'),90000);
      const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);active++;
      try{
        const output=await launch(['--dump-single-json','--skip-download','--playlist-items','1','--',url.href],proxyURL,controller.signal).result;
        const raw=JSON.parse(output) as RawMedia;
        await probeUnknownFormats(raw,controller.signal);
        const entries=(raw.entries||[raw]).filter((x):x is RawMedia=>!!x).slice(0,1);const items:Analysis['items']=[],urls:string[]=[],valid:RawMedia[]=[];
        for(const entry of entries){const source=validateSource(entry.webpage_url||entry.original_url||url.href);try{const media=mediaOptions(entry,randomUUID());items.push(media);urls.push(source.href);valid.push(entry);}catch(error){if(entries.length===1)throw error;}}
        if(!items.length)throw new Error('No formats');
        const analysis:Analysis={id:randomUUID(),items,expiresAt:Date.now()+config.ttl};analyses.set(analysis.id,{owner,analysis,urls,raw:valid});return send(200,analysis);
      }catch(error){return send(controller.signal.aborted?408:422,{message:controller.signal.aborted?'Análise cancelada ou tempo limite atingido.':publicError(String(error))});}
      finally{active--;clearTimeout(timer);res.removeListener('close',disconnected);}
    }
    if(path==='/api/jobs' && req.method==='POST'){
      const data=await body(req);
      const requestKey=typeof data.requestKey==='string'?data.requestKey.slice(0,100):undefined;
      const existing=requestKey&&[...jobs.values()].find(t=>t.owner===owner&&t.requestKey===requestKey&&t.expiresAt>Date.now());
      if(existing)return send(200,existing.job);
      const creationKey=`${owner}:${requestKey||randomUUID()}`;if(creating.has(creationKey))return send(409,{message:'Este pedido já está sendo iniciado. Aguarde.'});creating.add(creationKey);try{
      if(active>=config.maxConcurrent || jobs.size>=50)return send(429,{message:'Motor ocupado. Tente em instantes.'});
      if(await dirSize(config.tempRoot)+config.maxBytes*(active+1)>config.maxDisk)return send(429,{message:'Armazenamento temporário ocupado. Tente novamente em 15 minutos.'});
      const stored=analyses.get(String(data.analysisId));
      if(!stored || stored.owner!==owner || stored.analysis.expiresAt<Date.now())return send(410,{message:'A análise expirou. Analise o link novamente.'});
      const index=stored.analysis.items.findIndex(item=>item.id===data.itemId),media=stored.analysis.items[index];
      if(!media)return send(400,{message:'Mídia inválida.'});
      const format=media.formats.find(f=>f.id===data.formatId);if(!format)return send(400,{message:'Formato indisponível. Analise novamente.'});
      const conversion=String(data.conversion||'original');
      if(!['original','mp3','opus','wav'].includes(conversion) || (format.mode!=='audio' && conversion!=='original'))return send(400,{message:'Conversão indisponível para este formato.'});
      const id=randomUUID(),dir=await mkdtemp(join(config.tempRoot,'job-')),controller=new AbortController();
      const used=await dirSize(config.tempRoot);
      if(active>=config.maxConcurrent || used+config.maxBytes*config.maxConcurrent>config.maxDisk){await rm(dir,{recursive:true,force:true});return send(429,{message:'Motor ou armazenamento ocupado. Tente novamente em instantes.'});}
      const task:Task={input:{url:stored.urls[index],title:media.title,index:Number.isInteger(data.index)?Number(data.index):1,formatId:format.id,conversion,numbering:data.numbering===true},owner,requestKey,fileToken:randomBytes(32).toString('hex'),job:{id,state:'preparing'},dir,controller,expiresAt:Date.now()+config.ttl,activeStreams:0};jobs.set(id,task);active++;
      const sourceId=format.id.slice(2);
      const rawFormat=stored.raw[index].formats?.find(f=>f.format_id===sourceId);
      const selector=format.mode==='video' && rawFormat?.acodec==='none' ? `${sourceId}+bestaudio` : sourceId;
      const args=['--no-simulate','--no-part','--downloader','native','--hls-prefer-native','--max-filesize',String(config.maxBytes),'--newline','--progress','--progress-delta','1','--progress-template','download:PROGRESS:%(progress.downloaded_bytes)s:%(progress.total_bytes)s:%(progress.speed)s:%(progress.eta)s','--progress-template','postprocess:POST:%(progress.status)s','--print','before_dl:STAGE:download','--print','post_process:STAGE:processing','--print','after_move:FILE:%(filepath)s','-f',selector,'-o',join(dir,'media.%(ext)s')];
      if(format.mode==='audio')args.push('-x','--audio-format',conversion==='original'?'best':conversion);
      args.push('--',stored.urls[index]);
      const timer=setTimeout(()=>controller.abort('timeout'),8*60000);
      let checking=false;
      const watch=setInterval(async()=>{if(checking)return;checking=true;try{if(await dirSize(dir)>config.maxBytes)controller.abort('size');}catch{/* Directory may be removed after cancellation. */}finally{checking=false;}},1000);
      const execution=launch(args,proxyURL,controller.signal,line=>{
        if(line.startsWith('PROGRESS:')){
          const [downloaded,total,speed,eta]=line.slice(9).split(':').map(Number);
          task.job.downloaded=Number.isFinite(downloaded)?downloaded:undefined;task.job.total=Number.isFinite(total)&&total>0?total:undefined;task.job.speed=Number.isFinite(speed)&&speed>0?speed:undefined;task.job.eta=Number.isFinite(eta)&&eta>=0?eta:undefined;task.job.state='downloading';
          if(Number.isFinite(downloaded)&&Number.isFinite(total)&&total>0)task.job.progress=Math.min(100,Math.round(downloaded/total*100));else delete task.job.progress;
          if(downloaded>config.maxBytes)controller.abort('size');
        }else if(line.startsWith('POST:')||line==='STAGE:processing'){task.job.state='processing';delete task.job.progress;delete task.job.speed;delete task.job.eta;delete task.job.downloaded;delete task.job.total;}
      });
      void execution.result.then(async()=>{
        if(controller.signal.aborted)throw new Error('cancelled');
        const files=(await readdir(dir)).filter(x=>/^media\.[a-z0-9]+$/i.test(x));if(files.length!==1)throw new Error('output');
        const file=join(dir,files[0]),info=await stat(file);if(!info.size || info.size>config.maxBytes)throw new Error('size');
        task.file=file;task.expiresAt=Date.now()+config.ttl;const prefix=data.numbering===true&&Number.isInteger(data.index)?`${String(data.index).padStart(3,'0')}-`:'';const extension=extname(file).slice(1),baseName=sanitizeFilename(prefix+media.title,extension);const filename=[...jobs.values()].some(other=>other!==task&&other.owner===owner&&other.job.filename===baseName)?sanitizeFilename(`${(prefix+media.title).slice(0,95)}-${id.slice(0,8)}`,extension):baseName;task.job={id,state:'ready',filename,size:info.size,fileToken:task.fileToken,expiresAt:task.expiresAt};
      }).catch(async(error)=>{
        task.job={id,state:controller.signal.aborted && !['timeout','size'].includes(String(controller.signal.reason))?'cancelled':'error',message:controller.signal.reason==='size' ? 'Arquivo acima do limite de 100 MiB.' : controller.signal.reason==='timeout' ? 'Tempo limite atingido. Tente novamente.' : publicError(String(error))};
        await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:200});
      }).finally(()=>{active--;clearTimeout(timer);clearInterval(watch);});
      return send(202,task.job);
      }finally{creating.delete(creationKey);}
    }
    if(path==='/api/zip'&&req.method==='POST'){
      const data=await body(req);if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>config.maxBatch)return send(400,{message:'Selecione entre 1 e 20 arquivos prontos.'});
      const ids=[...new Set(data.ids.map(String))],sources=ids.map(id=>jobs.get(id));
      if(sources.some(t=>!t||t.owner!==owner||t.job.state!=='ready'||!t.file||t.expiresAt<Date.now()))return send(409,{message:'Algum arquivo não está pronto ou expirou.'});
      const total=sources.reduce((n,t)=>n+(t!.job.size||0),0);
      if(total>config.maxZip)return send(413,{message:'ZIP limitado a 200 MiB de arquivos de origem.'});
      if(active>=config.maxConcurrent||jobs.size>=50||await dirSize(config.tempRoot)+config.maxBytes*active+total+65536>config.maxDisk)return send(429,{message:'Motor ou disco ocupado para montar ZIP.'});
      const dir=await mkdtemp(join(config.tempRoot,'job-'));
      if(active>=config.maxConcurrent||await dirSize(config.tempRoot)+config.maxBytes*active+total+65536>config.maxDisk){await rm(dir,{recursive:true,force:true});return send(429,{message:'Motor ou disco ocupado.'});}
      const id=randomUUID(),controller=new AbortController();
      const task:Task={owner,fileToken:randomBytes(32).toString('hex'),controller,dir,activeStreams:0,expiresAt:Date.now()+config.ttl,job:{id,state:'packing'}};
      jobs.set(id,task);active++;sources.forEach(t=>t!.activeStreams++);
      const file=join(dir,'media.zip'),output=createWriteStream(file),archive=new ZipArchive({store:true,statConcurrency:1});
      const timer=setTimeout(()=>controller.abort(),60000);
      void new Promise<void>((done,fail)=>{
        const abort=()=>{archive.abort();output.destroy(new Error('cancelled'));};controller.signal.addEventListener('abort',abort,{once:true});
        output.on('close',()=>{controller.signal.removeEventListener('abort',abort);done();});output.on('error',fail);archive.on('error',fail);archive.on('warning',fail);
        archive.on('progress',p=>{task.job.message=`${p.entries.processed}/${ids.length} arquivos empacotados`;});
        archive.pipe(output);
        sources.forEach((t,i)=>archive.file(t!.file!,{name:`${String(i+1).padStart(3,'0')}-${t!.job.filename}`}));
        void archive.finalize().catch(fail);
      }).then(async()=>{if(controller.signal.aborted)throw new Error('cancelled');const info=await stat(file);task.file=file;task.expiresAt=Date.now()+config.ttl;task.job={id,state:'ready',filename:'potato-dumper-lote.zip',size:info.size,fileToken:task.fileToken,expiresAt:task.expiresAt};})
        .catch(async()=>{archive.abort();output.destroy();task.job={id,state:controller.signal.aborted?'cancelled':'error',message:'Não foi possível montar o ZIP. Baixe os arquivos separadamente.'};await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:200});})
        .finally(()=>{clearTimeout(timer);active--;sources.forEach(t=>t!.activeStreams--);});
      return send(202,task.job);
    }
    const match=path.match(/^\/api\/jobs\/([a-f0-9-]{36})(\/file)?$/);
    if(match){
      const task=jobs.get(match[1]);if(!task || task.expiresAt<Date.now())return send(410,{message:'Arquivo expirado. Analise o link novamente.'});
      if(!match[2]&&task.owner!==owner)return send(404,{message:'Trabalho não encontrado nesta sessão.'});
      if(req.method==='DELETE' && !match[2]){
        task.controller.abort();task.job={id:task.job.id,state:'cancelled'};
        if(!task.activeStreams && task.file)await rm(task.dir,{recursive:true,force:true,maxRetries:3,retryDelay:200});return send(200,task.job);
      }
      if(req.method==='GET' && !match[2])return send(200,task.job);
      if(req.method==='GET' && match[2]){
        const token=new URL(req.url||'/', 'http://local').searchParams.get('token');if(token!==task.fileToken)return send(403,{message:'Link de arquivo inválido.'});
        const fileSession=sessions.get(task.owner);if(!fileSession||fileSession.traffic+(task.job.size||0)>config.maxTraffic)return send(429,{message:'Limite de tráfego da sessão atingido (512 MiB).'});
        if(task.job.state!=='ready'||!task.file)return send(409,{message:'O arquivo ainda não está pronto.'});
        if(streams>=4 || task.activeStreams>=2)return send(429,{message:'Muitas transferências simultâneas. Aguarde e tente novamente.'});
        const filename=task.job.filename||'potato.bin';
        const encoded=encodeURIComponent(filename).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
        res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':task.job.size,'Content-Disposition':`attachment; filename="potato${extname(task.file)}"; filename*=UTF-8''${encoded}`,'Cache-Control':'no-store'});
        fileSession.traffic+=task.job.size||0;task.activeStreams++;streams++;const stream=createReadStream(task.file);stream.on('error',()=>res.destroy());stream.pipe(res);res.on('close',()=>{stream.destroy();task.activeStreams--;streams--;});return;
      }
    }
    return send(404,{message:'Rota não encontrada.'});
  }catch(error){return send(400,{message:error instanceof Error && /Pedido|Use application|Informe|Endereços|Plataforma|Use HTTP/.test(error.message)?error.message:'Pedido inválido ou destino bloqueado. Confira o link.'});}
});
server.requestTimeout=100000;server.headersTimeout=10000;
const cleanup=setInterval(async()=>{
  try{
    const now=Date.now();for(const[id,s]of sessions)if(s.until<now)sessions.delete(id);for(const[id,item]of analyses)if(item.analysis.expiresAt<now)analyses.delete(id);
    for(const[id,task]of jobs)if(task.expiresAt<now && !task.activeStreams){task.controller.abort();await rm(task.dir,{recursive:true,force:true,maxRetries:3,retryDelay:200});jobs.delete(id);}
    // Recover expired orphan directories left behind by an abrupt process exit.
    const tracked=new Set([...jobs.values()].map(task=>task.dir));
    for(const entry of await readdir(config.tempRoot,{withFileTypes:true})){
      if(!entry.isDirectory() || !/^job-[\w-]+$/.test(entry.name))continue;
      const dir=join(config.tempRoot,entry.name);if(tracked.has(dir))continue;
      if((await stat(dir)).mtimeMs<now-config.ttl)await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:200});
    }
  }catch{/* Locked temporary files are retried at the next cleanup cycle. */}
},30000);cleanup.unref();
server.listen(config.port,config.host,()=>console.log(`Potato API http://${config.host}:${config.port} / engine ${online?'online':'offline'}`));
async function shutdown(){for(const task of jobs.values())task.controller.abort();server.close();proxy.close();await Promise.all([...jobs.values()].map(task=>rm(task.dir,{recursive:true,force:true})));process.exit(0);}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
// Do not log URLs, metadata, raw extractor errors, or download capability IDs.
