# Verificação da entrega

Data: 24/10/2026, America/Sao_Paulo.

- Instalação limpa com `npm ci`: aprovada. npm audit retornou zero vulnerabilidades na instalação.
- ESLint, TypeScript, seis testes isolados e build de produção: aprovados localmente e no GitHub Actions.
- Primeira implantação oficial no Pages: workflow `40114733134`, jobs `check-build` e `deploy` aprovados.
- URL pública carregada: https://harleyzinn.github.io/potato-downloader/.
- CORS observado no motor HTTPS: `Access-Control-Allow-Origin: https://harleyzinn.github.io`. Origem alheia bloqueada com HTTP 403.
- Áudio público `File:Example.ogg` do Wikimedia Commons: análise com formatos MP3/OGG, modo vídeo corretamente desabilitado, origem OGG convertida para MP3 no backend.
- Download acionado na interface **publicada**: navegador recebeu `Example.mp3`, 74.383 bytes. SHA-256: `00DC3AAC9141BEABCECE97905F306C8350D82E5C896C240C5454B8E7EA52E4DD`.
- Vídeo público: trecho de 23 segundos de Big Buck Bunny (Blender Foundation, CC BY 3.0, Wikimedia Commons), WebM 240p com áudio, 957.029 bytes; preparado e transmitido pela API.
- YouTube: análise real do filme oficial da Blender Foundation retornou título, duração de 635 s e 46 opções de origem. Download e junção pela API produziram MP4 de 35.624.855 bytes. ffmpeg confirmou vídeo AV1 256x144 e áudio AAC 48 kHz, e decodificou amostra com sucesso. Disponibilidade depende do IP e da plataforma.
- Interface: URL vazia com mensagem e foco; Enter inicia análise; envio duplicado bloqueado; opções incompatíveis desabilitadas; preferências persistidas e restauradas; tecla Tab avança ao próximo seletor; layouts 390 e 1280 px sem overflow horizontal; idioma acentuado e decoração ASCII.
- Segurança: testes reais contra proxy local bloquearam HTTP para metadata de rede privada e CONNECT para loopback; testes isolados cobriram IPv4/IPv6 reservados e mapeados.
- Não houve API simulada no fluxo entregue. Testes isolados não substituíram downloads reais.

## Limites da verificação

- A publicação conecta a um **backend temporário** nesta máquina via Cloudflare Quick Tunnel. Não garante funcionamento depois de desligar a máquina/túnel. Para disponibilidade contínua é necessário servidor permanente.
- Não foram validados downloads de todas as plataformas da allowlist, todo tipo de galeria, carga simultânea sustentada, encerramento abrupto do sistema ou instalação Docker em Linux.
- O aplicativo informa download iniciado pelo navegador; ele não tem acesso para confirmar a gravação de arquivos no dispositivo do visitante. A conclusão acima foi observada externamente no teste.
- Não foram usados cookies, login, conteúdo privado ou mecanismos de bypass.
## Ampliação v2.1

- Inventário real via `yt-dlp --list-extractors`: 1.755 entradas na versão 2026.10.21, incluindo 136 marcadas como quebradas. Não são 1.755 plataformas comprovadas.
- Pornhub e XVideos constam no executável instalado e na documentação oficial. Não foram realizados downloads de conteúdo adulto; não são marcados como testados.
- Descoberta ampla substitui a allowlist da primeira versão. O extrator efetivamente escolhido aparece na mídia analisada; o catálogo pode ser atualizado ao reiniciar o backend sem reconstruir a interface.
- Áudio direto HTTPS (`upload.wikimedia.org/.../Example.ogg`): cabeçalho local inspecionado, fonte Generic, MP3 de 74.383 bytes preparado e transferido.
- Vídeo direto HTTPS (`w3schools.com/html/mov_bbb.mp4`): fonte Generic, MP4 de 788.493 bytes preparado e transferido, amostra decodificada pelo FFmpeg com vídeo H.264 320x176 e áudio AAC.
- HLS VOD (`test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`): dez opções reais (vídeo e extração de áudio), variante 184p baixada pelo downloader nativo, MP4 de 20.049.873 bytes preparado e transferido.
- DASH VOD (`dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd`): onze opções reais, vídeo 180p e áudio separados baixados e unidos pelo FFmpeg; MP4 de 21.210.203 bytes preparado e transferido.
- Esses vídeos de teste são Big Buck Bunny, Blender Foundation, CC BY 3.0; o áudio público mantém sua licença na página do Wikimedia Commons. Mídias de teste não estão no repositório.
- Nove testes automatizados cobrem validação de URLs/IPs, proxy, sondagem limitada de arquivos diretos, catálogo instalado/quebrado, DRM/autenticação, formatos VOD, nomes, mensagens e progresso. Sem mocks no fluxo entregue.
- Limites existentes permanecem: dois processos, 100 MiB, 20 min, 8 min de preparação, arquivos temporários por 15 min. HLS/DASH ao vivo, DRM e acesso autenticado não foram habilitados.
- A hospedagem continua sendo Pages + backend local por túnel temporário. Foram consultadas as limitações oficiais do Quick Tunnel (sem uptime garantido, 200 requisições em voo, sem SSE) e termos de uso; não há promessa de operação permanente ou autorização universal de conteúdo pelo provedor.
