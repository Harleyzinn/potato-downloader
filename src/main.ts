import './style.css';
import type {Analysis,Media,Mode,Job} from './types.ts';
import {element as $,asciiTitle,bytes,duration,progressBar,terminalIllustration} from './components.ts';
import {apiBase,analyze,getHealth,getJob,request,validateURL} from './service.ts';
import {defaults,loadPreferences,savePreferences} from './preferences.ts';
import {refreshCatalog} from './catalog.ts';
import {isPublicExample} from './presentation.ts';

let prefs=loadPreferences(),analysis:Analysis|undefined,abort:AbortController|undefined,jobId:string|undefined;
let busy=false,poll:ReturnType<typeof setTimeout>|undefined,generation=0;
$('#ascii-title').textContent=asciiTitle();
$('#terminal-art').textContent=terminalIllustration('PRONTO');
document.querySelectorAll('select').forEach(select=>{const shell=document.createElement('span');shell.className='ascii-select';select.before(shell);shell.append(select);});
const input=$<HTMLInputElement>('#media-url');
const format=$<HTMLSelectElement>('#format'),itemSelect=$<HTMLSelectElement>('#media-item'),conversion=$<HTMLSelectElement>('#conversion');
function state(label:string,message:string,options:{error?:boolean;progress?:number;working?:boolean}={}){
  $('#state-label').textContent=label;$('#status').textContent=message;$('#status').classList.toggle('error',Boolean(options.error));
  $('#terminal-art').textContent=terminalIllustration(label);
  $('#indicator').hidden=!options.working;$('#indicator').textContent=progressBar(options.progress);
  const step=/ANALISANDO/.test(label)?1:/MÍDIA DISPONÍVEL/.test(label)?2:/PREPARANDO|TRANSFERINDO/.test(label)?3:/ARQUIVO PREPARADO|DOWNLOAD INICIADO/.test(label)?4:0;
  document.querySelectorAll<HTMLElement>('#pipeline [data-step]').forEach(node=>{node.classList.toggle('step-current',Number(node.dataset.step)===step);if(Number(node.dataset.step)===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
}
function lock(value:boolean){busy=value;$<HTMLButtonElement>('#analyze-button').disabled=value;$<HTMLButtonElement>('#prepare').disabled=value;input.disabled=value;$<HTMLButtonElement>('#paste').disabled=value;$<HTMLButtonElement>('#clear').disabled=value;$('#media-panel').inert=value;$('#cancel').hidden=!value;}
function resetResults(){analysis=undefined;$('#media-panel').hidden=true;$('#save-file').hidden=true;$('#transfer-note').hidden=true;$('#retry').hidden=true;}
function navigate(){const page=['baixar','ajustes','ajuda','fontes'].includes(location.hash.slice(1))?location.hash.slice(1):'baixar';document.querySelectorAll<HTMLElement>('.page').forEach(node=>node.hidden=node.id!==page);document.querySelectorAll<HTMLAnchorElement>('[data-page]').forEach(node=>{if(node.dataset.page===page)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});$('#breadcrumb').textContent=`~/potato/${page}`;document.title=`Potato Dumper / ${page}`;}
window.addEventListener('hashchange',navigate);navigate();
function preferenceUI(){
  $<HTMLSelectElement>('#pref-mode').value=prefs.mode;$<HTMLSelectElement>('#pref-quality').value=prefs.quality;$<HTMLSelectElement>('#pref-audio').value=prefs.audioFormat;$<HTMLInputElement>('#pref-motion').checked=prefs.reducedMotion;document.body.classList.toggle('no-motion',prefs.reducedMotion);
}
preferenceUI();
$('#preferences-form').addEventListener('submit',event=>{event.preventDefault();prefs={mode:$<HTMLSelectElement>('#pref-mode').value as Mode,quality:$<HTMLSelectElement>('#pref-quality').value,audioFormat:$<HTMLSelectElement>('#pref-audio').value,reducedMotion:$<HTMLInputElement>('#pref-motion').checked};preferenceUI();$('#pref-status').textContent=savePreferences(prefs)?'[ok] Preferências salvas apenas neste navegador.':'[!] Ajustes aplicados nesta sessão; armazenamento bloqueado.';if(analysis)renderMedia();});
$('#reset').addEventListener('click',()=>{prefs={...defaults};savePreferences(prefs);preferenceUI();$('#pref-status').textContent='[ok] Configurações padrão restauradas.';if(analysis)renderMedia();});
$('#backend-description').textContent=apiBase ? `Serviço de download: ${apiBase}` : 'Nenhum motor foi conectado a esta publicação. Configure VITE_API_URL e publique novamente.';
async function health(){
  $('#health-button').textContent='[?] verificando motor';
  try{
    const data=await getHealth();if(!data.online)throw new Error('O serviço respondeu, mas yt-dlp ou ffmpeg não está disponível.');
    $('#health-button').textContent='[*] motor conectado';$('#platform-list').replaceChildren();
    for(const name of data.platforms.filter(isPublicExample)){const span=document.createElement('span');span.className='chip';span.textContent=name;$('#platform-list').append(span);}
    void refreshCatalog();
    $('#service-notice').hidden=!data.temporary;
    $('#service-notice').textContent='[!] Motor temporário: funciona enquanto o computador e o túnel estiverem ligados. Os links não são armazenados no navegador.';
  }catch(error){$('#health-button').textContent='[!] motor desconectado';$('#platform-list').textContent='Lista indisponível até conectar o motor.';$('#service-notice').hidden=false;$('#service-notice').textContent=`[!] ${error instanceof Error?error.message:'Motor indisponível.'} O frontend está pronto; downloads precisam do serviço conectado.`;}
}
$('#health-button').addEventListener('click',()=>void health());$('#reconnect').addEventListener('click',()=>void health());void health();
$('#paste').addEventListener('click',async()=>{try{input.value=(await navigator.clipboard.readText()).trim();input.dispatchEvent(new Event('input'));input.focus();}catch{state('ÁREA DE TRANSFERÊNCIA','O navegador não permitiu colar. Use Ctrl+V ou toque e segure no campo.');input.focus();}});
$('#clear').addEventListener('click',()=>{input.value='';input.dispatchEvent(new Event('input'));input.focus();});
input.addEventListener('input',()=>{$('#url-error').hidden=true;input.removeAttribute('aria-invalid');if(!busy)resetResults();});
function currentMedia():Media|undefined{return analysis?.items.find(item=>item.id===itemSelect.value);}
function selectedMode():Mode{return $<HTMLInputElement>('[name=mode]:checked').value as Mode;}
function updateFormats(){
  const media=currentMedia();if(!media)return;
  const mode=selectedMode();const hasVideo=media.formats.some(f=>f.mode==='video');
  const choices=media.formats.filter(f=>mode==='auto'?f.mode===(hasVideo?'video':'audio'):f.mode===mode);
  format.replaceChildren(...choices.map(f=>new Option(f.label,f.id)));
  if(prefs.quality!=='max'){
    const acceptable=choices.find(f=>f.mode==='audio'||Number(f.label.match(/^(\d+)p/)?.[1]||0)<=Number(prefs.quality));if(acceptable)format.value=acceptable.id;
  }
  updateSize();
}
function updateSize(){
  const selected=currentMedia()?.formats.find(f=>f.id===format.value);if(!selected)return;
  $('#conversion-label').hidden=selected.mode!=='audio';conversion.disabled=selected.mode!=='audio';conversion.value=selected.mode==='audio'?prefs.audioFormat:'original';
  $('#size-hint').textContent=selected.size?`${selected.estimated?'Tamanho estimado da origem':'Tamanho informado pela origem'}: ${bytes(selected.size)}. Conversões podem alterar o tamanho final.`:'O tamanho final será conhecido após a preparação. Limite: 100 MiB.';
}
function renderMedia(){
  const media=currentMedia();if(!media)return;
  $('#media-title').textContent=media.title;
  $('#media-metadata').textContent=[media.source?`[>] Extrator: ${media.source}`:'',media.author?`Autoria: ${media.author}`:'',media.duration?`Duração: ${duration(media.duration)}`:''].filter(Boolean).join(' / ')||'A origem não informou autoria ou duração.';
  document.querySelectorAll<HTMLInputElement>('[name=mode]').forEach(radio=>{radio.disabled=radio.value!=='auto'&&!media.formats.some(f=>f.mode===radio.value);radio.checked=radio.value===prefs.mode;});
  if($<HTMLInputElement>('[name=mode]:checked').disabled)$<HTMLInputElement>('[name=mode][value=auto]').checked=true;
  updateFormats();
}
itemSelect.addEventListener('change',()=>{if(!busy)renderMedia();});format.addEventListener('change',updateSize);
document.querySelectorAll<HTMLInputElement>('[name=mode]').forEach(radio=>radio.addEventListener('change',updateFormats));
$('#analyze-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  let url:string;try{url=validateURL(input.value);}catch(error){$('#url-error').textContent=(error as Error).message;$('#url-error').hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;}
  resetResults();lock(true);abort=new AbortController();const timeout=setTimeout(()=>abort?.abort('timeout'),95000);
  const active=abort;state('ANALISANDO','Consultando a origem e os formatos disponíveis...',{working:true});
  try{
    analysis=await analyze(url,active.signal);itemSelect.replaceChildren(...analysis.items.map((item,i)=>new Option(`[${String(i+1).padStart(2,'0')}] ${item.title}`,item.id)));
    $('#media-panel').hidden=false;renderMedia();state('MÍDIA DISPONÍVEL',`${analysis.items.length} mídia(s) encontrada(s). Escolha o formato e prepare o arquivo.`);$('#media-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches||prefs.reducedMotion?'instant':'smooth',block:'start'});
  }catch(error){state(active.signal.aborted?'CANCELADO':'FALHA NA ANÁLISE',active.signal.aborted?(active.signal.reason==='timeout'?'Tempo limite atingido. Tente novamente.':'Análise cancelada.'):(error as Error).message,{error:!active.signal.aborted});$('#retry').hidden=false;}
  finally{clearTimeout(timeout);abort=undefined;lock(false);}
});
$('#retry').addEventListener('click',()=>{$('#retry').hidden=true;$<HTMLFormElement>('#analyze-form').requestSubmit();});
async function cancel(){generation++;if(poll)clearTimeout(poll);abort?.abort();if(jobId){const id=jobId;jobId=undefined;try{await request(`/jobs/${id}`,{method:'DELETE'});}catch{/* The task also expires on the server. */}}lock(false);$('#save-file').hidden=true;state('CANCELADO','Operação cancelada. Você pode tentar novamente.');}
$('#cancel').addEventListener('click',()=>void cancel());
$('#new-download').addEventListener('click',async()=>{await cancel();resetResults();input.value='';input.focus();state('PRONTO','Cole outro link para começar.');});
function fileReady(job:Job){
  lock(false);state('ARQUIVO PREPARADO',`[ok] ${job.filename||'Arquivo'}${job.size?` / ${bytes(job.size)}`:''}. Clique abaixo para iniciar o download.`);
  const link=$<HTMLAnchorElement>('#save-file');link.href=`${apiBase}/api/jobs/${encodeURIComponent(job.id)}/file`;link.download=job.filename||'potato';link.referrerPolicy='no-referrer';link.hidden=false;
  $('#transfer-note').textContent='O navegador assume a transferência. O Potato não confirma se o arquivo foi salvo. Arquivo temporário: 15 minutos.';$('#transfer-note').hidden=false;
}
$('#save-file').addEventListener('click',()=>{state('DOWNLOAD INICIADO','Download iniciado pelo navegador. Acompanhe o gerenciador de downloads.');});
async function monitor(id:string,version:number){
  try{
    const job=await getJob(id);if(version!==generation)return;
    if(job.state==='ready')return fileReady(job);
    if(job.state==='error'||job.state==='cancelled'){lock(false);state(job.state==='error'?'FALHA':'CANCELADO',job.message||'Operação cancelada.',{error:job.state==='error'});$('#retry').hidden=false;return;}
    state(job.state==='downloading'?'TRANSFERINDO PARA O SERVIDOR':'PREPARANDO ARQUIVO',job.state==='downloading'?'Recebendo a mídia no servidor. O percentual, quando disponível, corresponde ao arquivo de origem.':'Preparando ou convertendo o arquivo no servidor...',{working:true,progress:job.progress});
    poll=setTimeout(()=>void monitor(id,version),1200);
  }catch(error){if(version!==generation)return;lock(false);state('CONEXÃO INTERROMPIDA',(error as Error).message,{error:true});$('#retry').hidden=false;}
}
$('#prepare').addEventListener('click',async()=>{
  if(busy||!analysis||!currentMedia())return;lock(true);$('#save-file').hidden=true;$('#transfer-note').hidden=true;$('#retry').hidden=true;
  const version=++generation;state('PREPARANDO','Solicitando preparação do arquivo...',{working:true});abort=new AbortController();
  try{
    const job=await request<Job>('/jobs',{method:'POST',signal:abort.signal,body:JSON.stringify({analysisId:analysis.id,itemId:itemSelect.value,formatId:format.value,conversion:conversion.disabled?'original':conversion.value})});
    if(version!==generation){void request(`/jobs/${job.id}`,{method:'DELETE'});return;}jobId=job.id;void monitor(job.id,version);
  }catch(error){lock(false);state('FALHA AO PREPARAR',(error as Error).message,{error:true});$('#retry').hidden=false;}finally{abort=undefined;}
});
function clock(){$('#clock').textContent=new Date().toLocaleTimeString('pt-BR');}clock();setInterval(clock,1000);
// Preferences are the only browser storage. Links, metadata and job IDs stay in memory.
