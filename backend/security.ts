import {lookup} from 'node:dns/promises';
import http from 'node:http';
import net from 'node:net';
import ipaddr from 'ipaddr.js';

export function isPublicIP(value:string):boolean {
  try {return ipaddr.process(value).range()==='unicast';} catch {return false;}
}
export function parsePublicURL(value:unknown):URL {
  if(typeof value!=='string' || value.length>4096) throw new Error('Informe um link válido com https://.');
  let url:URL;try{url=new URL(value);}catch{throw new Error('Informe um link válido com https://.');}
  if(!['http:','https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Use HTTP ou HTTPS, sem credenciais ou portas especiais.');
  const host=url.hostname.toLowerCase();
  if(!host.includes('.') || ['.local','.localhost','.internal','.test','.invalid','.example'].some(s=>host.endsWith(s)) || ipaddr.isValid(host.replace(/^\[|\]$/g,''))) throw new Error('Endereços locais e IPs não são permitidos.');
  return url;
}
export function validateSource(value:unknown):URL {
  // Source discovery belongs to the installed extractor engine, not a static host list.
  // Every outbound request still crosses the DNS-pinning egress boundary below.
  return parsePublicURL(value);
}
export async function resolvePublic(host:string):Promise<{address:string;family:number}> {
  const name=host.replace(/^\[|\]$/g,'');
  if(ipaddr.isValid(name)) {if(!isPublicIP(name))throw new Error('Destino bloqueado.');return {address:name,family:net.isIP(name)};}
  const addresses=await lookup(name,{all:true,verbatim:true});
  if(!addresses.length || addresses.some(item=>!isPublicIP(item.address)))throw new Error('Destino bloqueado.');
  return addresses[0];
}
export function sanitizeFilename(value:string,ext:string):string {
  // eslint-disable-next-line no-control-regex -- strip control bytes from untrusted metadata.
  const title=value.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_').replace(/[. ]+$/,'').slice(0,110) || 'potato';
  const safe=/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(title) ? `potato-${title}` : title;
  return `${safe}.${ext.replace(/[^a-z0-9]/gi,'').slice(0,8)||'bin'}`;
}
/** Private loopback forward proxy: validates AND pins DNS for every request/CONNECT.
 * Redirects create new requests, so all redirect targets pass the same boundary.
 */
export function createEgressProxy() {
  const server=http.createServer(async(req,res)=>{
    try {
      if(!['GET','HEAD'].includes(req.method||''))throw new Error('Method');
      const url=new URL(req.url||'');if(url.protocol!=='http:' || !['','80'].includes(url.port) || url.username || url.password)throw new Error('Protocol');
      const dest=await resolvePublic(url.hostname);
      const upstream=http.request({host:dest.address,port:80,path:url.pathname+url.search,method:req.method,headers:{...req.headers,host:url.host,'proxy-connection':undefined},timeout:20000},out=>{res.writeHead(out.statusCode||502,out.headers);out.pipe(res);});
      upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});upstream.on('timeout',()=>upstream.destroy());req.pipe(upstream);res.on('close',()=>upstream.destroy());
    }catch{res.writeHead(403);res.end('Destination blocked');}
  });
  server.on('connect',async(req,client,head)=>{
    try {
      const url=new URL(`https://${req.url}`);if(url.port && url.port!=='443')throw new Error('Port');
      const dest=await resolvePublic(url.hostname);
      const remote=net.connect({host:dest.address,port:443},()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)remote.write(head);remote.pipe(client);client.pipe(remote);});
      remote.setTimeout(30000,()=>remote.destroy());remote.on('error',()=>client.destroy());client.on('error',()=>remote.destroy());client.on('close',()=>remote.destroy());
    }catch{client.end('HTTP/1.1 403 Forbidden\r\n\r\n');}
  });
  return server;
}
