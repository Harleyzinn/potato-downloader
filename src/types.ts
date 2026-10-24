export type Mode = 'auto'|'video'|'audio';
export type Format = {id:string; label:string; mode:'video'|'audio'; ext:string; size?:number; estimated:boolean};
export type Media = {id:string; title:string; author?:string; duration?:number; formats:Format[]};
export type Analysis = {id:string; items:Media[]; expiresAt:number};
export type Job = {id:string; state:'preparing'|'downloading'|'ready'|'error'|'cancelled'; progress?:number; message?:string; filename?:string; size?:number};
export type Health = {online:boolean; engine:string; platforms:string[]; limits:{maxBytes:number; maxDuration:number}; temporary:boolean};
export type Preferences = {mode:Mode; quality:string; audioFormat:string; reducedMotion:boolean};
