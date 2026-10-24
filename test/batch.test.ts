import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRange,uniqueURLs,chooseFormat,itemBar,nextWork,movePending} from '../src/batch-model.ts';
import {validateURL} from '../src/service.ts';
import {discovery} from '../backend/discovery.ts';
import type {Media} from '../src/types.ts';
test('range selection accepts mixed ranges and rejects unbounded/invalid input',()=>{
  assert.deepEqual([...parseRange('1,3,5–8',12)],[1,3,5,6,7,8]);
  for(const value of ['0','3-1','1-9999999','2,a',''])assert.throws(()=>parseRange(value,20));
});
test('URL deduplication preserves required queries and reports line errors',()=>{
  const value=uniqueURLs(['https://example.com/a?v=1','https://example.com/a?v=1','https://example.com/a?v=2','javascript:bad'],validateURL);
  assert.equal(value.duplicates,1);assert.equal(value.urls.length,2);assert.match(value.errors[0],/Linha 4/);
});
test('format preference never silently switches missing mode or quality',()=>{
  const media:Media={id:'x',title:'x',formats:[{id:'v:1',mode:'video',label:'720p / mp4',ext:'mp4',estimated:false}]};
  assert.equal(chooseFormat(media,'audio','max'),undefined);assert.equal(chooseFormat(media,'video','480'),undefined);assert.equal(chooseFormat(media,'video','1080')?.id,'v:1');
  assert.equal(itemBar(1,3),'[#######-------------] 1/3 itens finalizados');
});
test('playlist pagination preserves unavailable entries and marks partial totals',()=>{
  const entries=Array.from({length:26},(_,i)=>({id:String(i),title:`item ${i}`,url:`https://example.com/${i}`,playlist_index:i+1,duration:10}));
  const page=discovery({title:'playlist',playlist_count:100,entries},new URL('https://example.com/playlist'),1);
  assert.equal(page.items.length,25);assert.equal(page.next,26);assert.equal(page.duration,undefined);assert.equal(page.incomplete,true);
  const invalid=discovery({entries:[null,{title:'[Private video]',availability:'private'}, {title:'internal',url:'http://localhost/a'}]},new URL('https://example.com/playlist'),1);
  assert.ok(invalid.items.every(x=>x.availability==='unavailable'&&!x.url));
});
test('queue continues beyond failure/cancellation, pause monitors accepted jobs, and only pending items move',()=>{
  const list=[{state:'error',id:1},{state:'cancelled',id:2},{state:'waiting',id:3},{state:'waiting',id:4}];
  assert.equal(nextWork(list,false)?.id,3);assert.equal(nextWork(list,true),undefined);
  assert.equal(movePending(list,2,1),true);assert.equal(nextWork(list,false)?.id,4);assert.equal(movePending(list,2,-1),false);
  assert.equal(nextWork([{state:'downloading',job:{state:'downloading'}}],true)?.state,'downloading');
  assert.equal(nextWork([{state:'ready'},{state:'browser'}],false),undefined);
});
