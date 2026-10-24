import type {Preferences} from './types.ts';
export const defaults:Preferences={mode:'auto',quality:'1080',audioFormat:'original',reducedMotion:false};
export function loadPreferences():Preferences{
  try{const p=JSON.parse(localStorage.getItem('potato.v2.preferences')||'{}') as Partial<Preferences>;return{mode:['auto','video','audio'].includes(p?.mode||'')?p.mode!:defaults.mode,quality:['max','2160','1080','720','480'].includes(p?.quality||'')?p.quality!:defaults.quality,audioFormat:['original','mp3','opus','wav'].includes(p?.audioFormat||'')?p.audioFormat!:defaults.audioFormat,reducedMotion:p?.reducedMotion===true};}catch{return{...defaults};}
}
export function savePreferences(value:Preferences):boolean{try{localStorage.setItem('potato.v2.preferences',JSON.stringify(value));return true;}catch{return false;}}
