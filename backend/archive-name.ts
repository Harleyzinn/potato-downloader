import {basename} from 'node:path';
/** Keep ZIP ordering without adding the source's generated numbering a second time. */
export function archiveEntryName(filename:string,index:number,originalIndex?:number):string{
  const safe=basename(filename.replaceAll('\\','/'))||'midia';
  const original=originalIndex===undefined?'':String(originalIndex).padStart(3,'0')+'-';
  return String(index).padStart(3,'0')+'-'+(original&&safe.startsWith(original)?safe.slice(original.length):safe);
}
