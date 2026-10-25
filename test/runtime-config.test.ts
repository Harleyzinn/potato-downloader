import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicAPI} from '../src/runtime-config.ts';
test('deployment configuration accepts only a public HTTPS base without credentials or query secrets',()=>{
  assert.equal(publicAPI('https://api.example.org/'),'https://api.example.org');
  for(const url of ['javascript:alert(1)','file:///etc/hosts','http://api.example.org','https://user:secret@api.example.org','https://api.example.org?token=secret','https://api.example.org/api','https://api.example.org:9999','https://localhost',undefined])assert.equal(publicAPI(url),'');
});
