import type {Analysis,Discovery,DiscoveryItem,Job,Media,Mode} from './types.ts';
import {element as $,bytes,duration,progressBar} from './components.ts';
import {analyze,fileURL,getJob,request,ServiceError,validateURL} from './service.ts';
import {chooseFormat,itemBar,parseRange,uniqueURLs,nextWork,movePending,needsMonitoring} from './batch-model.ts';
type Preview=DiscoveryItem&{key:string;selected:boolean;analysis?:Analysis;media?:Media;formatId?:string;conversion:string;error?:string;duplicate?:boolean};
type QueueItem={id:string;url:string;index:number;title:string;state:string;message?:string;analysis?:Analysis;media?:Media;formatId:string;conversion:string;job?:Job;controller?:AbortController;attempts:number;numbering:boolean;nextPoll?:number};
const labels:Record<string,string>={waiting:'[FILA] Aguardando',analyzing:'[ATIVO] Analisando',preparing:'[ATIVO] Preparando',downloading:'[ATIVO] Baixando para o servidor',processing:'[ATIVO] Convertendo / combinando',packing:'[ATIVO] Compactando',sent:'[OK] Envio encerrado pelo servidor; gravação não confirmada',archived:'[ZIP] Incluído no pacote; original removido',ready:'[OK] Pronto para baixar',browser:'[OK] Download iniciado no navegador',error:'[ERRO] Falhou',cancelled:'[X] Cancelado'};
const terminal=new Set(['ready','browser','sent','archived','error','cancelled']);
let preview:Preview[]=[],queue:QueueItem[]=[],nextPage:number|undefined,discoveryURL='',scope='auto',discovering=false,checking=false,paused=true,processing=false,timer:ReturnType<typeof setTimeout>|undefined,discoverAbort:AbortController|undefined;
let forgetLocal=false,zipVersion=0;
let currentPage=1,zipJob:Job|undefined,zipBusy=false,zipTimer:ReturnType<typeof setTimeout>|undefined;
const pageSize=10,maxBatch=20,prefsKey='potato.v3.batch-preferences',historyKey='potato.v3.optional-queue';
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const button=(text:string,action:()=>void)=>{const b=node('button',text);b.type='button';b.className='quiet';b.addEventListener('click',action);return b;};
const say=(message:string)=>{$('#batch-status').textContent=message;};
const select=(id:string)=>$<HTMLSelectElement>(id);
function prefs(){return {mode:select('#batch-mode').value as Mode,quality:select('#batch-quality').value,conversion:select('#batch-audio').value,numbering:$<HTMLInputElement>('#batch-number').checked};}
function save(){if(forgetLocal)return;try{localStorage.setItem(prefsKey,JSON.stringify(prefs()));if($<HTMLInputElement>('#batch-history').checked)localStorage.setItem(historyKey,JSON.stringify({links:$<HTMLTextAreaElement>('#batch-urls').value,queue:queue.filter(x=>!['cancelled','browser'].includes(x.state)).map(x=>({url:x.url,title:x.title,index:x.index})).slice(0,maxBatch)}));else localStorage.removeItem(historyKey);}catch{say('Armazenamento bloqueado. Dados permanecem apenas nesta página.');}}
function switchMode(batch:boolean){$('#batch-workbench').hidden=!batch;$('#single-entry').hidden=batch;if(batch)$('#media-panel').hidden=true;$('#batch-toggle').setAttribute('aria-pressed',String(batch));$('#single-toggle').setAttribute('aria-pressed',String(!batch));}
export async function inspectSingle(url:string,signal:AbortSignal):Promise<boolean>{
  const data=await request<Discovery>('/discover',{method:'POST',body:JSON.stringify({url}),signal});
  $('#explore-existing').hidden=!data.videoInPlaylist;
  if(data.videoInPlaylist)$('#explore-existing').onclick=()=>{switchMode(true);$<HTMLTextAreaElement>('#batch-urls').value=url;select('#batch-scope').value='playlist';void discoverLinks();};
  if(!data.playlist)return false;
  switchMode(true);preview=[];appendDiscovery(data);discoveryURL=url;nextPage=data.next;$<HTMLTextAreaElement>('#batch-urls').value=url;metadata(data);renderPreview();say('Playlist detectada. Selecione os itens; nenhum download foi iniciado.');return true;
}
function metadata(data:Discovery){$('#playlist-description').textContent=[data.playlist?'[PLAYLIST]':'[LINK]',data.title,data.author?`Autoria: ${data.author}`:'',data.total?`${data.total} itens na origem`:'Total desconhecido',data.duration!==undefined?`Duração total: ${duration(data.duration)}`:'Duração total indisponível',data.incomplete?'Listagem parcial; a disponibilidade será conferida por item.':'Listagem recebida.'].filter(Boolean).join(' / ');}
function appendDiscovery(data:Discovery){for(const item of data.items){if(preview.length>=200)break;const duplicate=!!item.url&&preview.some(p=>p.url===item.url||(item.identity&&p.identity===item.identity));preview.push({...item,index:preview.length+1,key:crypto.randomUUID(),selected:false,conversion:'original',duplicate,error:duplicate?'Duplicado; não será adicionado novamente.':undefined});}}
async function discoverLinks(more=false){
  if(discovering||checking)return;discovering=true;discoverAbort=new AbortController();$('#discover-cancel').hidden=false;$<HTMLButtonElement>('#batch-discover').disabled=true;
  try{
    const input=uniqueURLs($<HTMLTextAreaElement>('#batch-urls').value.split(/\r?\n/),validateURL);
    if(input.errors.length)throw new Error(input.errors.join(' '));if(!input.urls.length)throw new Error('Informe pelo menos um endereço.');if(input.urls.length>20)throw new Error('Use até 20 links de entrada.');
    if(!more){preview=[];currentPage=1;nextPage=undefined;renderPreview();}scope=select('#batch-scope').value;
    const urls=more?[discoveryURL]:input.urls;say('[ | ] Consultando metadados; nenhum arquivo está sendo baixado.');
    for(const url of urls){
      try{const data=await request<Discovery>('/discover',{method:'POST',body:JSON.stringify({url,scope,start:more?nextPage:1}),signal:discoverAbort.signal});appendDiscovery(data);metadata(data);if(urls.length===1){discoveryURL=url;nextPage=data.next;}else if(data.next)say('Uma playlist contém mais itens. Analise esse endereço separadamente para carregar as próximas páginas.');}
      catch(error){if(discoverAbort.signal.aborted)throw error;preview.push({key:crypto.randomUUID(),index:preview.length+1,title:'Link indisponível',url,selected:false,availability:'unavailable',reason:(error as Error).message,conversion:'original'});}
      renderPreview();
    }
    say(`[OK] ${preview.length} itens listados; ${input.duplicates} links repetidos ignorados. Selecione e confira os formatos antes de iniciar.`);save();
  }catch(error){say(discoverAbort.signal.aborted?'[X] Listagem cancelada.':`[ERRO] ${(error as Error).message}`);}
  finally{discovering=false;$('#discover-cancel').hidden=true;$<HTMLButtonElement>('#batch-discover').disabled=false;renderPreview();}
}
function filtered(){const q=$<HTMLInputElement>('#batch-search').value.toLocaleLowerCase('pt-BR'),state=select('#batch-filter').value;return preview.filter(x=>x.title.toLocaleLowerCase('pt-BR').includes(q)&&(state==='all'||(state==='selected'?x.selected:state==='available'?x.availability==='pending'&&!x.duplicate:x.availability==='unavailable'||!!x.error)));}
function eligible(x:Preview){return x.availability!=='unavailable'&&!x.duplicate;}
function renderPreview(){
  const list=$('#playlist-items');list.replaceChildren();const results=filtered(),pages=Math.max(1,Math.ceil(results.length/pageSize));currentPage=Math.min(currentPage,pages);
  for(const item of results.slice((currentPage-1)*pageSize,currentPage*pageSize)){
    const card=node('article');card.className='batch-card';const label=node('label');label.className='check';const check=node('input');check.type='checkbox';check.checked=item.selected;check.disabled=!eligible(item)||checking;check.addEventListener('change',()=>{item.selected=check.checked;renderSummary();});label.append(check,node('span',`[${String(item.index).padStart(3,'0')}] ${item.title}`));card.append(label);
    card.append(node('p',`${item.duration!==undefined?duration(item.duration):'Duração desconhecida'} / ${item.error||item.reason||(item.media?'[OK] Formatos verificados':'[?] Disponibilidade a verificar')}`));
    if(item.media){
      const field=node('label','Formato deste item');const options=node('select');options.setAttribute('aria-label',`Formato do item ${item.index}`);options.append(new Option('Escolha um formato disponível',''));for(const f of item.media.formats)options.append(new Option(`[${f.ext.toUpperCase()}] ${f.label}`,f.id));options.value=item.formatId||'';
      options.addEventListener('change',()=>{item.formatId=options.value;item.error=undefined;if(!item.media?.formats.find(f=>f.id===options.value&&f.mode==='audio'))item.conversion='original';renderPreview();document.querySelector<HTMLSelectElement>(`[aria-label="Formato do item ${item.index}"]`)?.focus();});const shell=node('span');shell.className='ascii-select';shell.append(options);field.append(shell);card.append(field);
      if(item.media.formats.find(f=>f.id===item.formatId)?.mode==='audio'){
        const output=node('label','Saída de áudio');const conversion=node('select');conversion.setAttribute('aria-label',`Saída de áudio do item ${item.index}`);for(const value of ['original','mp3','opus','wav'])conversion.append(new Option(value==='original'?'Original / extrair áudio':value.toUpperCase(),value));conversion.value=item.conversion;conversion.addEventListener('change',()=>{item.conversion=conversion.value;renderSummary();});const shell=node('span');shell.className='ascii-select';shell.append(conversion);output.append(shell);card.append(output);
      }
    }list.append(card);
  }
  if(!results.length)list.append(node('p','[ . . . ] Nenhum item nesta seleção.'));
  $('#batch-page').textContent=`[${currentPage}/${pages}] ${results.length} itens no filtro`;$<HTMLButtonElement>('#batch-prev').disabled=currentPage<=1;$<HTMLButtonElement>('#batch-next').disabled=currentPage>=pages;
  $('#batch-more').hidden=!nextPage;$<HTMLButtonElement>('#batch-more').disabled=discovering;renderSummary();
}
function renderSummary(){
  const chosen=preview.filter(x=>x.selected),valid=chosen.filter(x=>x.analysis&&x.formatId&&!x.error&&!x.duplicate),formats=valid.map(x=>x.media!.formats.find(f=>f.id===x.formatId)!);
  const known=chosen.length>0&&formats.length===chosen.length&&formats.every((f,i)=>f?.size&&valid[i].conversion==='original');
  $('#batch-summary').textContent=`[${chosen.length} selecionados / ${valid.length} verificados] ${known?`${formats.some(f=>f.estimated)?'Estimativa da origem':'Tamanho informado da origem'}: ${bytes(formats.reduce((n,f)=>n+f.size!,0))}`:'Tamanho total indisponível; conversões e combinação podem alterar o total.'} Até 20 itens por lote.`;
  $<HTMLButtonElement>('#batch-enqueue').disabled=!chosen.length||valid.length!==chosen.length||checking;
}
async function checkSelection(){
  if(checking||discovering)return;const chosen=preview.filter(x=>x.selected);if(!chosen.length||chosen.length>maxBatch){say('Selecione de 1 a 20 itens por lote.');return;}
  checking=true;discoverAbort=new AbortController();$('#discover-cancel').hidden=false;renderPreview();const settings=prefs(),identities=new Set<string>();
  try{
    for(const item of chosen){
      if(!item.url)continue;say(`[ | ] Conferindo formatos do item ${item.index}. Nenhum download iniciado.`);
      try{const result=await analyze(item.url,discoverAbort.signal),media=result.items[0];item.analysis=result;item.media=media;item.title=media.title;item.duration=media.duration;item.identity=media.identity;item.error=undefined;
        if(media.identity&&identities.has(media.identity)){item.duplicate=true;item.selected=false;item.error='Mesmo identificador de outro item; duplicação ignorada.';continue;}
        if(media.identity)identities.add(media.identity);
        const format=chooseFormat(media,settings.mode,settings.quality);item.formatId=format?.id;item.conversion=format?.mode==='audio'?settings.conversion:'original';if(!format)item.error='Preferência sem formato compatível. Escolha uma alternativa deste item ou desmarque-o.';
      }catch(error){if(discoverAbort.signal.aborted)throw error;item.error=(error as Error).message;item.analysis=undefined;}
      renderPreview();
    }say('[OK] Conferência terminada. Revise o resumo e os formatos; desmarque falhas ou escolha alternativas.');
  }catch{say('[X] Conferência cancelada. Os resultados recebidos foram preservados.');}
  finally{checking=false;$('#discover-cancel').hidden=true;renderPreview();}
}
function renderQueue(){
  const list=$('#queue-items'),focused=document.activeElement?.getAttribute('data-focus');list.replaceChildren();
  for(const item of queue){
    const card=node('article');card.className=`batch-card queue-${item.state}`;card.append(node('h3',`[${String(item.index).padStart(3,'0')}] ${item.title}`),node('p',labels[item.state]||item.state));
    if(!terminal.has(item.state)){
      const bar=node('div');bar.className='ascii-progress';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label',`Preparação no servidor: ${item.title}`);bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');
      if(item.state!=='waiting'){const spinner=node('span');spinner.className='ascii-spinner';spinner.setAttribute('aria-hidden','true');card.append(spinner);}
      const percent=item.state==='downloading'?item.job?.progress:undefined;bar.textContent=percent===undefined?'[    <==>            ] etapa sem percentual':progressBar(percent);if(percent!==undefined){bar.setAttribute('aria-valuenow',String(percent));bar.setAttribute('aria-valuetext',`${percent}% da faixa atual; processamento ainda pendente`);}else bar.setAttribute('aria-valuetext',labels[item.state]||item.state);card.append(bar);
      const job=item.job;if(job?.state==='downloading')card.append(node('p',[job.downloaded!==undefined?`${bytes(job.downloaded)} recebidos`:'',job.total?`de ${bytes(job.total)} da faixa`:'total desconhecido',job.speed?`${bytes(job.speed)}/s`:'',job.eta!==undefined?`restante da faixa: ~${duration(job.eta)}`:''].filter(Boolean).join(' | ')));
    }
    if(item.message)card.append(node('p',item.message));
    const actions=node('div');actions.className='batch-actions';
    if(item.state==='waiting'){for(const [text,direction]of [['[ ^ subir ]',-1],['[ v descer ]',1]] as const){const b=button(text,()=>move(item,direction));b.dataset.focus=item.id+direction;b.disabled=queue[queue.indexOf(item)+direction]?.state!=='waiting';actions.append(b);}}
    if(!['cancelled','error','sent','archived'].includes(item.state)){const cancel=button('[ cancelar item ]',()=>void cancelItem(item));cancel.dataset.focus=item.id+'cancel';actions.append(cancel);}
    if(['sent','archived'].includes(item.state))actions.append(button('[ Preparar outra cópia ]',()=>{item.state='waiting';item.job=undefined;item.analysis=undefined;item.id=crypto.randomUUID();item.attempts=0;item.message='Uma nova cópia será preparada. Retome a fila se estiver pausada.';renderQueue();save();if(!paused)void pump();}));
    if(['ready','browser'].includes(item.state)&&item.job){const link=node('a','[ Baixar arquivo -> ]');link.dataset.focus=item.id+'file';link.className='primary';link.href=fileURL(item.job);link.download=item.job.filename||'potato';link.referrerPolicy='no-referrer';link.addEventListener('click',event=>{if((item.job?.expiresAt||0)<Date.now()){event.preventDefault();void getJob(item.job!.id).then(job=>{if(item.state==='cancelled')return;item.job=job;item.state=job.state;item.message=job.state==='ready'?'Disponibilidade renovada; clique em baixar novamente.':job.message;renderQueue();}).catch(error=>{item.state='error';item.message=(error as Error).message;renderQueue();});return;}item.state='browser';item.message='O navegador assumiu a transferência. A cópia será removida após envio completo; gravação não confirmada.';renderQueue();save();void pump();});actions.append(link);card.append(node('p',`${item.job.filename} / ${bytes(item.job.size||0)} / disponível até ${new Date(item.job.expiresAt||Date.now()).toLocaleTimeString('pt-BR')}`));}
    card.append(actions);list.append(card);
  }
  if(!queue.length){const art=node('pre','   .---.\n  / . o \\    [ caixa vazia ]\n  \\____/     selecione sua colheita');art.setAttribute('aria-hidden','true');list.append(art,node('p','Nenhum item na fila.'));}
  const finished=queue.filter(x=>terminal.has(x.state)).length;$('#queue-bar').textContent=itemBar(finished,queue.length);$('#queue-bar').setAttribute('aria-valuemax',String(queue.length||1));$('#queue-bar').setAttribute('aria-valuenow',String(finished));$('#queue-bar').setAttribute('aria-valuetext',`${finished} de ${queue.length} itens finalizados no servidor`);
  $('#queue-counts').textContent=`Prontos: ${queue.filter(x=>['ready','browser','sent','archived'].includes(x.state)).length} | Falhas: ${queue.filter(x=>x.state==='error').length} | Cancelados: ${queue.filter(x=>x.state==='cancelled').length} | Restantes: ${queue.length-finished}. Finalizado nesta barra inclui pronto, falha e cancelamento; não confirma gravação no dispositivo.`;
  $('#queue-pause').textContent=paused?'[ Iniciar / retomar fila ]':'[ Pausar novos trabalhos ]';$('#queue-state').textContent=paused?'[PAUSADO] Novos trabalhos aguardam.':'[ATIVO] Um trabalho por vez; falhas não interrompem os demais.';
  $<HTMLButtonElement>('#zip-cancel').disabled=!zipBusy&&!zipJob;
  $<HTMLButtonElement>('#queue-retry').disabled=!queue.some(x=>x.state==='error');$<HTMLButtonElement>('#queue-clear').disabled=!finished;$<HTMLButtonElement>('#queue-pause').disabled=finished===queue.length;
  if(queue.length&&finished===queue.length){$('#queue-pause').textContent='[ Fila finalizada ]';$('#queue-state').textContent='[OK] Processamento da fila finalizado.';}
  const result=queue.length&&finished===queue.length?'[OK] Processamento finalizado. Revise prontos, falhas e cancelados acima; baixe os arquivos individualmente ou em ZIP.':'';if($('#queue-result').textContent!==result)$('#queue-result').textContent=result;
  $<HTMLButtonElement>('#queue-zip').disabled=zipBusy||!queue.some(x=>x.state==='ready'||x.state==='browser');
  if(focused){const target=document.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focused)}"]`);if(target)target.focus();else $('#queue-title').focus();}
}
function move(item:QueueItem,direction:number){const index=queue.indexOf(item);if(!movePending(queue,index,direction)){say('Só é possível trocar a ordem entre itens pendentes.');return;}renderQueue();save();}
async function cancelItem(item:QueueItem){if(item.state==='analyzing')item.controller?.abort();item.state='cancelled';item.message='[X] Cancelado. Uma transferência já iniciada no navegador precisa ser cancelada nele.';if(item.job)try{await request(`/jobs/${item.job.id}`,{method:'DELETE'});}catch{item.message='Cancelamento local confirmado; sem conexão para confirmar no servidor. O trabalho expira automaticamente.';}renderQueue();save();}
function enqueue(){
  const chosen=preview.filter(x=>x.selected);if(!chosen.length||chosen.some(x=>!x.analysis||!x.media||!x.formatId||x.error))return;
  if(chosen.length+queue.length>maxBatch){say('A fila aceita 20 itens. Limpe os finalizados antes de adicionar mais.');return;}
  if(!queue.some(x=>!terminal.has(x.state)))paused=true;
  const existing=new Set(queue.map(x=>x.media?.identity||x.url));let count=0;
  for(const item of chosen){const identity=item.media!.identity||item.url!;if(existing.has(identity)||queue.some(x=>x.url===item.url))continue;existing.add(identity);queue.push({id:crypto.randomUUID(),url:item.url!,index:item.index,title:item.title,state:'waiting',analysis:item.analysis,media:item.media,formatId:item.formatId!,conversion:item.conversion,attempts:0,numbering:prefs().numbering});item.selected=false;count++;}
  say(`[FILA] ${count} itens adicionados. Clique em iniciar/retomar para preparar; não há downloads automáticos no navegador.`);renderPreview();renderQueue();save();
}
function schedule(delay=1500){if(timer)clearTimeout(timer);if(queue.some(x=>needsMonitoring(x)&&(!paused||!!x.job)))timer=setTimeout(()=>void pump(),delay);}
async function pump(){
  if(processing)return;const item=nextWork(queue,paused);if(!item)return;processing=true;
  try{
    if(item.job){
      try{const job=await getJob(item.job.id);if(item.state==='cancelled')return;const browser=item.state==='browser';item.job=job;item.state=browser&&job.state==='ready'&&!['interrupted','partial'].includes(job.transfer||'')?'browser':job.state;item.message=job.message;item.nextPoll=undefined;if(terminal.has(job.state)&&job.state!=='ready')say(`${labels[job.state]}: ${item.title}.`);}
      catch(error){if(item.state==='cancelled')return;if(error instanceof ServiceError&&[401,404,410].includes(error.status)){item.state='error';item.message=error.message;}else{item.message='[!] Conexão de acompanhamento interrompida. O trabalho não será iniciado novamente; tentando recuperar o estado.';item.nextPoll=Math.min((item.nextPoll||1500)*2,15000);}}
    }else{
      item.controller=new AbortController();
      if(!item.analysis||item.analysis.expiresAt<Date.now()){
        item.state='analyzing';renderQueue();const result=await analyze(item.url,item.controller.signal);if(item.state==='cancelled')return;
        const media=result.items[0];const duplicate=media.identity&&queue.some(other=>other!==item&&other.media?.identity===media.identity&&!['error','cancelled'].includes(other.state));if(duplicate)throw new Error('Duplicado: mesmo identificador de outro item da fila.');
        const format=media.formats.find(f=>f.id===item.formatId);if(!format)throw new Error('O formato mudou ou não está mais disponível. Confira novamente este item na prévia.');item.analysis=result;item.media=media;
      }
      if(paused){item.state='waiting';return;}
      item.state='preparing';renderQueue();const job=await request<Job>('/jobs',{method:'POST',signal:item.controller.signal,body:JSON.stringify({analysisId:item.analysis!.id,itemId:item.media!.id,formatId:item.formatId,conversion:item.conversion,requestKey:item.id,numbering:item.numbering,index:item.index})});
      item.job=job;if(item.state==='cancelled'){await request(`/jobs/${job.id}`,{method:'DELETE'});return;}item.state=job.state;item.message=undefined;
    }
  }catch(error){
    if(item.state!=='cancelled'){
      if(error instanceof ServiceError&&error.status===0&&item.attempts<1){item.attempts++;item.state='waiting';item.message='Falha temporária de conexão. Uma nova tentativa será feita com a mesma chave de trabalho.';}
      else{item.state='error';item.message=(error as Error).message;}
    }
  }finally{processing=false;renderQueue();save();schedule(item.nextPoll||1500);}
}
async function zip(){
  if(zipBusy)return;const version=++zipVersion;zipBusy=true;$<HTMLButtonElement>('#queue-zip').disabled=true;$<HTMLButtonElement>('#zip-cancel').disabled=false;$('#zip-status').textContent='[ <==> ] Montando ZIP no servidor...';$('#zip-save').hidden=true;
  try{zipJob=await request<Job>('/zip',{method:'POST',body:JSON.stringify({ids:queue.filter(x=>['ready','browser'].includes(x.state)).map(x=>x.job!.id)})});if(version!==zipVersion){void request(`/jobs/${zipJob.id}`,{method:'DELETE'});return;}void monitorZip(version);}
  catch(error){$('#zip-status').textContent=(error as Error).message;zipBusy=false;renderQueue();}
}
async function monitorZip(version:number){
  if(!zipJob||version!==zipVersion)return;
  try{const result=await getJob(zipJob.id);if(version!==zipVersion)return;zipJob=result;if(zipJob.state==='ready'){const link=$<HTMLAnchorElement>('#zip-save');link.href=fileURL(zipJob);link.download=zipJob.filename||'potato.zip';link.hidden=false;$('#zip-status').textContent=`[OK] ZIP pronto: ${bytes(zipJob.size||0)}. Arquivos únicos numerados dentro do ZIP. Expira em 15 minutos.`;zipBusy=false;for(const item of queue.filter(x=>['ready','browser'].includes(x.state)&&x.job)){try{const updated=await getJob(item.job!.id);item.job=updated;item.state=updated.state;item.message=updated.message;}catch{/* An expired source can be prepared again. */}}renderQueue();return;}
    if(['sent','archived'].includes(zipJob.state)){$('#zip-save').hidden=true;$('#zip-status').textContent=zipJob.message||'Envio encerrado; arquivo temporário removido.';zipBusy=false;renderQueue();return;}
    if(['error','cancelled'].includes(zipJob.state)){$('#zip-status').textContent=zipJob.message||'[X] ZIP cancelado.';zipBusy=false;renderQueue();return;}
    $('#zip-status').textContent=`[ <==> ] Compactação / empacotamento: ${zipJob.message||'sem percentual confiável'}`;
  }catch(error){if(error instanceof ServiceError&&[401,404,410].includes(error.status)){$('#zip-status').textContent=error.message;zipBusy=false;renderQueue();return;}$('#zip-status').textContent='[!] Sem conexão; recuperando o estado do ZIP sem reiniciar.';}
  zipTimer=setTimeout(()=>void monitorZip(version),2000);
}
export function initBatch(){
  $('#batch-root').innerHTML=`<div class="batch-actions mode-switch" role="group" aria-label="Tipo de entrada"><button id="single-toggle" type="button" class="quiet" aria-pressed="true">[ Um link ]</button><button id="batch-toggle" type="button" class="quiet" aria-pressed="false">[ Playlist / vários links ]</button><button id="explore-existing" type="button" class="quiet" hidden>[ Explorar playlist deste vídeo -> ]</button></div>
  <section id="batch-workbench" class="frame" hidden aria-labelledby="batch-heading"><h2 id="batch-heading">+-- COLHEITA / PLAYLISTS E LOTE --+</h2><pre aria-hidden="true" class="batch-banner">URL --+--> [ seleção ] --> [ fila ] --> [ arquivos ]
      '---- [  .o.  ] ------^</pre>
  <form id="batch-form"><label for="batch-urls">Links públicos, um por linha</label><textarea id="batch-urls" rows="4" placeholder="https://..." spellcheck="false" autocomplete="off" maxlength="24000"></textarea><label for="batch-scope">Quando houver vídeo dentro de playlist</label><select id="batch-scope"><option value="auto">Detectar / apenas o vídeo quando o link incluir ambos</option><option value="single">Apenas o vídeo</option><option value="playlist">Explorar a playlist</option></select><div class="batch-actions"><button class="primary" id="batch-discover">[ Analisar links / playlist -> ]</button><button type="button" class="quiet" id="discover-cancel" hidden>[ cancelar análise ]</button></div></form>
  <p id="playlist-description" class="hint">[?] Até 20 links de entrada. Páginas de 25; no máximo 200 itens listados. Sem início automático.</p>
  <details><summary>[ Preferências da colheita v ]</summary><div class="batch-settings"><label>Modo preferido<select id="batch-mode"><option value="auto">Automático</option><option value="video">Vídeo</option><option value="audio">Somente áudio</option></select></label><label>Limite de qualidade preferido<select id="batch-quality"><option value="max">Melhor disponível</option><option value="1080">Até 1080p</option><option value="720">Até 720p</option><option value="480">Até 480p</option></select></label><label>Saída quando houver áudio<select id="batch-audio"><option value="original">Original / extrair áudio</option><option value="mp3">MP3 / converter</option><option value="opus">Opus / converter</option><option value="wav">WAV / converter</option></select></label></div><p class="hint">Preferências são conferidas na origem. O Potato não troca um formato indisponível sem sua escolha.</p><label class="check"><input id="batch-number" type="checkbox" checked> Numerar nomes pela ordem original</label><label class="check"><input id="batch-history" type="checkbox"> Salvar links e rascunho da fila neste navegador (opcional)</label><div class="batch-actions"><button class="quiet" id="batch-reset" type="button">[ restaurar preferências ]</button><button class="quiet" id="batch-forget" type="button">[ apagar dados locais ]</button></div></details>
  <h3>+-- PRÉVIA E SELEÇÃO --+</h3><div class="batch-settings"><label>Buscar por título<input id="batch-search" type="search"></label><label>Estado<select id="batch-filter"><option value="all">Todos</option><option value="selected">Selecionados</option><option value="available">A verificar / formatos encontrados</option><option value="unavailable">Indisponíveis / falhas</option></select></label></div><div class="batch-actions"><button class="quiet" id="batch-all" type="button">[ Selecionar todos ]</button><button class="quiet" id="batch-none" type="button">[ Desmarcar todos ]</button><button class="quiet" id="batch-invert" type="button">[ Inverter seleção ]</button></div><form id="range-form" class="batch-actions"><label>Intervalo da listagem carregada<input id="batch-range" placeholder="1-10 ou 1,3,5-12" inputmode="text"></label><button class="quiet">[ Aplicar intervalo ]</button></form><p class="hint">Seleção preservada entre filtros e páginas. Controles de seleção abrangem todos os itens já carregados.</p>
  <div id="playlist-items"></div><div class="batch-actions"><button type="button" id="batch-prev" class="quiet">[ &lt;- anterior ]</button><span id="batch-page"></span><button type="button" id="batch-next" class="quiet">[ próxima -&gt; ]</button><button type="button" id="batch-more" class="quiet" hidden>[ carregar mais da origem ]</button></div>
  <h3>+-- RESUMO ANTES DE INICIAR --+</h3><p id="batch-summary"></p><div class="batch-actions"><button type="button" class="quiet" id="batch-check">[ Conferir formatos selecionados ]</button><button type="button" class="primary" id="batch-enqueue" disabled>[ Adicionar selecionados à fila -> ]</button></div><p id="batch-status" role="status" aria-live="polite">[ . . . ] Aguardando sua colheita.</p>
  </section>
  <section id="queue-panel" class="frame" aria-labelledby="queue-title" hidden><h2 id="queue-title" tabindex="-1">+-- FILA / PREPARAÇÃO NO SERVIDOR --+</h2><p id="queue-state"></p><div id="queue-bar" class="ascii-progress" role="progressbar" aria-label="Itens finalizados no servidor" aria-valuemin="0"></div><p id="queue-counts" class="hint"></p><div class="batch-actions"><button type="button" id="queue-pause" class="primary">[ Iniciar / retomar fila ]</button><button type="button" id="queue-cancel" class="quiet">[ Cancelar fila ]</button><button type="button" id="queue-retry" class="quiet">[ Repetir falhas ]</button><button type="button" id="queue-clear" class="quiet">[ Limpar finalizados e arquivos ]</button></div><p class="hint">Pausar impede novos trabalhos; o item ativo continua sendo acompanhado. Ao fechar a página, a fila para de iniciar trabalhos. Um trabalho aceito pelo servidor pode terminar e expira; ao reabrir esta aba, trabalhos já aceitos podem ser recuperados pela sessão protegida. Pendentes que ainda não chegaram ao servidor não continuam. Links prontos têm 15 minutos para iniciar. Transferências ativas não têm duração máxima; arquivos enviados são removidos. Para um ZIP, use os arquivos ainda disponíveis no servidor.</p><div id="queue-items"></div><p id="queue-result" role="status" aria-live="polite"></p><h3>+-- PACOTE ZIP --+</h3><p class="hint">Até 20 arquivos prontos por operação. Sem limite de tamanho imposto pela aplicação. ZIP sem cota de tamanho da aplicação, montado incrementalmente no servidor. Os originais temporários são removidos ao concluir o pacote. Baixe individualmente se o navegador bloquear vários downloads.</p><div class="batch-actions"><button type="button" id="queue-zip" class="quiet">[ Preparar ZIP dos prontos ]</button><button type="button" id="zip-cancel" class="quiet">[ Cancelar ZIP ]</button><a id="zip-save" class="primary" hidden referrerpolicy="no-referrer">[ Baixar ZIP -> ]</a></div><p id="zip-status" role="status" aria-live="polite"></p></section>`;
  $('#single-toggle').onclick=()=>switchMode(false);$('#batch-toggle').onclick=()=>switchMode(true);
  $('#batch-form').onsubmit=e=>{e.preventDefault();void discoverLinks();};$('#batch-more').onclick=()=>void discoverLinks(true);$('#discover-cancel').onclick=()=>discoverAbort?.abort();
  for(const id of ['batch-mode','batch-quality','batch-audio','batch-number','batch-history'])$('#'+id).addEventListener('change',()=>{forgetLocal=false;save();});
  $('#batch-search').oninput=()=>{currentPage=1;renderPreview();};$('#batch-filter').onchange=()=>{currentPage=1;renderPreview();};
  $('#batch-all').onclick=()=>{preview.forEach(x=>x.selected=eligible(x));renderPreview();};$('#batch-none').onclick=()=>{preview.forEach(x=>x.selected=false);renderPreview();};$('#batch-invert').onclick=()=>{preview.forEach(x=>x.selected=eligible(x)&&!x.selected);renderPreview();};
  $('#range-form').onsubmit=e=>{e.preventDefault();try{const range=parseRange($<HTMLInputElement>('#batch-range').value,preview.length);preview.forEach(x=>x.selected=eligible(x)&&range.has(x.index));renderPreview();say('[OK] Intervalo aplicado.');}catch(error){say((error as Error).message);}};
  $('#batch-prev').onclick=()=>{currentPage--;renderPreview();};$('#batch-next').onclick=()=>{currentPage++;renderPreview();};$('#batch-check').onclick=()=>void checkSelection();$('#batch-enqueue').onclick=()=>{enqueue();$('#queue-panel').hidden=!queue.length;};
  $('#queue-pause').onclick=()=>{paused=!paused;renderQueue();void pump();};
  $('#queue-cancel').onclick=()=>{paused=true;void Promise.all(queue.filter(x=>!['cancelled','error'].includes(x.state)).map(cancelItem));renderQueue();};
  $('#queue-retry').onclick=()=>{queue.filter(x=>x.state==='error').forEach(x=>{x.state='waiting';x.analysis=undefined;x.job=undefined;x.id=crypto.randomUUID();x.attempts=0;x.message=undefined;});renderQueue();save();if(!paused)void pump();};
  $('#queue-clear').onclick=()=>{for(const item of queue.filter(x=>terminal.has(x.state)&&x.job))void request(`/jobs/${item.job!.id}`,{method:'DELETE'}).catch(()=>say('Sem conexão para liberar algum arquivo; ele expira automaticamente.'));queue=queue.filter(x=>!terminal.has(x.state));renderQueue();save();};$('#queue-zip').onclick=()=>void zip();$('#zip-save').onclick=event=>{if((zipJob?.expiresAt||0)<Date.now()){event.preventDefault();if(zipJob)void getJob(zipJob.id).then(job=>{zipJob=job;$('#zip-status').textContent=job.state==='ready'?'Disponibilidade renovada; clique em baixar ZIP novamente.':'Pacote removido. Prepare novas cópias antes de montar outro ZIP.';$('#zip-save').hidden=job.state!=='ready';}).catch(error=>{$('#zip-status').textContent=(error as Error).message;});return;}$('#zip-status').textContent='[OK] Download do ZIP iniciado no navegador; gravação não confirmada.';if(zipJob)void monitorZipDelivery(zipVersion);};
  $('#zip-cancel').onclick=()=>{zipVersion++;if(zipTimer)clearTimeout(zipTimer);if(zipJob)void request(`/jobs/${zipJob.id}`,{method:'DELETE'}).catch(()=>{$('#zip-status').textContent='Sem conexão para confirmar cancelamento; ZIP expira automaticamente.';});zipBusy=false;$('#zip-save').hidden=true;$('#zip-status').textContent='[X] ZIP cancelado.';renderQueue();};
  const reset=()=>{select('#batch-mode').value='auto';select('#batch-quality').value='max';select('#batch-audio').value='original';$<HTMLInputElement>('#batch-number').checked=true;};$('#batch-reset').onclick=()=>{reset();save();say('[OK] Preferências do lote restauradas.');};
  $('#batch-forget').onclick=()=>{forgetLocal=true;try{for(const key of [prefsKey,historyKey,'potato.v2.preferences'])localStorage.removeItem(key);sessionStorage.removeItem('potato.v3.session');}catch{/* Blocked storage is already ephemeral. */}$<HTMLInputElement>('#batch-history').checked=false;$<HTMLTextAreaElement>('#batch-urls').value='';say('[OK] Dados locais apagados. Trabalhos em memória permanecem até você cancelar ou fechar a página.');};
  try{const p=JSON.parse(localStorage.getItem(prefsKey)||'{}');if(['auto','video','audio'].includes(p.mode))select('#batch-mode').value=p.mode;if(['max','1080','720','480'].includes(p.quality))select('#batch-quality').value=p.quality;if(['original','mp3','opus','wav'].includes(p.conversion))select('#batch-audio').value=p.conversion;$<HTMLInputElement>('#batch-number').checked=p.numbering!==false;
    const history=JSON.parse(localStorage.getItem(historyKey)||'null');if(history){$<HTMLInputElement>('#batch-history').checked=true;$<HTMLTextAreaElement>('#batch-urls').value=typeof history.links==='string'?history.links.slice(0,24000):'';if(Array.isArray(history.queue)&&history.queue.length)$<HTMLTextAreaElement>('#batch-urls').value=history.queue.slice(0,maxBatch).map((x:{url:unknown})=>typeof x.url==='string'?x.url:'').join('\n');switchMode(true);say('[!] Rascunho restaurado. Analise novamente para validar URLs e renovar formatos; nada será iniciado automaticamente.');}}
  catch{/* Invalid or blocked local data is ignored. */}
  document.querySelectorAll('#batch-root select').forEach(select=>{const shell=node('span');shell.className='ascii-select';select.before(shell);shell.append(select);});
  window.addEventListener('online',()=>void recoverAccepted());
  renderPreview();renderQueue();void recoverAccepted();
  window.addEventListener('pagehide',()=>{if(timer)clearTimeout(timer);if(zipTimer)clearTimeout(zipTimer);discoverAbort?.abort();save();});
}

