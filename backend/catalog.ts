import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {ytdlpPath} from './engine.ts';
import type {Compatibility,Extractor,SourceGroup,VerifiedSource} from '../src/types.ts';

export function parseExtractors(output:string):Extractor[]{
  return output.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>({name:line.replace(/\s*\(CURRENTLY BROKEN\)/i,'').slice(0,160),broken:/CURRENTLY BROKEN/i.test(line)}));
}
const definitions:Omit<SourceGroup,'installed'>[]=[
  {name:'YouTube',category:'video',prefixes:['youtube']},
  {name:'Vimeo',category:'video',prefixes:['vimeo']},
  {name:'Dailymotion',category:'video',prefixes:['dailymotion']},
  {name:'Twitch',category:'video',prefixes:['twitch']},
  {name:'Bilibili',category:'video',prefixes:['bilibili']},
  {name:'PeerTube',category:'video',prefixes:['peertube']},
  {name:'TikTok',category:'social',prefixes:['tiktok']},
  {name:'Instagram',category:'social',prefixes:['instagram']},
  {name:'X / Twitter',category:'social',prefixes:['twitter']},
  {name:'Reddit',category:'social',prefixes:['reddit']},
  {name:'Facebook',category:'social',prefixes:['facebook']},
  {name:'Bluesky',category:'social',prefixes:['bluesky']},
  {name:'SoundCloud',category:'audio',prefixes:['soundcloud']},
  {name:'Bandcamp',category:'audio',prefixes:['bandcamp']},
  {name:'Mixcloud',category:'audio',prefixes:['mixcloud']},
  {name:'Audiomack',category:'audio',prefixes:['audiomack']},
  {name:'Internet Archive',category:'video',prefixes:['archive.org']},
  {name:'Wikimedia Commons',category:'video',prefixes:['wikimedia.org']},
  {name:'Arquivos diretos / HLS / DASH VOD',category:'direct',prefixes:['generic']},
];
export function groupSources(extractors:Extractor[]):SourceGroup[]{return definitions.map(group=>({...group,installed:group.prefixes.some(prefix=>extractors.some(x=>!x.broken&&(x.name.toLowerCase()===prefix||x.name.toLowerCase().startsWith(`${prefix}:`))))}));}
export function readCompatibility():Compatibility{
  const version=spawnSync(ytdlpPath,['--ignore-config','--no-plugin-dirs','--version'],{encoding:'utf8',windowsHide:true,timeout:5000}).stdout?.trim()||'indisponível';
  const result=spawnSync(ytdlpPath,['--ignore-config','--no-plugin-dirs','--list-extractors'],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:2*1024*1024});
  const extractors=result.status===0?parseExtractors(result.stdout):[];
  let verified:VerifiedSource[]=[];try{verified=JSON.parse(readFileSync(new URL('./verified-sources.json',import.meta.url),'utf8')) as VerifiedSource[];}catch{/* No tests claimed when the ledger is absent. */}
  return {version,extractors,groups:groupSources(extractors),verified,limitations:[
    'Listado no motor não significa download garantido. Extratores marcados como quebrados permanecem identificados no catálogo.',
    'Somente conteúdo público, sem senhas, cookies de contas, autenticação, DRM, paywalls ou contorno de região/idade.',
    'HLS e DASH sob demanda quando suportados pelo downloader nativo. Ao vivo e protocolos RTMP/RTSP não são aceitos.',
    '20 minutos, 100 MiB por arquivo, dois processos e quatro transferências simultâneas. Até oito itens de uma coleção.',
  ]};
}
