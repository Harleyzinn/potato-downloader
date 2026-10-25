import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('desktop-build',{recursive:true});
await build({entryPoints:['desktop/main.ts'],bundle:true,platform:'node',format:'cjs',outfile:'desktop-build/main.cjs',external:['electron']});
await build({entryPoints:['backend/server.ts'],bundle:true,platform:'node',format:'esm',outfile:'desktop-build/backend.mjs',packages:'external'});
await copyFile('backend/verified-sources.json','desktop-build/verified-sources.json');
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...process.env,BATATUBO_DESKTOP:'1',VITE_API_URL:''},stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
