import type {Analysis,Job,Health} from './types.ts';
export const apiBase=(import.meta.env?.VITE_API_URL as string|undefined || (import.meta.env?.DEV&&typeof location!=='undefined'?location.origin:'')).replace(/\/$/,'');
export class ServiceError extends Error{constructor(message:string,public status=0){super(message);}}
export async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  if(!apiBase)throw new ServiceError('O motor ainda não foi conectado. Consulte a seção de ajustes.');
  if(location.protocol==='https:' && !apiBase.startsWith('https://'))throw new ServiceError('O motor precisa de HTTPS para esta página.');
  try{
    const signal=init.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(100000)]) : AbortSignal.timeout(15000);
    const response=await fetch(`${apiBase}/api${path}`,{...init,signal,headers:{...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},credentials:'omit',referrerPolicy:'no-referrer'});
    let data:unknown;try{data=await response.json();}catch{throw new ServiceError('Resposta inesperada do motor. Verifique a conexão.');}
    if(!response.ok)throw new ServiceError(typeof data==='object'&&data&&'message'in data?String(data.message):'Serviço indisponível. Tente novamente.',response.status);
    if(!data || typeof data!=='object')throw new ServiceError('Resposta inválida do motor.');return data as T;
  }catch(error){if(error instanceof ServiceError || (error instanceof DOMException&&error.name==='AbortError'))throw error;if(error instanceof DOMException&&error.name==='TimeoutError')throw new ServiceError('Tempo limite atingido. Verifique a conexão e tente novamente.');throw new ServiceError('Falha de conexão. Verifique sua internet e se o motor está ligado.');}
}
export async function getHealth():Promise<Health>{
  const result=await request<Health>('/health',{signal:AbortSignal.timeout(8000)});
  if(typeof result.online!=='boolean'||!Array.isArray(result.platforms)||!result.limits)throw new ServiceError('Motor incompatível.');return result;
}
export async function analyze(url:string,signal:AbortSignal):Promise<Analysis>{
  const data=await request<Analysis>('/analyze',{method:'POST',body:JSON.stringify({url}),signal});
  if(typeof data.id!=='string'||!Array.isArray(data.items)||!data.items.length||data.items.some(item=>typeof item.id!=='string'||typeof item.title!=='string'||!Array.isArray(item.formats)||item.formats.some(f=>typeof f.id!=='string'||!['video','audio'].includes(f.mode)||typeof f.label!=='string')))throw new ServiceError('O motor retornou opções inválidas. Tente analisar novamente.');
  return data;
}
export async function getJob(id:string):Promise<Job>{const data=await request<Job>(`/jobs/${encodeURIComponent(id)}`);if(!['preparing','downloading','ready','error','cancelled'].includes(data.state))throw new ServiceError('Estado de trabalho inválido.');return data;}
export function validateURL(value:string):string{
  if(!value.trim())throw new Error('Cole o link da mídia para começar.');
  let url:URL;try{url=new URL(value.trim());}catch{throw new Error('Link inválido. Inclua https:// e confira o endereço.');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||value.length>4096)throw new Error('Use um link HTTP ou HTTPS público, sem credenciais.');return url.href;
}
