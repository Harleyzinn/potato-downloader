import type {Compatibility} from './types.ts';
import {element as $} from './components.ts';
import {request} from './service.ts';
import {isPublicExample} from './presentation.ts';
let data:Compatibility|undefined,visible=24;
export async function refreshCatalog(){
  try{
    const result=await request<Compatibility>('/compatibility');
    if(typeof result.version!=='string'||!Array.isArray(result.extractors)||!Array.isArray(result.groups)||!Array.isArray(result.verified)||!Array.isArray(result.limitations))throw new Error('Catálogo incompatível.');
    data=result;$('#catalog-version').textContent=`[*] yt-dlp ${data.version} / ${data.extractors.length.toLocaleString('pt-BR')} extratores instalados / ${data.extractors.filter(x=>x.broken).length} sinalizados como quebrados`;
    $('#engine-summary').textContent=`[${data.extractors.length.toLocaleString('pt-BR')}] extratores / yt-dlp ${data.version}`;
    $('#source-groups').replaceChildren();
    const labels={video:'[>]',social:'[/]',audio:'[~]',adult:'[18+]',direct:'[#]'};
    for(const group of data.groups.filter(group=>isPublicExample(group.name))){
      const box=document.createElement('div');box.className='source-group';
      const title=document.createElement('h3');title.textContent=`${labels[group.category]} ${group.name}`;
      const status=document.createElement('p');status.textContent=group.installed?'[+] extrator listado':'[-] ausente ou quebrado';status.className=group.installed?'hint':'error';box.append(title,status);$('#source-groups').append(box);
    }
    $('#verified-sources').replaceChildren();
    for(const record of data.verified){
      const article=document.createElement('article');article.className='verified-record';
      const title=document.createElement('h3');title.textContent=`[ok] ${record.name}`;
      const meta=document.createElement('p');meta.className='hint';meta.textContent=`${record.date} / yt-dlp ${record.version}`;
      const scope=document.createElement('p');scope.textContent=record.scope;article.append(title,meta,scope);$('#verified-sources').append(article);
    }
    if(!data.verified.length)$('#verified-sources').textContent='[ ] Nenhum teste de download registrado nesta instalação.';
    $('#catalog-limitations').replaceChildren(...data.limitations.map(text=>{const item=document.createElement('li');item.textContent=text;return item;}));
    renderExtractors();
  }catch{$('#catalog-version').textContent='[!] Catálogo indisponível. Verifique a conexão com o motor.';$('#engine-summary').textContent='[?] catálogo desconectado';}
}
function renderExtractors(){
  if(!data)return;const query=$<HTMLInputElement>('#extractor-search').value.trim().toLocaleLowerCase();
  const matches=data.extractors.filter(item=>isPublicExample(item.name)&&item.name.toLocaleLowerCase().includes(query));
  $('#extractor-rows').replaceChildren(...matches.slice(0,visible).map(item=>{
    const row=document.createElement('tr'),name=document.createElement('th'),status=document.createElement('td');
    name.scope='row';name.textContent=item.name;status.textContent=item.broken?'[!] QUEBRADO':'[+] LISTADO';status.className=item.broken?'error':'accent';row.append(name,status);return row;
  }));
  $('#catalog-count').textContent=`[${Math.min(visible,matches.length)}/${matches.length}] exemplos exibíveis / [+] listado não significa testado`;
  $('#catalog-empty').hidden=matches.length>0;$('#more-extractors').hidden=matches.length<=visible;
}
$('#extractor-search').addEventListener('input',()=>{visible=24;renderExtractors();});
$('#more-extractors').addEventListener('click',()=>{visible+=80;renderExtractors();});
