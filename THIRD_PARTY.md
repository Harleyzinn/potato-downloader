# Batatubo / componentes de terceiros

O código original deste repositório está sob MIT (LICENSE). Electron, Chromium e Node.js são distribuídos no aplicativo; seus textos de licença e créditos acompanham o pacote Electron (`LICENSE.electron.txt` e `LICENSES.chromium.html`). As versões exatas estão no package-lock.json. Archiver e ipaddr.js usam MIT; ffmpeg-static (MIT) é usado pelo backend de desenvolvimento.

## Motores locais gerenciados, sem redistribuição no instalador

O instalador **não contém os executáveis de yt-dlp ou FFmpeg**. Na primeira abertura, o usuário pode preparar o motor. O aplicativo baixa diretamente dos projetos de origem os arquivos fixados em `desktop/engines.json`, valida SHA-256 do download e do executável descompactado e só então os executa. Avisos de licença e fontes ficam em `%APPDATA%/Batatubo/engines`. Nenhuma atualização de motor é automática; uma nova versão exige revisão do manifesto, testes e nova release.

- yt-dlp 2026.10.21: código-fonte Unlicense; o executável Windows PyInstaller inclui dependências e é GPL-3.0-or-later. [Release, fontes e termos](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.21), [licenças agregadas](https://github.com/yt-dlp/yt-dlp/blob/2026.10.21/THIRD_PARTY_LICENSES.txt). O hash foi comparado ao SHA2-256SUMS publicado nessa release.
- FFmpeg 6.1.1 essentials, distribuído pelo projeto ffmpeg-static b6.1.1: GPL v3. [Distribuição original, licença e README](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1), [FFmpeg correspondente](https://github.com/FFmpeg/FFmpeg/commit/e38092ef93). O README do fornecedor informa a configuração e a proveniência do build Gyan. Os hashes do arquivo gzip e do executável foram fixados após obtenção por HTTPS e conferência com o executável instalado por ffmpeg-static 5.3.0. Não representam uma assinatura digital do fornecedor.

Arquivos são programas independentes invocados como subprocessos, sem ligação às bibliotecas do aplicativo. Os usuários mantêm os direitos concedidos por suas licenças, incluindo substituir os programas; o gerenciador verifica a versão fixada para evitar execução de arquivos alterados. Para usar outra versão, altere o manifesto em seu próprio build. Antes de redistribuir esses executáveis em um pacote próprio, providencie todas as obrigações de redistribuição e fontes correspondentes das respectivas licenças. O Batatubo não os inclui como binários em sua release.

## Fontes e segurança

- [Electron: segurança](https://www.electronjs.org/docs/latest/tutorial/security), [isolamento de contexto](https://www.electronjs.org/docs/latest/tutorial/context-isolation).
- [Tauri: distribuição](https://tauri.app/distribute/): avaliado como alternativa. Foi escolhido Electron por compartilhar o backend Node.js existente e fornecer o runtime sem instalação de Node/Python/Rust pelo usuário. O custo é um instalador maior que um shell com WebView.
- [electron-builder / NSIS](https://www.electron.build/nsis.html): instalador assistido por usuário, telas nativas e desinstalador. O layout nativo não pode reproduzir toda a página web; as artes e o menu ASCII ficam nas páginas personalizadas.

Não há certificado de assinatura de código. Checksums verificam integridade, não identidade certificada. Não é necessário desativar nenhuma proteção do Windows.
