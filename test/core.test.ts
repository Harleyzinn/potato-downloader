import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPublicIP,parsePublicURL,validateSource,sanitizeFilename,createEgressProxy} from '../backend/security.ts';
import {mediaOptions,publicError} from '../backend/engine.ts';
import {validateURL} from '../src/service.ts';
import {progressBar} from '../src/components.ts';
import net from 'node:net';
import http from 'node:http';

test('blocks private, reserved and mapped IPv4/IPv6 destinations',()=>{
  for(const value of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1'])assert.equal(isPublicIP(value),false,value);
  assert.equal(isPublicIP('1.1.1.1'),true);
  assert.equal(isPublicIP('2606:4700:4700::1111'),true);
});
test('validates protocols, ports, credentials and exact source host boundaries',()=>{
  for(const url of ['file:///etc/passwd','http://127.0.0.1','http://[::1]','https://localhost','https://test.local','https://user:pass@vimeo.com/1','https://vimeo.com:9000/1'])assert.throws(()=>parsePublicURL(url));
  assert.throws(()=>validateSource('https://youtube.com.attacker.net/video'));
  assert.throws(()=>validateSource('https://example.org/video'));
  assert.equal(validateSource('https://www.youtube.com/watch?v=123').hostname,'www.youtube.com');
});
test('forward proxy blocks redirect-like requests and CONNECT to private targets',async()=>{
  const proxy=createEgressProxy();await new Promise<void>(done=>proxy.listen(0,'127.0.0.1',done));const addr=proxy.address();assert.ok(addr&&typeof addr!=='string');
  try{
    const code=await new Promise<number>((done,fail)=>{http.get({host:'127.0.0.1',port:addr.port,path:'http://169.254.169.254/latest/meta-data'},response=>{response.resume();done(response.statusCode!);}).on('error',fail);});assert.equal(code,403);
    const text=await new Promise<string>((done,fail)=>{const socket=net.connect(addr.port,'127.0.0.1',()=>socket.write('CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n'));socket.on('data',data=>{done(data.toString());socket.destroy();});socket.on('error',fail);});assert.match(text,/403/);
  }finally{await new Promise<void>(done=>proxy.close(()=>done()));}
});
test('returns only source formats with no DRM and rejects live/overlong media',()=>{
  const media=mediaOptions({title:'My media',formats:[{format_id:'1',protocol:'https',vcodec:'h264',acodec:'aac',ext:'mp4',height:720,filesize:1000},{format_id:'2',protocol:'https',vcodec:'h264',acodec:'aac',has_drm:true},{format_id:'3',protocol:'rtmp',vcodec:'h264',acodec:'aac'}]},'id');
  assert.equal(media.formats.length,2);assert.ok(media.formats.some(f=>f.id==='v:1'));assert.equal(media.formats[0].estimated,false);
  assert.throws(()=>mediaOptions({is_live:true},'id'));assert.throws(()=>mediaOptions({duration:1300},'id'));
});
test('sanitizes names without leaking raw errors and distinguishes real progress',()=>{
  assert.equal(sanitizeFilename('../CON/hello\x00','mp4'),'.._CON_hello_.mp4');assert.equal(sanitizeFilename('CON','mp3'),'potato-CON.mp3');
  assert.ok(!publicError('secret /home/user/file https://host/private').includes('secret'));
  assert.match(publicError('HTTP Error 429'),/limitou/);assert.match(publicError('private video'),/privado/);
  assert.match(progressBar(50),/50%/);assert.ok(!progressBar().includes('%'));
});
test('client rejects empty, executable and credential-bearing URLs',()=>{
  for(const value of ['', 'not a url','javascript:alert(1)','https://user:pass@example.com'])assert.throws(()=>validateURL(value));
  assert.equal(validateURL(' https://vimeo.com/123 '),'https://vimeo.com/123');
});
