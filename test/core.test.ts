import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPublicIP,parsePublicURL,validateSource,sanitizeFilename,createEgressProxy} from '../backend/security.ts';
import {mediaOptions,publicError} from '../backend/engine.ts';
import {validateURL} from '../src/service.ts';
import {progressBar} from '../src/components.ts';
import net from 'node:net';
import http from 'node:http';
import {parseExtractors,groupSources} from '../backend/catalog.ts';
import {readPublicPrefix} from '../backend/probe.ts';
import {isPublicExample} from '../src/presentation.ts';

test('blocks private, reserved and mapped IPv4/IPv6 destinations',()=>{
  for(const value of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1'])assert.equal(isPublicIP(value),false,value);
  assert.equal(isPublicIP('1.1.1.1'),true);
  assert.equal(isPublicIP('2606:4700:4700::1111'),true);
});
test('accepts public source discovery beyond curated platforms and blocks dangerous URL syntax',()=>{
  for(const url of ['file:///etc/passwd','http://127.0.0.1','http://[::1]','https://localhost','https://test.local','https://user:pass@vimeo.com/1','https://vimeo.com:9000/1'])assert.throws(()=>parsePublicURL(url));
  assert.equal(validateSource('https://media.public-source.org/video.mp4').pathname,'/video.mp4');
  assert.equal(validateSource('https://cdn.public-source.org/vod/index.m3u8').protocol,'https:');
  assert.equal(validateSource('https://www.youtube.com/watch?v=123').hostname,'www.youtube.com');
});

test('catalog distinguishes installed, broken and verified instead of assuming site availability',()=>{
  const extractors=parseExtractors('youtube\nPornHub\nXVideos (CURRENTLY BROKEN)\ngeneric\n');
  assert.equal(extractors.length,4);assert.equal(extractors[2].broken,true);
  const groups=groupSources(extractors);
  assert.ok(!groups.some(x=>/pornhub|xvideos/i.test(x.name)));
  assert.ok(extractors.some(x=>x.name==='PornHub'));
  assert.equal(groups.find(x=>x.category==='direct')?.installed,true);
});

test('public examples do not restrict the generic URL boundary or the raw inventory',()=>{
  for(const name of ['PornHub','PornHubPlaylist','XVideos','xvideos:quickies'])assert.equal(isPublicExample(name),false);
  for(const name of ['YouTube','Vimeo','Bandcamp','Wikimedia Commons'])assert.equal(isPublicExample(name),true);
  // Syntax-only validation: no network request or platform download is made here.
  for(const host of ['www.pornhub.com','www.xvideos.com','media.public-source.org'])assert.equal(validateSource(`https://${host}/`).hostname,host);
  const raw=parseExtractors('PornHub\nXVideos\ngeneric\n');assert.equal(raw.length,3);
  assert.equal(raw.filter(x=>isPublicExample(x.name)).length,1);
});

test('bounded direct-file probe rejects local and credential URLs before opening a socket',async()=>{
  for(const url of ['http://127.0.0.1/private','http://[::1]/','file:///etc/passwd','https://user:pass@public.org/a.mp4'])await assert.rejects(readPublicPrefix(url,new AbortController().signal));
});

test('native VOD formats are offered, while DRM, authentication and RTSP are rejected',()=>{
  const data=mediaOptions({extractor_key:'Generic',formats:[{format_id:'hls-360',protocol:'m3u8_native',vcodec:'h264',acodec:'aac',ext:'mp4',height:360},{format_id:'dash-a',protocol:'http_dash_segments',vcodec:'none',acodec:'aac',ext:'m4a'},{format_id:'rtsp',protocol:'rtsp',vcodec:'h264',acodec:'aac'}]},'id');
  assert.equal(data.source,'Generic');assert.equal(data.formats.length,3);
  assert.throws(()=>mediaOptions({has_drm:true},'id'));
  assert.throws(()=>mediaOptions({availability:'needs_auth'},'id'));
  assert.match(publicError('DRM'),/protegida/);
  assert.match(publicError('Transmissões ao vivo'),/sob demanda/);
});
test('forward proxy blocks redirect-like requests and CONNECT to private targets',async()=>{
  const proxy=createEgressProxy();await new Promise<void>(done=>proxy.listen(0,'127.0.0.1',done));const addr=proxy.address();assert.ok(addr&&typeof addr!=='string');
  try{
    const code=await new Promise<number>((done,fail)=>{http.get({host:'127.0.0.1',port:addr.port,path:'http://169.254.169.254/latest/meta-data'},response=>{response.resume();done(response.statusCode!);}).on('error',fail);});assert.equal(code,403);
    const text=await new Promise<string>((done,fail)=>{const socket=net.connect(addr.port,'127.0.0.1',()=>socket.write('CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n'));socket.on('data',data=>{done(data.toString());socket.destroy();});socket.on('error',fail);});assert.match(text,/403/);
  }finally{await new Promise<void>(done=>proxy.close(()=>done()));}
});
test('returns only source formats with no DRM and rejects live media while allowing long/large/unknown-size media',()=>{
  const media=mediaOptions({title:'My media',formats:[{format_id:'1',protocol:'https',vcodec:'h264',acodec:'aac',ext:'mp4',height:720,filesize:1000},{format_id:'2',protocol:'https',vcodec:'h264',acodec:'aac',has_drm:true},{format_id:'3',protocol:'rtmp',vcodec:'h264',acodec:'aac'}]},'id');
  assert.equal(media.formats.length,2);assert.ok(media.formats.some(f=>f.id==='v:1'));assert.equal(media.formats[0].estimated,false);
  assert.throws(()=>mediaOptions({is_live:true},'id'));assert.equal(mediaOptions({duration:7200,formats:[{format_id:'large',vcodec:'h264',acodec:'aac',filesize:50*1024**3}]},'id').duration,7200);assert.equal(mediaOptions({formats:[{format_id:'unknown',vcodec:'h264',acodec:'aac'}]},'id').formats[0].size,undefined);
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
