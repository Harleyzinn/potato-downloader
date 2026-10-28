import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {safeName,inside,uniqueDestination,writeDownload} from '../desktop/files.ts';
import {palettes,normalizeAppearance} from '../src/appearance.ts';
import {SavedDestinations} from '../desktop/destinations.ts';
test('saved destinations are bound to completed transfer IDs, bounded and never supplied by the renderer',()=>{
  const files=new SavedDestinations(2);files.remember('first','C:/Destino antigo/ação.mp4');
  assert.equal(files.find('first'),'C:/Destino antigo/ação.mp4');assert.equal(files.find('../escape'),undefined);
  files.remember('second','D:/Outra pasta/video.mp4');files.remember('third','D:/Outra pasta/audio.mp3');
  assert.equal(files.find('first'),undefined);assert.equal(files.find('second'),'D:/Outra pasta/video.mp4');
});
function luminance(hex:string){const colors=hex.slice(1).match(/../g)!.map(c=>{const n=parseInt(c,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return colors[0]*.2126+colors[1]*.7152+colors[2]*.0722;}
test('all theme text, accents, muted text and errors meet AA contrast on both surfaces',()=>{for(const p of Object.values(palettes))for(const foreground of [p.text,p.accent,p.muted,p.dim,p.danger,p.success])for(const background of [p.bg,p.panel]){const a=luminance(foreground),b=luminance(background);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${p.name}: ${foreground} on ${background}`);}});
test('appearance preferences accept only supported values and preserve deterministic defaults',()=>{assert.deepEqual(normalizeAppearance({theme:'__proto__',font:99,density:'bad'} as never),{theme:'classic',font:13,density:'comfortable',motion:false,crt:false});assert.equal(normalizeAppearance({theme:'system',motion:true,font:17}).theme,'system');});
test('native destinations preserve accents, reject traversal/reserved names, and never replace collisions',async()=>{const folder=await mkdtemp(join(tmpdir(),'batatubo espaço ação-'));try{assert.equal(safeName('../../CON.txt'),'batatubo-CON.txt');assert.equal(safeName('..\\pasta\\vídeo.mp4'),'vídeo.mp4');assert.equal(inside(folder,join(folder,'..','escape')),false);const dest=await uniqueDestination(folder,'vídeo ação.mp4');await writeFile(dest.file,'existing');const renamed=await uniqueDestination(folder,'vídeo ação.mp4');assert.equal(renamed.renamed,true);assert.match(renamed.file,/\(1\)/);await assert.rejects(writeDownload(new Response('new'),dest.file,new AbortController().signal,()=>{}));assert.equal(await readFile(dest.file,'utf8'),'existing');assert.deepEqual(await readdir(folder),['vídeo ação.mp4']);}finally{await rm(folder,{recursive:true,force:true});}});
test('native streaming handles unknown size incrementally and cleans cancelled partials',async()=>{const folder=await mkdtemp(join(tmpdir(),'batatubo stream-'));try{const dest=join(folder,'saved.mp4');let n=0;const stream=new ReadableStream<Uint8Array>({pull(controller){if(n++<20)controller.enqueue(new Uint8Array(128*1024));else controller.close();}});const samples:number[]=[];assert.equal(await writeDownload(new Response(stream),dest,new AbortController().signal,n=>samples.push(n)),20*128*1024);assert.ok(samples.length>1);const cancel=new AbortController();const source=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(1024));}});await assert.rejects(writeDownload(new Response(source),join(folder,'cancel.mp4'),cancel.signal,()=>cancel.abort()));assert.deepEqual(await readdir(folder),['saved.mp4']);}finally{await rm(folder,{recursive:true,force:true});}});