async function recoverAccepted(){
  try{const result=await request<{archives?:Job[];items:{job:Job;url:string;title:string;index:number;formatId:string;conversion:string;numbering:boolean}[]}>('/session/jobs');
    let recovered=0;for(const item of result.items.slice(0,maxBatch)){if(queue.some(q=>q.job?.id===item.job.id))continue;recovered++;queue.push({id:crypto.randomUUID(),url:item.url,index:item.index,title:item.title,formatId:item.formatId,conversion:item.conversion,numbering:item.numbering,state:item.job.state,job:item.job,attempts:0});}
    const archive=result.archives?.findLast(j=>['ready','packing'].includes(j.state));if(archive){zipJob=archive;zipBusy=archive.state==='packing';void monitorZip(++zipVersion);}
    if(recovered){$('#queue-panel').hidden=false;renderQueue();say('[OK] Trabalhos aceitos recuperados pela sessão desta aba. A fila está pausada para novos trabalhos.');void pump();}
  }catch(error){if(error instanceof ServiceError&&error.status===401)say('A sessão anterior expirou. Analise novamente os links; arquivos antigos não foram recuperados.');}
}

async function monitorZipDelivery(version:number){
  if(!zipJob||version!==zipVersion)return;
  try{const result=await getJob(zipJob.id);if(version!==zipVersion)return;zipJob=result;if(result.state==='sent'){ $('#zip-save').hidden=true;$('#zip-status').textContent=result.message||'Envio pelo servidor encerrado; cópia removida.';return;}if(result.transfer==='interrupted'||result.transfer==='partial'){$('#zip-status').textContent=result.message||'Envio interrompido. Tente novamente.';return;}}catch(error){if(error instanceof ServiceError&&[401,404,410].includes(error.status))return;}
  zipTimer=setTimeout(()=>void monitorZipDelivery(version),2000);
}
