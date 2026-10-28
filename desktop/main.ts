import {app,BrowserWindow,ipcMain,dialog,shell,Menu,type IpcMainInvokeEvent} from 'electron';
import {fork,type ChildProcess} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,realpath,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stat} from 'node:fs/promises';
import {SavedDestinations} from './destinations.ts';
import {randomBytes} from 'node:crypto';
import {prepareEngines,enginesReady} from './engines.ts';
import {safeName,uniqueDestination,writeDownload} from './files.ts';
import {publicError} from '../backend/errors.ts';

app.setName('Batatubo');
const data=join(app.getPath('appData'),'Batatubo');app.setPath('userData',data);
const index=join(__dirname,'../dist-desktop/index.html'),setup=join(__dirname,'../desktop/setup.html');
let window:BrowserWindow,backend:ChildProcess|undefined,apiBase='',starting:Promise<void>|undefined,quitting=false,closing=false;
const token=randomBytes(32).toString('hex'),abort=new AbortController(),transfers=new Map<string,AbortController>();
const writes=new Set<Promise<unknown>>(),savedDestinations=new SavedDestinations();
const engineFolder=join(data,'engines'),work=join(data,'work');let folder=app.getPath('downloads');
function trusted(event:{senderFrame:Electron.WebFrameMain|null;sender:Electron.WebContents}){const url=event.senderFrame?.url.split('#')[0];if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||![pathToFileURL(index).href,pathToFileURL(setup).href].includes(url||''))throw Error('untrusted IPC');}
function uiOnly(event:{senderFrame:Electron.WebFrameMain|null;sender:Electron.WebContents}){trusted(event);if(event.senderFrame?.url.split('#')[0]!==pathToFileURL(index).href)throw Error('UI unavailable');}
function send(channel:string,data:unknown){if(window&&!window.isDestroyed())window.webContents.send(channel,data);}
async function start(){if(starting)return starting;starting=(async()=>{
  send('setup-progress',{message:'[ATIVO] Conferindo dependências locais...',bytes:0});await prepareEngines(engineFolder,d=>send('setup-progress',d),abort.signal);await mkdir(work,{recursive:true});
  backend=fork(join(__dirname,'backend.mjs'),[],{execPath:process.execPath,windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PORT:'0',HOST:'127.0.0.1',TEMP_ROOT:work,TMPDIR:work,YTDLP_PATH:join(engineFolder,'yt-dlp.exe'),FFMPEG_PATH:join(engineFolder,'ffmpeg.exe'),ALLOWED_ORIGINS:'null',DESKTOP_TOKEN:token,TEMPORARY_HOST:'0'}});
  const service=backend;await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('engine startup timed out')),60000);service.once('exit',()=>{clearTimeout(timeout);reject(Error('engine exited'));});service.on('message',message=>{const value=message as {type:string;port:number;online:boolean};if(value.type==='ready'){clearTimeout(timeout);if(!value.online){reject(Error('engine unavailable'));return;}apiBase=`http://127.0.0.1:${value.port}`;resolve();}});});
  await window.loadFile(index);
})().catch(error=>{backend?.send('shutdown');backend?.kill();backend=undefined;starting=undefined;throw error;});return starting;}
async function stop(){quitting=true;abort.abort();for(const controller of transfers.values())controller.abort();await Promise.allSettled([...writes,...(!apiBase&&starting?[starting]:[])]);if(backend?.connected)backend.send('shutdown');await new Promise<void>(resolve=>{if(!backend||backend.exitCode!==null)return resolve();const timer=setTimeout(()=>{backend?.kill();resolve();},7000);backend.once('exit',()=>{clearTimeout(timer);resolve();});});await rm(work,{recursive:true,force:true,maxRetries:3,retryDelay:200}).catch(()=>{});app.quit();}
async function close(){if(closing||quitting)return;closing=true;let active=transfers.size>0||Boolean(starting&&!apiBase);try{if(apiBase){const status=await fetch(apiBase+'/api/desktop/activity',{headers:{'X-Batatubo-Desktop':token},signal:AbortSignal.timeout(2000)}).then(r=>r.json()) as {active:number};active ||= status.active>0;}}catch{active=true;}
  if(active){const result=await dialog.showMessageBox(window,{type:'question',title:'Batatubo / tarefas ativas',message:'Há tarefas ou transferências em andamento.',detail:'Fechar cancela os trabalhos locais e remove arquivos parciais. Os downloads já concluídos serão preservados.',buttons:['Continuar no aplicativo','Cancelar tarefas e fechar'],defaultId:0,cancelId:0});if(result.response===0){closing=false;return;}}await stop();}
