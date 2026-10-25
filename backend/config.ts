import {join} from 'node:path';
import {tmpdir} from 'node:os';
export const config={
  port:Number(process.env.PORT??8787),host:process.env.HOST||'127.0.0.1',
  origins:(process.env.ALLOWED_ORIGINS||'https://harleyzinn.github.io,http://127.0.0.1:5173,http://localhost:5173').split(',').map(x=>x.trim()),
  tempRoot:process.env.TEMP_ROOT || join(tmpdir(),'potato-downloader'),
  maxConcurrent:2,ttl:15*60*1000,
  idleMs:Math.max(1000,Number(process.env.WORKER_IDLE_MS)||10*60*1000),
  streamIdleMs:Math.max(1000,Number(process.env.STREAM_IDLE_MS)||5*60*1000),
  temporary:process.env.TEMPORARY_HOST==='1',
  maxBatch:20,playlistPage:25,maxPlaylist:200,
};
