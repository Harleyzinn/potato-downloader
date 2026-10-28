import {test} from 'node:test';
import assert from 'node:assert/strict';
import {queueMatches,queueTotals} from '../src/queue-view.ts';
import {archiveEntryName} from '../backend/archive-name.ts';
test('queue search ignores accents and filters real preparation and disk states without changing order',()=>{
  const items=[{title:'Canção final',state:'ready'},{title:'Video',state:'sent',native:{state:'saved'}},{title:'Outro',state:'sent',native:{state:'error'}},{title:'Cancelado',state:'cancelled'}];
  assert.equal(queueMatches(items[0],'ready','CANCAO'),true);
  assert.equal(queueMatches(items[0],'done',''),false);assert.equal(queueMatches(items[1],'done',''),true);assert.equal(queueMatches(items[2],'error',''),true);
  assert.deepEqual(items.filter(i=>queueMatches(i,'all','')).map(i=>i.title),['Canção final','Video','Outro','Cancelado']);
  assert.deepEqual(queueTotals(items),{total:4,available:1,prepared:3,failed:0,cancelled:1,remaining:0,saved:1,writeFailed:1});
  assert.equal(queueMatches({title:'x',state:'ready',native:{state:'writing'}},'ready',''),false);
  assert.equal(queueMatches({title:'x',state:'browser',native:{state:'saved'}},'active',''),false);
});
test('ZIP applies one generated sequence and preserves numbers authored in the title',()=>{
  assert.equal(archiveEntryName('001-video.mp4',1,1),'001-video.mp4');
  assert.equal(archiveEntryName('005-video.mp4',2,5),'002-video.mp4');
  assert.equal(archiveEntryName('001-titulo.mp4',3),'003-001-titulo.mp4');
  assert.equal(archiveEntryName('../video.mp4',1),'001-video.mp4');
});
