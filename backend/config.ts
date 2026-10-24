import {join} from 'node:path';
import {tmpdir} from 'node:os';
export const config={
  port:Number(process.env.PORT||8787),host:process.env.HOST||'127.0.0.1',
  origins:(process.env.ALLOWED_ORIGINS||'https://harleyzinn.github.io,http://127.0.0.1:5173,http://localhost:5173').split(',').map(x=>x.trim()),
  tempRoot:process.env.TEMP_ROOT || join(tmpdir(),'potato-downloader'),
  maxBytes:100*1024*1024,maxDuration:1200,maxConcurrent:2,ttl:15*60*1000,
  temporary:process.env.TEMPORARY_HOST==='1',
};
