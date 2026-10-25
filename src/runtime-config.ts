/** Public deployment configuration; never accepts credentials or executable protocols. */
export function publicAPI(value:unknown):string{
  if(typeof value!=='string')return '';
  try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.'))return '';return url.origin;}catch{return '';}
}
export async function deploymentAPI():Promise<string>{
  if(typeof window==='undefined'||window.batatubo||import.meta.env?.DEV)return '';
  try{const response=await fetch(`${import.meta.env.BASE_URL}backend.json`,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});if(!response.ok)return '';const config=await response.json();return publicAPI(config.apiBase);}catch{return '';}
}
