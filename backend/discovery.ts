import type {Discovery,DiscoveryItem} from '../src/types.ts';
import type {RawMedia} from './engine.ts';
import {validateSource} from './security.ts';
import {config} from './config.ts';

export function discovery(raw:RawMedia,source:URL,start:number):Discovery{
  const playlist=Array.isArray(raw.entries),all=playlist?raw.entries!:[raw];
  const entries=all.slice(0,config.playlistPage);
  const items:DiscoveryItem[]=entries.map((entry,i)=>{
    const index=entry?.playlist_index||start+i;
    const title=String(entry?.title||'Item indisponível').slice(0,250);
    let url:string|undefined;
    try{url=validateSource(entry?.webpage_url||entry?.original_url||entry?.url||(!playlist?source.href:undefined)).href;}catch{/* Missing/private entries remain visible. */}
    const restricted=!entry||!url||['private','premium_only','subscriber_only','needs_auth'].includes(entry.availability||'')||/^\[(private|deleted) video\]$/i.test(title);
    return {index,title,url:restricted?undefined:url,identity:entry?.id?`${entry.extractor_key||entry.ie_key||entry.extractor||source.hostname}:${entry.id}`:undefined,duration:entry?.duration,availability:restricted?'unavailable':'pending',reason:restricted?'Privado, removido ou sem endereço público.':undefined};
  });
  const total=Number(raw.playlist_count||raw.n_entries)||undefined;
  const more=all.length>config.playlistPage;
  const next=more&&start+config.playlistPage<=config.maxPlaylist?start+config.playlistPage:undefined;
  const complete=!next&&!more&&start===1&&(!total||total===items.length);
  return {title:String(raw.title||'Mídias encontradas').slice(0,250),author:raw.uploader||raw.creator,total:playlist?total:1,items,playlist,next,incomplete:!complete,
    duration:complete&&items.length&&items.every(x=>typeof x.duration==='number')?items.reduce((n,x)=>n+x.duration!,0):undefined,
    videoInPlaylist:source.searchParams.has('list')&&source.searchParams.has('v')};
}
