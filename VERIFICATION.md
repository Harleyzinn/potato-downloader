# Verificação da entrega

Data: 24/10/2026, America/Sao_Paulo.

## Identidade e seleção pública v2.2

- Nome implementado: Potato Dumper, incluindo título/descrição da página, marca textual, logo ASCII desktop, versão compacta, rodapé, pacote npm e documentação.
- Repositório `Harleyzinn/potato-downloader`, caminho base `/potato-downloader/`, chaves de preferências e configuração Pages preservados. A mudança de nome não renomeia URLs.
- A seleção pública passa a se chamar “Algumas fontes compatíveis”. Dois nomes e suas variantes foram retirados de exemplos, cartões e pesquisa visual, sem modificar o executável ou as regras de URL.
- A API técnica mantém 1.755 entradas, incluindo os extratores omitidos visualmente. Os testes de aceitação dos hostnames ocultos validam apenas a sintaxe e ausência de uma allowlist, sem acessar esses sites ou alegar downloads verificados.
- `backend/security.ts`, os argumentos de extração, o caminho base e o workflow permanecem inalterados nesta revisão. A única alteração no catálogo do backend remove exemplos públicos; a filtragem do frontend não participa da extração.
- Dez testes automatizados, lint, tipos e build aprovados localmente. Interface conferida em 390 px sem overflow horizontal; pesquisa visual por ambos os nomes retorna uma mensagem de lista parcial, não de bloqueio.
- A comparação documental Cobalt/yt-dlp está no README. Não foi executado benchmark com Cobalt nem registrada uma nova plataforma como testada. Mantido yt-dlp + FFmpeg para preservar os fluxos reais anteriores e evitar um segundo backend sem ganho comprovado.

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
- Registro histórico da v2.1: havia dois processos, limite de 100 MiB/20 min e 8 min de preparação, com retenção de 15 min. As cotas de bytes e duração foram removidas na v3.1; consulte a seção atual abaixo. HLS/DASH ao vivo, DRM e acesso autenticado não foram habilitados.
- A hospedagem continua sendo Pages + backend local por túnel temporário. Foram consultadas as limitações oficiais do Quick Tunnel (sem uptime garantido, 200 requisições em voo, sem SSE) e termos de uso; não há promessa de operação permanente ou autorização universal de conteúdo pelo provedor.


## Sem cota de bytes da aplicação — v3.1

Estado atual: sem filtros de tamanho/duração de mídia, sem --max-filesize, sem quota de soma de ZIP, disco ou tráfego por sessão. Concorrência, frequência, SSRF, isolamento de sessão e limites de metadados permanecem. Preparo/ZIP usam watchdog de atividade, sem prazo total; transferências têm timeout de inatividade e suporte GET/HEAD/Range. Arquivos prontos têm janela para iniciar, que não interrompe operação ativa. Saídas incompletas, intermediários, fontes já incorporadas no ZIP e cópias inteiramente enviadas são limpos.

Integrações reais: Big Buck Bunny HLS da Mux (1080p), total desconhecido durante a origem, 488.204.087 bytes finais; ZIP de 488.204.307 bytes. Execuções local e pela URL pública HTTPS do túnel, download completo por streaming, CRC válido. Execução HTTPS: 141 s; SHA-256 do ZIP recebido: 76e6975fde1b1a26ada4fd3c864dfe155b5886dbdda7aa4cdebf6e8d5bf2ff0a. O hash registra o artefato recebido; os metadados de data do ZIP diferem entre execuções.

Também verificados HEAD, Range, 416, remoção pós-envio, fontes arquivadas, recuperação do ZIP pela sessão e bloqueio de outra sessão. Testes isolados simulam metadados de 50 GiB/2 h, faixas de 6 GiB, erros ENOSPC/EDQUOT e inatividade. Não houve teste real >4 GiB, disco cheio ou implantação Docker/Caddy neste host sem Docker; apenas a sintaxe do Caddyfile foi validada com o CLI oficial, sem iniciar serviços. O volume em disco e o HTTPS direto são uma alternativa preparada, não infraestrutura contratada/provisionada. Testes não garantem todos os tamanhos/fontes ou a capacidade máxima da infraestrutura.


## Batatubo 4.0.0-beta.1 / 25-10-2026

A evolução mantém o mecanismo yt-dlp, a ausência de cotas de bytes e as verificações históricas acima. Os números de mídia grande da v3.1 são evidências daquela versão, não novos testes repetidos automaticamente.

- 24 testes locais passaram: segurança/SSRF, fila, formatos, ranges, inatividade, contraste dos cinco temas, preferências, destino com acentos/espaços, conflito sem sobrescrita e streaming com cancelamento de parcial. Tipos, lint e build web foram executados; checks finais estão registrados na execução do CI.
- Prévia imediata dos cinco temas conferida na interface. Light Paper, fonte 17, densidade compacta e movimento desligado persistiram após recarregar. Em viewport de 390 px, largura do conteúdo de 375 px sem overflow horizontal observado. Não é uma auditoria completa de tecnologia assistiva.
- Aplicativo Windows empacotado abriu; a preparação inicial obteve yt-dlp/FFmpeg e o motor local ficou conectado. Integração manual real com `mov_bbb.mp4` da W3Schools: 788.493 bytes gravados no disco. O conflito foi mostrado e foi criada a cópia `mov_bbb (4).mp4`, sem substituir o arquivo existente.
- Instalador NSIS gerado com sucesso. Telas nativas conferidas: boas-vindas e arte ASCII, instalação apenas para usuário sem elevação, seleção de pasta e espaço necessário, resumo do destino e opções de atalhos desmarcadas. Caminho de teste dentro de `.runtime/instalação teste/Batatubo`.
- Não existe Windows Sandbox disponível nesta máquina. Testes locais usam o Windows atual, com ferramentas de desenvolvimento presentes; não confirmam execução em uma máquina limpa, sob outro antivírus, em ARM64 ou em todas as versões do Windows. O pacote é uma pré-release sem assinatura digital.

Instalação de teste concluída pelo assistente NSIS no Windows atual em `.runtime/instalação teste/Batatubo`, com espaço e acento. A tela final confirmou a instalação. Desinstalação executada pelo desinstalador gerado, modo silencioso, terminou com código 0; o executável instalado foi removido e o vídeo de 788.493 bytes em Downloads permaneceu intacto. A opção de remover preferências não foi selecionada. Isso não comprova instalação em máquina limpa. Os artefatos distribuídos são recompilados a partir do código final no runner Windows, com checks e SHA-256 próprios.
