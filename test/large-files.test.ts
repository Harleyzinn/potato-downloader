import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {byteRange} from '../backend/ranges.ts';
import {activityWatch} from '../backend/activity.ts';
import {publicError} from '../backend/engine.ts';
import {nextWork,isTerminal} from '../src/batch-model.ts';

test('HTTP ranges support large files, suffixes, and unknown source-size independent final files',()=>{
  const size=6*1024**3;
  assert.deepEqual(byteRange(undefined,size),{start:0,end:size-1,partial:false});
  assert.deepEqual(byteRange('bytes=4294967296-',size),{start:4294967296,end:size-1,partial:true});
  assert.deepEqual(byteRange('bytes=-64',size),{start:size-64,end:size-1,partial:true});
  assert.equal(byteRange(`bytes=${size}-`,size),undefined);
  assert.equal(byteRange('bytes=0-1,4-5',size),undefined);
  assert.equal(byteRange('bytes=-0',size),undefined);
});
test('storage and provider failures have useful sanitized messages',()=>{
  assert.match(publicError('ENOSPC /secret/location?token=private'),/sem espaço/);
  assert.ok(!publicError('ENOSPC /secret/location').includes('secret'));
  assert.match(publicError('EDQUOT'),/cota externa/);
  assert.match(publicError('HTTP 413 too large'),/restrição externa/);
  assert.match(publicError('stalled'),/sem avanço/);
});
test('queue monitors browser transfers until server delivery; archived/sent items are terminal',()=>{
  assert.equal(nextWork([{state:'browser',job:{state:'ready'}}],true)?.state,'browser');
  assert.equal(nextWork([{state:'sent',job:{state:'sent'}}],true),undefined);
  assert.ok(isTerminal('archived'));assert.ok(isTerminal('sent'));
});
test('worker watches activity rather than overall duration, then aborts real inactivity',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'potato-activity-test-'));
  assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));
  const controller=new AbortController(),watch=activityWatch(dir,controller,1000);
  try{
    for(let i=0;i<5;i++){await writeFile(join(dir,'media.part'),String(i));watch.touch();await new Promise(r=>setTimeout(r,300));}
    assert.equal(controller.signal.aborted,false); // Alive beyond the idle duration thanks to activity.
    await Promise.race([new Promise<void>(done=>controller.signal.addEventListener('abort',()=>done(),{once:true})),new Promise((_,fail)=>setTimeout(()=>fail(new Error('Missing idle abort')),4000).unref())]);
    assert.equal(controller.signal.reason,'stalled');
  }finally{watch.stop();await rm(dir,{recursive:true,force:true});}
});
