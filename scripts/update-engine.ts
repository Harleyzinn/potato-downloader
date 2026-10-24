import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const executable=process.env.YTDLP_PATH||(existsSync(resolve('.runtime/yt-dlp.exe'))?resolve('.runtime/yt-dlp.exe'):'yt-dlp');
const result=spawnSync(executable,['--ignore-config','--no-plugin-dirs','--update'],{stdio:'inherit',windowsHide:true});
if(result.error){console.error('Motor não encontrado. Configure YTDLP_PATH ou siga a instalação no README.');process.exit(1);}
if(result.status!==0){console.error('Em instalações Python/Docker, atualize o pacote na imagem e reconstrua o contêiner.');process.exit(result.status||1);}
console.log('Reinicie o backend para recarregar a versão e o catálogo. Testes antigos mantêm a versão em que foram realizados.');
