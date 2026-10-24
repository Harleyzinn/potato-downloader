import type {Format,Media,Mode} from './types.ts';
export function parseRange(value:string,max:number):Set<number>{
  if(!value.trim())throw new Error('Informe um intervalo, como 1-10 ou 1,3,5-12.');
  const result=new Set<number>();
  for(const part of value.replace(/[–—]/g,'-').split(',')){
    const match=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!match)throw new Error('Intervalo inválido. Use 1-10 ou 1,3,5-12.');
    const a=Number(match[1]),b=Number(match[2]||a);if(a<1||b<a||b>max)throw new Error(`Use números entre 1 e ${max}.`);
    for(let n=a;n<=b;n++)result.add(n);
  }return result;
}
export function uniqueURLs(lines:string[],validate:(value:string)=>string){
  const seen=new Set<string>(),urls:string[]=[],errors:string[]=[];let duplicates=0;
  lines.forEach((line,index)=>{if(!line.trim())return;try{const url=validate(line);if(seen.has(url)){duplicates++;return;}seen.add(url);urls.push(url);}catch(error){errors.push(`Linha ${index+1}: ${(error as Error).message}`);}});
  return {urls,errors,duplicates};
}
export function chooseFormat(media:Media,mode:Mode,quality:string):Format|undefined{
  const chosen=mode==='auto'?(media.formats.some(f=>f.mode==='video')?'video':'audio'):mode;
  const choices=media.formats.filter(f=>f.mode===chosen);
  if(chosen==='audio'||quality==='max')return choices[0];
  return choices.find(f=>{const height=Number(f.label.match(/^(\d+)p/)?.[1]);return height>0&&height<=Number(quality);});
}
export function itemBar(value:number,total:number):string{const n=total?Math.round(20*value/total):0;return `[${'#'.repeat(n)}${'-'.repeat(20-n)}] ${value}/${total} itens finalizados`;}
export const isTerminal=(state:string)=>['ready','browser','sent','archived','error','cancelled'].includes(state);
export function needsMonitoring(item:{state:string;job?:{state:string}}):boolean{return !isTerminal(item.state)||(item.state==='browser'&&item.job?.state==='ready');}
export function nextWork<T extends {state:string;job?:{state:string}}>(items:T[],paused:boolean):T|undefined{return items.find(x=>!isTerminal(x.state)&&(!paused||!!x.job))||items.find(x=>x.state==='browser'&&x.job?.state==='ready');}
export function movePending<T extends {state:string}>(items:T[],index:number,delta:number):boolean{const other=index+delta;if(items[index]?.state!=='waiting'||items[other]?.state!=='waiting')return false;[items[index],items[other]]=[items[other],items[index]];return true;}
