type Item={title:string;state:string;native?:{state:string}};
export function queueMatches(item:Item,filter:string,query:string):boolean{
  const title=item.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const text=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
  if(!title.includes(text))return false;
  if(filter==='active')return item.native?item.native.state==='writing':['analyzing','preparing','downloading','processing','packing','browser'].includes(item.state);
  if(filter==='ready')return item.state==='ready'&&!item.native;
  if(filter==='done')return ['sent','archived'].includes(item.state)||item.native?.state==='saved';
  if(filter==='error')return item.state==='error'||item.native?.state==='error';
  if(filter==='cancelled')return item.state==='cancelled'||item.native?.state==='cancelled';
  return true;
}
export function queueTotals(items:Item[]){return {total:items.length,available:items.filter(i=>i.state==='ready'&&!i.native).length,prepared:items.filter(i=>['ready','browser','sent','archived'].includes(i.state)).length,failed:items.filter(i=>i.state==='error').length,cancelled:items.filter(i=>i.state==='cancelled').length,remaining:items.filter(i=>!['ready','browser','sent','archived','error','cancelled'].includes(i.state)).length,saved:items.filter(i=>i.native?.state==='saved').length,writeFailed:items.filter(i=>i.native?.state==='error').length};}