function handle(name:string,fn:(event:IpcMainInvokeEvent,...args:unknown[])=>unknown){ipcMain.handle(name,(event,...args)=>{uiOnly(event);const operation=Promise.resolve(fn(event,...args));if(name==='save'){writes.add(operation);void operation.finally(()=>writes.delete(operation)).catch(()=>{});}return operation;});}
ipcMain.on('runtime',event=>{try{trusted(event);event.returnValue={apiBase,token};}catch{event.returnValue=null;}});
ipcMain.handle('prepare-engine',event=>{trusted(event);return start();});
handle('folder',()=>folder);
handle('choose-folder',async()=>{const result=await dialog.showOpenDialog(window,{defaultPath:folder,properties:['openDirectory','createDirectory']});if(!result.canceled&&result.filePaths[0]){const chosen=await realpath(result.filePaths[0]);if(chosen===data||chosen.startsWith(data+'\\'))throw Error('Use uma pasta fora dos dados internos do aplicativo.');folder=chosen;await writeFile(join(data,'preferences.json'),JSON.stringify({folder}));}return folder;});
handle('open-folder',async()=>{const error=await shell.openPath(folder);if(error)throw Error('Folder unavailable');});
handle('show-saved',async(_event,id)=>{const file=savedDestinations.find(id);if(!file||!(await stat(file)).isFile())throw Error('Arquivo não encontrado. Ele pode ter sido movido.');shell.showItemInFolder(file);});
handle('list-folder',async()=>(await readdir(folder)).sort().slice(0,100));
handle('cancel-transfer',(_event,id)=>{if(typeof id==='string')transfers.get(id)?.abort();});
handle('export-report',async(_event,text)=>{if(typeof text!=='string'||text.length>65536||/https?:\/\/|file:|[A-Z]:\\/i.test(text))throw Error('Unsafe report');const result=await dialog.showSaveDialog(window,{defaultPath:join(folder,'batatubo-diagnostico.json'),filters:[{name:'JSON',extensions:['json']}]});if(result.filePath)await writeFile(result.filePath,text,{flag:'w'});});
handle('save',async(_event,id,capability)=>{
  if(typeof id!=='string'||!/^[-\w]{36}$/.test(id)||typeof capability!=='string'||!/^[a-f0-9]{64}$/.test(capability))throw Error('Invalid file capability');if(transfers.has(id))return;if(transfers.size>=2)throw Error('Two transfers already active');
  const destinationFolder=folder;const controller=new AbortController();transfers.set(id,controller);let received=0,filename='arquivo',total:number|undefined;const started=Date.now();let last=0;let idle:ReturnType<typeof setTimeout>|undefined;
  const notify=(state:string,message?:string)=>send('transfer',{id,state,filename,bytes:received,total,speed:received/Math.max(1,(Date.now()-started)/1000),message});
  try{const url=`${apiBase}/api/jobs/${id}/file?token=${capability}`;const head=await fetch(url,{method:'HEAD',headers:{'X-Batatubo-Desktop':token},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(!head.ok)throw Error('Arquivo não disponível. Prepare outra cópia.');
    const disposition=head.headers.get('content-disposition')||'';filename=safeName(decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]||disposition.match(/filename="([^"]+)"/)?.[1]||'batatubo-arquivo'));total=Number(head.headers.get('content-length'))||undefined;
    const destination=await uniqueDestination(destinationFolder,filename);if(destination.renamed){const result=await dialog.showMessageBox(window,{type:'question',title:'Arquivo existente',message:`${filename} já existe.`,detail:`Salvar uma nova cópia como ${safeName(destination.file)}? O arquivo existente será preservado.`,buttons:['Salvar nova cópia','Cancelar'],defaultId:0,cancelId:1});if(result.response===1){controller.abort();throw Error('cancelled');}}
    filename=safeName(destination.file);const renew=()=>{clearTimeout(idle);idle=setTimeout(()=>controller.abort(),300000);};renew();const response=await fetch(url,{headers:{'X-Batatubo-Desktop':token},signal:controller.signal});notify('writing');await writeDownload(response,destination.file,controller.signal,count=>{renew();received=count;if(Date.now()-last>150){last=Date.now();notify('writing');}});savedDestinations.remember(id,destination.file);notify('saved');
  }catch(error){notify(controller.signal.aborted?'cancelled':'error',publicError(String(error)));}finally{clearTimeout(idle);transfers.delete(id);}
});
if(!app.requestSingleInstanceLock())app.quit();else{
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
app.whenReady().then(async()=>{await mkdir(data,{recursive:true});try{const value=JSON.parse(await readFile(join(data,'preferences.json'),'utf8'));if(typeof value.folder==='string')folder=await realpath(value.folder);}catch{/* Default Downloads folder. */}
  Menu.setApplicationMenu(null);window=new BrowserWindow({width:1200,height:850,minWidth:440,minHeight:600,title:'Batatubo',backgroundColor:'#16130f',webPreferences:{preload:join(__dirname,'../desktop/preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  window.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  window.webContents.session.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http://127.0.0.1:* https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'none'"]}}));
  window.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\/(github\.com|ffmpeg\.org|www\.electronjs\.org)\//.test(url))void shell.openExternal(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(![pathToFileURL(index).href,pathToFileURL(setup).href].includes(url.split('#')[0])){event.preventDefault();if(/^https:\/\/(github\.com|ffmpeg\.org)\//.test(url))void shell.openExternal(url);}});
  window.webContents.session.on('will-download',event=>event.preventDefault());
  window.on('close',event=>{if(!quitting){event.preventDefault();void close();}});await window.loadFile(setup);window.show();if(await enginesReady(engineFolder))void start().catch(()=>send('setup-progress',{message:'[ERRO] Motor indisponível. Tente preparar novamente.',bytes:0}));
}).catch(()=>{dialog.showErrorBox('Batatubo','Não foi possível iniciar. Verifique permissões e espaço disponível.');void stop();});
app.on('before-quit',event=>{if(!quitting){event.preventDefault();void close();}});
}
