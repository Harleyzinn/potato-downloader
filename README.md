# [B] Batatubo / Tubo Edition

**Sua mídia passa pelo tubo. A batata fica.** Batatubo junta batata com o tubo por onde a mídia passa. É a evolução do Potato Dumper; o repositório, o endereço do Pages e as chaves de preferências anteriores foram preservados.

- [Abrir versão web](https://harleyzinn.github.io/potato-downloader/)
- [Windows x64 / 4.0.0-beta.2 / instalador e SHA-256](https://github.com/Harleyzinn/potato-downloader/releases/tag/v4.0.0-beta.2)
- [Código e histórico](https://github.com/Harleyzinn/potato-downloader)

## Instalar e usar no Windows

1. Abra a release acima e baixe `Batatubo-4.0.0-beta.2-Windows-x64-Setup.exe`. Confira o SHA-256 com `SHA256SUMS.txt` da mesma release.
2. Execute o instalador assistido por usuário. Escolha a pasta, reveja o resumo e marque os atalhos que desejar. Nenhum início automático é criado. O desinstalador aparece nas configurações de aplicativos do Windows.
3. Abra o aplicativo. Na primeira abertura, clique em **Preparar motor local**. Ele obtém yt-dlp e FFmpeg diretamente dos distribuidores de origem por HTTPS, confere os hashes fixados e mostra bytes reais. Essa etapa precisa de conexão e espaço, mas não exige terminal, Node ou Python instalados pelo usuário.
4. Em Ajustes, escolha a pasta padrão. O aplicativo lembra essa preferência, lista até 100 nomes existentes sob demanda e oferece abrir a pasta. Conflitos geram uma confirmação para salvar outra cópia; não há sobrescrita silenciosa.
5. Prepare a mídia e clique em baixar. A preparação ocorre no motor local, fora da interface. O painel de transferências acompanha a gravação por streaming e confirma o fechamento do arquivo no disco. Cancelamentos removem o arquivo parcial. Ao fechar com tarefas ativas, o aplicativo oferece continuar ou cancelar e sair.

**Pré-release sem assinatura digital**, para Windows 10 ou posterior, x64. Não é necessário desativar proteções do Windows. Compilação e testes automatizados não equivalem a validação em máquina limpa; consulte [VERIFICATION.md](VERIFICATION.md) para as etapas efetivamente executadas. O instalador contém Electron e o aplicativo; os executáveis de extração/conversão são gerenciados na primeira abertura, sem redistribuição deles no instalador. Versões, hashes e licenças: [THIRD_PARTY.md](THIRD_PARTY.md) e [desktop/engines.json](desktop/engines.json).

Atualizações preservam o perfil `%APPDATA%/Batatubo` e os arquivos baixados. A remoção das preferências é uma opção desmarcada do desinstalador. Downloads ficam fora dos dados internos e não são removidos. Os motores obtidos anteriormente ficam no perfil para uma eventual reinstalação. Não há atualizador silencioso: Sobre permite consultar releases do GitHub, sem baixar ou instalar uma nova versão.

## Novidades da beta 2

- Busca por título na fila, ignorando acentos, e filtros por andamento, arquivos disponíveis, enviados/gravados, falhas e cancelamentos. Eles afetam só a visualização: a ordem e a execução permanecem as mesmas.
- Contadores separados de preparados, disponíveis, falhas e gravações no desktop. O resultado nativo aparece também na fila e no estado do ZIP, sem confundir envio pelo servidor com gravação local.
- Nova tentativa por item, inclusive após cancelamento ou falha de gravação, preparando outra cópia sem sobrescrever o arquivo existente.
- Mostrar arquivo na pasta usa o destino daquela transferência, mesmo após trocar a pasta padrão. Essa associação é temporária, limitada a 100 arquivos e não é persistida como histórico.
- ZIP aplica a numeração uma vez, preservando números que fazem parte do título original.
- O estado do motor é revisto ao recuperar a conexão ou retornar à página; verificações simultâneas são agrupadas.

## Temas e terminal ASCII

Cinco paletas: **Potato Classic**, **Terminal Green**, **Amber CRT**, **Ice Terminal** e **Light Paper**. A escolha tem prévia imediata e persistência; também é possível acompanhar o sistema. Fonte de 12, 13, 15 ou 17 px, densidade confortável/compacta, redução de movimento e scanlines opcionais (desligadas por padrão). Restauração de aparência e preferências disponível. Os testes de contraste verificam texto, detalhes, acentos e erros sobre os dois fundos, com razão mínima 4,5:1. Isso não substitui uma auditoria completa de acessibilidade.

HTML semântico com artes decorativas fora da leitura assistiva, foco visível e controles por teclado. Alt+1 a Alt+5 abrem Downloads, Ajustes, Ajuda, Fontes e Sobre. Alt+L foca o link e Alt+Q abre a fila. Tab/Shift+Tab percorrem os controles. Escape cancela a preparação individual ativa dentro do aplicativo. O painel de atividade guarda apenas etapas em memória; o diagnóstico exportado não inclui links, títulos de mídia, caminhos ou tokens.

## Arquitetura desktop e build

A versão web e o desktop compartilham os mesmos módulos TypeScript, temas, playlists, fila, formatos e progresso real. yt-dlp e FFmpeg continuam sendo o mecanismo de extração e conversão: não houve troca de motor.

Foi escolhido **Electron + NSIS**. Tauri foi avaliado: seu shell pode ser menor, mas reutilizar este backend Node exigiria empacotar outro runtime ou reimplementar a coordenação em Rust. Electron já oferece Chromium e Node, permitindo um subprocesso local do backend existente. O custo é um instalador maior (aproximadamente 120 MiB nesta prévia; o valor exato consta na release), além do espaço dos motores na primeira abertura. [Segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security), [distribuição Tauri](https://tauri.app/distribute/), [NSIS no electron-builder](https://www.electron.build/nsis.html).

```text
[ interface compartilhada / renderer sem Node ]
       | APIs nativas restritas / contexto isolado
[ Electron main ] ----> [ pasta escolhida / streaming / .partial ]
       | subprocesso local, apenas enquanto o app estiver aberto
[ backend Node / loopback / porta aleatória / token por execução ]
       | proxy com pinagem DNS e proteção contra SSRF
[ yt-dlp ] --------> [ FFmpeg ] --------> [ arquivos temporários ]
```

Sandbox, isolamento de contexto e webSecurity ficam habilitados. IPC aceita apenas o frame principal dos arquivos locais esperados; não expõe shell, comando, caminho arbitrário de mídia ou URL nativa de download. A camada nativa reconstrói a URL do arquivo a partir de uma capacidade validada. O backend local exige token efêmero em todas as requisições, preserva o proxy contra SSRF e não registra URLs completas. Nenhum processo permanece por opção padrão após fechar normalmente.

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build             # web / GitHub Pages
npm run desktop:dev       # interface e motor locais
npm run desktop:pack      # aplicativo sem instalador, para inspeção
npm run desktop:dist      # instalador NSIS em release/
```

O instalador nativo tem páginas ASCII próprias de boas-vindas e revisão; seleção de pasta, progresso, conclusão e desinstalação usam controles nativos do NSIS. Ele não imita a página web e não implementa todos os temas dentro do instalador. Arquivo fonte: `desktop/installer.nsh`; identidade estável: `io.harleyzinn.batatubo`. Não altere esse identificador ao atualizar.

### Publicar e atualizar

`pages.yml` executa lint, tipos, testes e build antes de publicar o frontend no endereço existente. `desktop.yml` compila em runner Windows, gera o instalador, calcula SHA-256 e guarda artefatos. Publica uma **pré-release** após um push validado em main, por tag `v*` ou pela execução manual com `publish` marcado. Builds posteriores da mesma versão atualizam os artefatos dessa pré-release. A versão vem de package.json; o link no site e as notas devem acompanhar essa versão. Binários ficam em releases, nunca no histórico Git.

Para atualizar o motor desktop, revise `desktop/engines.json`: URL versionada do fornecedor, SHA-256 publicado quando disponível e hash do executável descompactado. Refaça as integrações reais e publique outra versão. Os hashes conferem integridade; não são assinatura do fornecedor. Não há execução de um arquivo cujo hash não corresponda ao manifesto. Atualizar apenas o backend remoto continua possível com `npm run engine:update` e reinício, sem reescrever a UI.

A seguir ficam as instruções do servidor web, cobertura, proteções e evidências anteriores, que continuam aplicáveis. **Sem limite de tamanho imposto pela aplicação**; disco, memória dos processos, rede, proxy, sistema de arquivos e origem ainda têm restrições próprias. A fila continua com até 20 itens, playlists em páginas de 25 até 200 itens, um preparo por fila, dois processos globais e controles de frequência. A instalação desktop evita depender do túnel remoto, mas não evita restrições da plataforma de origem.

---

Downloader de mídia com identidade própria em ASCII. Frontend em português, tons de batata, análise real de formatos e preparação de arquivos com **yt-dlp + ffmpeg**. Não usa API, instância nem código do Cobalt.

- **Frontend:** https://harleyzinn.github.io/potato-downloader/
- **Código:** https://github.com/Harleyzinn/potato-downloader

![Interface ASCII do Batatubo publicada no GitHub Pages](docs/interface.png)

## Estado da instalação

O frontend é permanente no GitHub Pages. A primeira instalação do backend usa **um túnel HTTPS temporário para este computador**, sem contratação ou cobrança. Ele só funciona enquanto o computador, o processo do motor e o `cloudflared` estiverem ligados. A interface avisa quando esse motor é temporário ou está desconectado. **Não é uma hospedagem de backend permanente.** Ao reiniciar o Quick Tunnel, atualize `public/backend.json` com a URL HTTPS pública e publique novamente. Esse arquivo público tem prioridade sobre `VITE_API_URL`; o desktop e o desenvolvimento local ignoram essa configuração. Não coloque credenciais nele.

Para funcionar continuamente com seu computador desligado, instale o backend em um servidor Linux/Docker que você controla, com endereço HTTPS estável. GitHub Pages não executa Node, Python, yt-dlp ou ffmpeg. Não é possível substituir esse servidor por um workflow de download ou por um arquivo estático.

## Arquitetura e escolhas

```text
GitHub Pages (HTML/CSS/TypeScript)
        | HTTPS + CORS
        v
Batatubo API (Node / TypeScript)
        | análise JSON / seleção de formato / processo limitado
        v
yt-dlp -> proxy local com validação e pinagem DNS -> plataforma pública
        | arquivo local -> ffmpeg quando necessário
        v
arquivo temporário -> streaming HTTP -> navegador
```

Vite + TypeScript sem framework de UI: componentes pequenos de apresentação, serviço tipado, preferências e estado separados. O yt-dlp detecta automaticamente a fonte pelo link HTTP/HTTPS e escolhe um extrator específico ou genérico. A API guarda as opções extraídas e aceita apenas esses IDs na preparação; não expõe um endpoint que encaminhe cegamente um destino arbitrário. O navegador não recebe comandos de execução nem decide caminhos de arquivos.

O backend usa o contrato documentado de `yt-dlp`: `--dump-single-json`, seleção `-f`, `--progress-template`, extração de áudio e arquivos locais. Nenhuma API pública de terceiros é presumida. O Cobalt foi pesquisado inicialmente e descartado; não é dependência deste projeto. [Documentação do yt-dlp](https://github.com/yt-dlp/yt-dlp#readme), [sites suportados pelo extrator](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md), [ffmpeg](https://ffmpeg.org/documentation.html), [GitHub Pages com Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Requisitos

- Node 24 recomendado (mínimo 22.12), npm e Git.
- yt-dlp instalado no servidor. Versão testada: **2026.10.21**.
- ffmpeg: `npm ci` instala o binário via `ffmpeg-static`; alternativamente configure `FFMPEG_PATH` para uma instalação do sistema.
- Acesso de rede às plataformas, disco temporário e permissão para executar processos.
- Hospedagem de backend com processos nativos e requisições longas. Funções serverless comuns não são adequadas a esta arquitetura.

## Instalação local no Windows

No PowerShell, na pasta onde deseja guardar o projeto:

```powershell
git clone https://github.com/Harleyzinn/potato-downloader.git
cd potato-downloader
npm ci
Copy-Item .env.example .env
New-Item -ItemType Directory -Force .runtime
Invoke-WebRequest https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.21/yt-dlp.exe -OutFile .runtime/yt-dlp.exe
npm run backend
```

Mantenha esse terminal aberto. Em outro terminal na mesma pasta:

```powershell
npm run dev
```

Abra **http://127.0.0.1:5173/potato-downloader/**. O Vite encaminha `/api` ao motor local em `127.0.0.1:8787`. Apenas `VITE_API_URL` vazio em desenvolvimento usa esse encaminhamento; não coloque a URL pública temporária no `.env` se quiser testar localmente.

### Conectar o Pages ao computador por HTTPS

Este modo serve para testes e uso temporário, sem garantia de uptime. [Limitações oficiais dos Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

```powershell
Invoke-WebRequest https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile .runtime/cloudflared.exe
.\.runtime\cloudflared.exe tunnel --url http://127.0.0.1:8787 --protocol http2 --no-autoupdate
```

Copie a URL **HTTPS** impressa pelo túnel e configure a variável de repositório `VITE_API_URL` conforme a seção Pages abaixo. Não aponte para portas de administração nem outros serviços. O túnel expõe apenas a API Potato local. Para sinalizar o modo temporário, inicie o backend com `$env:TEMPORARY_HOST='1'` antes de `npm run backend`.

O backend e o túnel foram deixados em execução na primeira entrega. Não dependem de uma instalação global ou alteração de configurações do Windows. Ao encerrá-los ou desligar o computador, a interface do Pages permanece disponível, mas a análise deixa de funcionar até reconectar um motor.

## Backend permanente com Docker

```sh
docker compose up -d --build
```

O Compose vincula a API apenas a `127.0.0.1:8787`, limita memória/CPU/processos e usa um volume em disco em `/work`, sem quota de bytes configurada pelo projeto. A capacidade física e cotas do host continuam aplicáveis. Configure seu proxy HTTPS ou túnel nomeado para encaminhar ao backend. Use um serviço já disponível; o projeto não cria contas, assinaturas ou infraestrutura cobrada.

Na hospedagem, use a imagem do `Dockerfile`, mantenha `HOST=0.0.0.0` dentro do contêiner e configure `ALLOWED_ORIGINS`. O backend não serve o frontend. O Dockerfile é fornecido para instalação reproduzível; sua execução em Linux/Docker não foi verificada neste computador sem Docker.

O Quick Tunnel usado na entrega é temporário. Não existe serviço gratuito permanente contratado/configurado automaticamente. Para publicação contínua, é necessário um servidor ou uma conta de hospedagem autorizada.

## Variáveis de ambiente

| Variável | Visibilidade | Uso |
|---|---|---|
| `VITE_API_URL` | **Pública**, incorporada ao JS | URL HTTPS da API, sem `/api` no final. Nunca coloque chave, senha ou token. |
| `HOST`, `PORT` | Servidor | Padrões `127.0.0.1`, `8787`. |
| `ALLOWED_ORIGINS` | Servidor | Origens exatas separadas por vírgula, incluindo `https://harleyzinn.github.io`. |
| `YTDLP_PATH` | Servidor | Executável confiável instalado pelo administrador. No Windows detecta `.runtime/yt-dlp.exe`. |
| `FFMPEG_PATH` | Servidor | Executável ffmpeg. Padrão do pacote `ffmpeg-static`. |
| `TEMP_ROOT` | Servidor | Pasta exclusiva para os temporários do Potato. Padrão na pasta temporária do sistema. |
| `TEMPORARY_HOST` | Servidor | `1` avisa na interface que a hospedagem é temporária. |

Esta implementação não requer credenciais de plataforma. `.env`, `.runtime` e binários baixados são ignorados pelo Git. Não habilita login, cookies, plugins de extrator, DRM ou acesso privado.

## Publicação no GitHub Pages

1. Em **Settings > Pages > Source**, selecione **GitHub Actions**.
2. Configure `public/backend.json` com a URL HTTPS pública do backend. Alternativamente, remova esse arquivo e crie a variável pública de repositório `VITE_API_URL` em **Settings > Secrets and variables > Actions > Variables**.
3. Envie para `main` ou execute **Actions > Checks and GitHub Pages > Run workflow**.
4. O workflow instala com `npm ci`, executa lint, tipos, testes, build e publica somente após passar. Pull requests executam checks sem publicação.

O caminho base do Vite é `/potato-downloader/`. Assets são emitidos nesse caminho e a navegação usa `#baixar`, `#ajustes` e `#ajuda`, sem necessidade de rewrite. A publicação usa `upload-pages-artifact` e `deploy-pages`, com `GITHUB_TOKEN` e permissões `pages: write` e `id-token: write` somente no job de deploy. Não usa token pessoal. Variáveis de repositório não são segredos; alterações de URL exigem novo build.

### CORS

O backend permite a origem exata `https://harleyzinn.github.io` (a origem não inclui `/potato-downloader/`). Permite preflight para GET, POST e DELETE com `Content-Type`, sem credenciais e sem wildcard. Não há cookies. Origens não autorizadas recebem 403. HTTPS no frontend exige HTTPS no backend, evitando conteúdo misto.

## Recursos e limites reais

- Validação do link; limpar, colar por ação explícita com fallback manual, Enter, cancelamento de análise/preparação e novo link sem recarregar.
- Análise com título, autoria e duração quando informados pela origem. Não inventa capas, tamanhos ou metadados.
- Automático, vídeo e áudio conforme os formatos extraídos. Vídeo ausente fica desativado para mídia de áudio.
- Qualidade de origem, extração e conversão para MP3, Opus ou WAV usando ffmpeg. Não oferece upscale nem formato de vídeo inventado.
- Playlists e galerias quando o extrator retorna entradas públicas: listagem em páginas de 25, até 200 itens; fila de até 20 itens. Nem toda galeria de fotos de Instagram/TikTok é suportada.
- Progresso real do download **para o servidor** quando o motor informa bytes totais; indicador indeterminado nos demais casos. Em streams separados o percentual pode reiniciar para a segunda faixa. Conversão não tem percentual fictício.
- Após preparação, streaming com `Content-Disposition` e nome sanitizado. Ao clicar, mostra **Download iniciado**; não alega que o arquivo foi salvo.
- Sem limite de tamanho imposto pela aplicação e sem corte por duração da mídia. Dois processos simultâneos; análise de metadados em requisições de até 90 s. Preparação/ZIP sem prazo total, com detecção de inatividade. Arquivos prontos têm 15 minutos para iniciar; operações ativas não expiram por duração.
- Preferências locais, restauração de padrões, movimento reduzido e navegação por teclado. Histórico desativado por padrão; persistência opcional de rascunhos de lote.

### Cobertura ampliada (v2.1)

A lista fixa de nove domínios foi substituída pela descoberta do **yt-dlp instalado**. O endpoint `/api/compatibility` consulta `--list-extractors` e `--version` ao iniciar o backend. Nesta instalação: **1.755 extratores**, dos quais **136** se declaram `CURRENTLY BROKEN`. Isso é uma contagem de extratores, não de sites funcionando.

A tela ASCII **[04] fontes** apresenta **Algumas fontes compatíveis**: uma seleção ilustrativa de vídeo, redes sociais e áudio, com pesquisa, indicação de extratores quebrados e registros separados de downloads reais. Exemplos: YouTube, Vimeo, Dailymotion, Twitch, Bilibili, PeerTube, TikTok, Instagram, X, Reddit, Facebook, Bluesky, SoundCloud, Bandcamp, Mixcloud, Audiomack e Wikimedia Commons. A lista visual não é completa nem funciona como allowlist. O campo de URL permanece genérico.

Alguns nomes foram retirados apenas da seleção e pesquisa visuais e dos exemplos promocionais. Isso não remove seus extratores do executável nem os bloqueia na validação do servidor. O inventário técnico da API continua completo, enquanto `src/presentation.ts` controla somente a exibição. Os totais informam o inventário instalado, não a quantidade de exemplos exibidos. Restrições de acesso, idade, região, DRM e ausência de formatos ainda podem impedir o uso. Não há importação de senhas ou cookies de contas; a alteração visual não constitui um novo teste de nenhuma fonte.

Páginas genéricas, **arquivos HTTP/HTTPS diretos**, **HLS (`.m3u8`) e DASH (`.mpd`) sob demanda** são aceitos quando o extrator genérico e o downloader nativo encontram formatos compatíveis. Não é preciso editar uma lista de domínios para cada nova fonte. Não há suporte a `file://`, RTMP/RTSP, DRM ou gravação ao vivo. Galerias mostram até oito entradas com formatos válidos; fotos ou entradas sem formatos não são inventadas. Uma galeria pode retornar apenas os itens compatíveis.

Arquivos diretos sem metadados de codec têm até **4 MiB** iniciais lidos pelo backend (inclusive se a origem ignorar Range). Os redirecionamentos são revalidados e o IP público é fixado no socket. O FFmpeg inspeciona somente o cabeçalho local, com demuxer fixo e rede desativada para essa inspeção. Arquivos que precisam de um cabeçalho fora desse limite, como alguns MP4 com `moov` no final, podem ser recusados. Não se presume que a extensão do arquivo prova que existem áudio ou vídeo.

**Listado** = extrator presente na ferramenta, sem garantia de acesso. **Quebrado** = sinalizado pela própria ferramenta. **Testado** = mídia, versão e escopo registrados em `backend/verified-sources.json`, após download e transferência reais. Testes antigos mantêm sua versão original mesmo após atualizar o motor. Consulte [a lista oficial e suas ressalvas](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) e [VERIFICATION.md](VERIFICATION.md).

### Atualizar o motor sem reescrever a interface

Para o executável oficial instalado no Windows:

```sh
npm run engine:update
```

Depois, reinicie o backend. O inventário da interface vem da API e acompanha a nova versão automaticamente. Não é necessário reconstruir o frontend; registre novos testes somente após fazê-los de verdade. Para uma instalação Python, atualize `yt-dlp[default]` no ambiente virtual. O script de atualização não aceita parâmetros enviados por visitantes nem executa plugins.

No Docker, substitua a versão pela release oficial que deseja instalar:

```sh
docker compose build --build-arg YTDLP_VERSION=2026.10.21
docker compose up -d
```

O argumento de build mantém a versão reproduzível; não usa atualizações silenciosas em cada requisição. As opções usadas são documentadas no [README oficial](https://github.com/yt-dlp/yt-dlp#usage-and-options). A configuração local e os diretórios de plugins são ignorados; não são ativados `.netrc`, login, cookies de navegador, falsificação de região ou download de componentes remotos.

## Escolha do mecanismo (revisão em 24/10/2026)

**Decisão: manter yt-dlp + FFmpeg.** A solução atual já usa esse motor; não é um terceiro extrator concorrente. Foram consultadas a [tabela oficial de serviços do Cobalt](https://github.com/imputnet/cobalt/blob/main/api/README.md#supported-services), sua [API](https://github.com/imputnet/cobalt/blob/main/docs/api.md) e [instalação própria](https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md), além do [manual](https://github.com/yt-dlp/yt-dlp#readme) e da [lista com ressalvas do yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

| Critério | Cobalt documentado | yt-dlp e implementação atual |
|---|---|---|
| Variedade útil | Serviços explicitamente integrados, incluindo redes sociais, vídeo e SoundCloud. | Extratores específicos e genérico; no Potato já foram verificados arquivos diretos e manifests HLS/DASH VOD. |
| Recursos | Vídeo/áudio, modos, qualidade, formatos e seleção múltipla; vantagens documentadas em fotos e slideshows de algumas redes. | Seleção de formatos reais, extração/conversão de áudio e remux com FFmpeg; a UI atual não promete galerias de fotos universais. |
| Confiabilidade | A documentação aponta limitações por serviço, como áudio no Vimeo apenas via DASH e possíveis falhas no X. Não foi executado um comparativo local com Cobalt. | A lista oficial também não garante funcionamento. Mantemos versão, extratores quebrados e escopo dos testes reais separados. |
| Manutenção | Outra API, atualizações, configuração e proteção da instância. | Atualização do executável/pacote e reinício do motor; catálogo dinâmico, sem reescrever a interface. |
| Hospedagem | Docker Compose recomendado, backend com processamento e URL do túnel; uso de API hospedada depende de autorização. | Node, yt-dlp/Python ou executável e FFmpeg. O backend atual já funciona com esses requisitos; Pages hospeda somente o frontend. |

A escolha considera os fluxos verificados e a operação disponível, **não só a contagem de extratores**. Não há evidência obtida nesta revisão de que trocar o motor melhore os downloads já funcionais. Combinar Cobalt agora acrescentaria um segundo serviço, contratos de resposta, proteção e manutenção, sem ganho comprovado por um caso concreto de regressão. As vantagens documentadas de Cobalt para certas galerias não são apresentadas como implementadas ou testadas no Potato. Uma combinação futura deve começar por uma mídia autorizada que falhe no motor atual e funcione na alternativa, preservando as mesmas proteções de rede.

Nenhuma API pública do Cobalt foi usada e nenhuma nova alegação de plataforma testada foi adicionada nesta revisão. Os endereços `Harleyzinn/potato-downloader` e `/potato-downloader/` permanecem por compatibilidade, embora produto, pacote npm e logo agora se chamem **Batatubo**. A chave de preferências e a pasta temporária técnica existentes são mantidas para preservar preferências e limpeza de arquivos antigos.

## Segurança e privacidade

- Somente HTTP/HTTPS, sem credenciais em URLs, IPs literais, redes locais ou portas especiais na entrada. A descoberta ampla de domínios continua subordinada à barreira de rede; um hostname arbitrário não autoriza acesso a uma rede interna.
- Todo tráfego do yt-dlp usa proxy privado em loopback que valida DNS de cada destino, rejeita IPs privados/reservados/mapeados e fixa o IP público no socket. Cada redirecionamento passa pela mesma verificação, reduzindo SSRF e rebinding. A leitura limitada de cabeçalho usa a mesma validação e pinagem, com até cinco redirecionamentos, timeout e limite de bytes próprios. FFmpeg não recebe URLs na inspeção de cabeçalhos.
- Execução com argumentos, sem shell e sem argumentos fornecidos pelo cliente. Apenas IDs de formatos previamente analisados; caminhos locais controlados pelo servidor.
- Limites de corpo JSON, processos e saída de metadados, até quatro streams e dois por arquivo. Sem quota de tamanho/tráfego de mídia. Watchdog de inatividade, tratamento de ENOSPC/EDQUOT e limpeza periódica/cancelamento. Arquivos não são carregados inteiros na memória do navegador.
- Análises e trabalhos são isolados por sessão protegida. Links de arquivos têm capacidades aleatórias temporárias; não os compartilhe se quiser manter privacidade. O token da sessão pode ficar em sessionStorage; URLs só são persistidas na opção explícita de rascunho.
- O limitador é por IP da conexão; por um túnel todos podem compartilhar o limite. Para maior escala, implemente uma política na borda e isolamento de rede/contêiner; CORS não substitui autenticação nem controle de abuso.
- Não registra URLs, títulos ou erros brutos do extrator. Metadados ficam em memória até expirar e arquivos temporários no servidor até 15 min. A limpeza periódica também remove diretórios órfãos expirados após reiniciar o motor; arquivos bloqueados são tentados novamente no próximo ciclo. O Compose usa tmpfs.

## Checks e testes

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Testes cobrem IPs privados/reservados e IPv6 mapeado, proxy HTTP/CONNECT, fronteiras de domínio, metadados/formatos/DRM, sanitização, mensagens e progresso. O teste real usa [File:Example.ogg no Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Example.ogg), mídia pública com licença indicada na página original. A fonte foi analisada e convertida para MP3 e o arquivo resultante foi transferido pelo navegador a partir do Pages (74.383 bytes). Também foi baixado um vídeo WebM de 240p do [trecho Big Buck Bunny, Blender Foundation, CC BY 3.0](https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_first_23_seconds_1080p.ogv) (957.029 bytes). Mídias de teste não são redistribuídas no repositório. Esses testes não comprovam disponibilidade de todas as plataformas.

Verificação da primeira publicação: workflow de checks e deploy concluído com sucesso; assets carregados no subcaminho correto; análise, seleção real de formato, conversão e download MP3 feitos pela origem publicada; preferências salvas, recarregadas e restauradas; navegação por teclado conferida. Sem rolagem horizontal nas larguras de 390 e 1280 px. Requisições de origem não autorizada receberam 403. Um filme oficial da Blender Foundation no YouTube também foi baixado pela API e inspecionado com ffmpeg: MP4 de 35.624.855 bytes com vídeo AV1 144p e áudio AAC. A versão 2.1 remove a antiga allowlist e acrescenta os testes descritos em [VERIFICATION.md](VERIFICATION.md). Docker não foi executado neste ambiente Windows.

### Hospedagem, tráfego e políticas

O frontend no Pages é estático. Extração, inspeção e conversão executam neste computador com Node/yt-dlp/FFmpeg. Cada requisição de metadados tem 90 s para caber no transporte HTTP; preparação, conversão e ZIP não têm duração total máxima. O download final usa streaming com backpressure e HTTP Range, sem manter o arquivo inteiro no navegador. São dois processos e quatro transferências simultâneas; as faixas originais de vídeo e áudio e a conversão podem aumentar o tráfego em relação ao arquivo final. O projeto não inclui tráfego ilimitado nem provisiona hospedagem paga.

O [Quick Tunnel da Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) é temporário, sem garantia de uptime, até 200 requisições em voo, sem SSE e com hostname diferente a cada inicialização. O Potato usa polling curto, não SSE; seus próprios limites são mais baixos. O túnel não é hospedagem permanente ou um compromisso de aceitação de qualquer conteúdo. Aplicam-se os [termos do serviço](https://www.cloudflare.com/website-terms/), incluindo restrições de abuso e acesso não autorizado. Para serviço contínuo e tráfego de mídia, instale o backend em hospedagem compatível com processos nativos e com a política aplicável ao seu uso. Nenhum plano novo ou cobrança foi criado nesta entrega.

## Licenças e créditos

Código original do Potato: MIT, veja [LICENSE](LICENSE). yt-dlp: [Unlicense](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE), executado como processo independente, sem binário no repositório. ffmpeg-static: [GPL-3.0-or-later e informações de distribuição](https://github.com/eugeneware/ffmpeg-static); as licenças dos binários e fontes correspondentes estão no projeto e na [distribuição ffmpeg](https://ffmpeg.org/legal.html). Cloudflared: [Apache-2.0](https://github.com/cloudflare/cloudflared/blob/master/LICENSE), ferramenta opcional de túnel instalada separadamente. Vite, TypeScript, ESLint e ipaddr.js mantêm seus avisos nos pacotes instalados. Consulte o lockfile para versões exatas. Não há código ou assets copiados do Cobalt.

## Visual Terminal Edition (v2.3)

A apresentação ganhou desenhos ASCII associados aos estados reais (aguardando, análise, mídia disponível, preparação, arquivo pronto, início pelo navegador, cancelamento e erro), ícones de caracteres nos modos, árvore de navegação, moldura de terminal, caixas `[ ]`/`[x]` e setas `[v]` nos seletores. Os controles continuam sendo HTML nativo, com rótulos, foco e teclado; as ilustrações ficam ocultas dos leitores de tela. Movimento reduzido é respeitado. Não há progresso ou conclusão simulados. Essa revisão altera a apresentação, sem trocar o motor, as regras de fontes ou os endereços publicados.

## Playlists e lotes — Harvest Edition (v3.0)

**Um link** detecta playlists e abre a prévia sem iniciar downloads. Para vídeo que inclui uma playlist, o padrão é apenas o vídeo; **Explorar playlist deste vídeo** oferece a outra escolha. Em **Playlist / vários links**, cole um endereço por linha, preservando parâmetros necessários. URLs iguais são deduplicadas antes da análise; o identificador do extrator reconhece o mesmo conteúdo quando disponível, sem prometer reconhecer toda URL alternativa.

A prévia mostra autoria, total e duração somente quando recebidos. Inclui busca, filtro, seleção individual, todos/nenhum/inversão e intervalos `1-10` ou `1,3,5-12`. A seleção abrange os itens carregados e permanece entre buscas e páginas de interface (10 cartões). **Carregar mais da origem** busca outra página de até 25 itens. A listagem para em 200, com aviso para totais desconhecidos ou listagens parciais. Várias playlists na mesma entrada recebem apenas a primeira página de cada uma; analise uma separadamente para continuar sua listagem.

**Conferir formatos selecionados** resolve cada item, sem baixar a mídia completa. Somente formatos encontrados aparecem nos seletores individuais. Preferências globais de modo, teto de qualidade e conversão de áudio são conferidas na origem: sem formato adequado, escolha uma alternativa ou desmarque o item. Falhas ficam identificadas e podem ser desmarcadas para baixar os demais. A análise transfere metadados e pode ler pequenos cabeçalhos para identificar codecs.

Revise o resumo, adicione até 20 itens e clique **Iniciar / retomar fila**. A ordem inicial segue a origem. Pendentes podem trocar de posição com vizinhos pendentes. Pausar impede novos trabalhos; não pausa transferência ou conversão ativa, cujo acompanhamento continua. Cancelar encerra extração/conversão quando possível; uma transferência entregue ao navegador precisa ser cancelada nele. Falhas não interrompem os demais. **Repetir falhas** renova a análise apenas dos itens com erro. O yt-dlp repete pedidos/fragmentos uma vez; o cliente repete uma falha de conexão na criação, com a mesma chave idempotente. Limites de uso não são repetidos automaticamente.

### Progresso e arquivos

Barras individuais medem a **faixa de origem recebida pelo servidor**, com bytes, velocidade e ETA de `--progress-template`. Sem total confiável, ficam indeterminadas. Faixas separadas podem reiniciar a barra. Conversão/combinação e ZIP têm estados próprios; não reutilizam o percentual de transferência. A barra geral é de **itens finalizados** (prontos, falhas e cancelados), com contadores separados. **Pronto para baixar** confirma o arquivo no servidor; **Download iniciado no navegador** não confirma gravação no dispositivo.

Arquivos individuais são transmitidos por streaming. ZIP é criado com Archiver 8 no servidor usando arquivos temporários, sem carregar a mídia inteira no navegador. O método STORE empacota sem recompressão. A compactação mostra entradas processadas quando disponíveis, sem inventar percentual de bytes. Nomes são sanitizados e diretórios exclusivos; numeração original é opcional nos arquivos individuais e entradas de ZIP têm prefixos únicos. O pacote usa até 20 arquivos prontos, sem limite de bytes da aplicação, exigindo espaço físico para fontes e ZIP. Os originais são removidos após o pacote ficar pronto. **Limpar finalizados e arquivos** solicita remoção no servidor; sem conexão, a expiração continua valendo.

### Sessão, fechamento e privacidade

O token de sessão aleatório de 256 bits fica no `sessionStorage`, sem URLs, quando permitido. Análises e trabalhos exigem `X-Potato-Session`. Cada arquivo tem uma capacidade aleatória no link: trate esse link como privado. Não há segredo compartilhado no frontend, cookies de plataformas ou senhas. URLs, tokens e metadados não são registrados nos logs da aplicação.

A página coordena a fila pendente. Fechar/recarregar impede novos trabalhos pendentes. Trabalhos já aceitos podem terminar no servidor e ser recuperados ao reabrir a mesma aba/sessão, antes de expirar. Isso não é fila durável: reiniciar o backend perde o estado. Na recuperação, novos trabalhos ficam pausados e os aceitos continuam sendo acompanhados. Consultas ocorrem a cada 1,5 segundo, com recuo até 15 segundos em falhas sem iniciar outra tarefa. O ZIP usa 2 segundos. Consultas terminam quando não forem necessárias ou a página fechar.

Histórico e links não são persistidos por padrão. A opção explícita de salvar rascunho grava links em `localStorage`; restaurar exige nova análise e não inicia downloads. Preferências do lote ficam localmente. **Apagar dados locais** remove rascunho, preferências e token armazenado; trabalhos aceitos só são interrompidos pelo cancelamento ou expiração.

### Limites desta instalação

| Recurso | Limite |
| --- | --- |
| Entrada / fila | 20 URLs / 20 itens |
| Playlist | 25 itens por consulta, até 200 listados |
| Prévia | 10 cartões por página |
| Concorrência | 1 trabalho da fila por página; 2 operações globais no backend |
| Mídia | Sem cota de bytes ou duração máxima da mídia imposta pela aplicação |
| Listagem / análise | 90 segundos por pedido |
| ZIP | 20 arquivos por operação, sem cota de bytes ou duração total; ZIP64 habilitado |
| Disco temporário | Volume do host; sem quota do projeto, sujeito ao espaço e cotas reais |
| Rede | 5 MiB/s por yt-dlp; 4 transferências globais e 2 por arquivo |
| Tráfego entregue | Sem cota de bytes por sessão na aplicação; provedor/rede podem restringir |
| Pedidos | 150 POSTs por 10 minutos por endereço observado pelo servidor |
| Disponibilidade | 15 minutos para iniciar; operações ativas preservadas. Remoção após envio completo ou incorporação ao ZIP; coleta a cada 30 s |

O túnel temporário continua sendo transporte para este computador, sujeito às limitações documentadas acima. Não houve contratação paga. O Pages serve apenas o frontend. Todas as extrações continuam pelo proxy privado com validação e fixação de DNS a cada conexão/redirecionamento. O inventário público e a política de exemplos de fontes permanecem iguais.

### Documentação e atualização

Usamos a [documentação oficial do yt-dlp](https://github.com/yt-dlp/yt-dlp#usage-and-options): `--flat-playlist`, `--playlist-items`, `--yes-playlist`/`--no-playlist`, JSON e templates de progresso. A listagem plana pode omitir metadados; cada selecionado é resolvido novamente. ZIP usa a [API oficial do Archiver](https://www.archiverjs.com/docs/archiver/) e a classe ESM `ZipArchive` da versão 8 instalada. Atualize o yt-dlp por `npm run engine:update` e reinicie o backend, sem reescrever a UI. Dependências JavaScript usam `npm ci` e o lockfile, inclusive no Dockerfile.

### Verificação da v3.0

Integração real em 24/10/2026: playlist pública **Official Blender Open Movies**, 17 itens com autoria e duração; **Caminandes 2: Gran Dillama**, selecionado da playlist, baixado e convertido para MP3 (2.381.336 bytes); demonstração W3Schools `mov_bbb.mp4`, convertida para MP3 (147.309 bytes); ZIP de ambos (2.529.019 bytes), baixado e validado com verificação de CRC. A repetição da criação retornou o mesmo trabalho. Outra sessão não pôde ler seu estado e o arquivo sem sua capacidade foi bloqueado. Isso verifica esses exemplos, não todos os extratores ou playlists.

Testes isolados cobrem intervalos, deduplicação sem apagar queries, preferências sem troca silenciosa, paginação, entradas ausentes/privadas, URLs internas, continuidade após falha/cancelamento e pausa do início mantendo acompanhamento. Não usamos credenciais nem itens privados reais. Metadados construídos nos testes não contam como fontes verificadas.

Verificações reais adicionais da v3.0: criações concorrentes com a mesma chave resultaram em um trabalho e rejeição da concorrente; cancelamento ativo confirmado; recuperação do trabalho pela mesma sessão; bloqueios de CORS, URL interna, página acima do limite e ZIP com 21 entradas. Na UI, links repetidos foram ignorados, um arquivo HTTP 404 ficou desabilitado sem impedir os demais e pausar manteve o próximo item aguardando enquanto o aceito terminou.

Também foi verificada uma interrupção real do acesso ao proxy de desenvolvimento durante a transferência do trecho aberto do Wikimedia Commons (1080p OGV, 31,1 MiB). A UI exibiu o aviso de acompanhamento sem conexão e, após restabelecer o acesso e recuperar a sessão, encontrou o mesmo trabalho pronto, sem novo download. O total ficou em três trabalhos, sem duplicação. O fluxo individual MP4 e o ZIP da fila foram baixados pelo navegador. Layout de 390 px sem rolagem horizontal e navegação por Tab também foram conferidos. Uma nova tentativa de análise do Big Buck Bunny completo no YouTube retornou restrição nesta rede; isso não invalida a listagem pública, mas reforça que a disponibilidade de cada item precisa ser conferida.


## Arquivos grandes — Streaming Edition (v3.1)

**Sem limite de tamanho imposto pela aplicação.** Isso significa que foram removidos filtros de tamanho/duração dos formatos, `--max-filesize`, verificações de 100 MiB, soma máxima de ZIP, quota de disco do projeto e quota de tráfego por sessão. Tamanho desconhecido não é motivo de recusa. Não significa downloads ilimitados: espaço real, sistema de arquivos, RAM/CPU do host, proxy, origem e contrato do provedor ainda limitam o serviço.

Mantemos limites independentes do tamanho: concorrência, quantidade de itens por operação/listagem, frequência de pedidos, corpo JSON, metadados, rede pública validada e isolamento de sessão. As leituras limitadas a 4 MiB servem somente para inspeção de codecs, não são o limite do download. Alguns arquivos sem metadados legíveis no cabeçalho continuam exigindo uma origem que forneça os codecs; uma recusa nesse caso é de identificação de formato, não de tamanho desconhecido.

### Duração, progresso e limpeza

- Preparação, transferência para o servidor, conversão e ZIP não têm mais cortes fixos de 8 minutos/60 segundos nem duração máxima de mídia. Trabalhos ativos não são apagados ao atingir 15 minutos. Essa janela é de inatividade de arquivos **já prontos**, não de duração das operações. Acesso autenticado e processamento/transferências da mesma sessão preservam as cópias prontas do lote, evitando que os primeiros itens expirem enquanto os últimos arquivos grandes ainda estão sendo preparados.
- `WORKER_IDLE_MS` (padrão 600000) detecta ausência de avanço nos bytes e nos arquivos temporários. É uma heurística de inatividade, não um limite de duração total: para transformações que passam muito tempo em CPU sem escrever, ajuste ao host. `STREAM_IDLE_MS` (300000) encerra conexões de saída inativas, sem cortar transferências que continuam progredindo. Timeouts de sockets da origem e de requisições de metadados permanecem.
- Progresso determinado só é exibido quando o total real está disponível. Com total desconhecido, são exibidos bytes recebidos e indicador indeterminado. Percentual da transferência não representa conversão ou gravação no dispositivo. Logs de progresso são consumidos linha a linha, sem acumular stdout proporcional à duração do download.
- yt-dlp/FFmpeg escrevem em disco; envio e ZIP usam streams com backpressure. ZIP64 está habilitado; não é criado um Buffer com a mídia inteira. Memória de bibliotecas/codecs e armazenamento continuam sendo recursos finitos.
- Intermediários são limpos ao preparar o arquivo. Após envio completo de um arquivo pelo servidor, sua cópia temporária é removida e o estado indica **envio encerrado**, sem afirmar gravação no dispositivo. Intervalos HTTP parciais e conexões interrompidas preservam a cópia para retomada até expirar. HTTP Range aceita um intervalo por pedido; a efetiva retomada depende do cliente e de o arquivo ainda estar disponível.
- Um ZIP pronto substitui suas cópias individuais temporárias: elas são removidas para liberar espaço. Para outra cópia individual, analise/prepare novamente. O ZIP pronto é recuperável pela sessão e também é removido após envio completo. Cancelamento/falha remove saídas incompletas; arquivos bloqueados são tentados novamente pela limpeza periódica. Falhas de espaço/cota externa usam mensagens próprias, sem encerrar o processo da API.

### Instalação para arquivos grandes e alternativa ao túnel

No Windows, o backend atual usa diretório em disco do sistema (`TEMP_ROOT` pode apontar para outro volume). Reserve espaço físico para entradas, conversões e ZIP; durante a montagem pode ser necessário manter fontes e saída ao mesmo tempo. Não use uma pasta de outro aplicativo. Não configure o diretório de trabalho em RAM.

O `compose.yaml` agora usa o volume em disco `potato-work:/work`, com `TEMP_ROOT` e `TMPDIR` em `/work`. Foi removido o antigo tmpfs de 512 MiB. Limites de memória/CPU/processos permanecem. Não há `storage_opt.size` ou quota de arquivo configurada; o disco/cotas do host são a fronteira real. Instalações existentes devem ser recriadas para adotar o volume; não basta reiniciar o contêiner antigo.

Para servidor próprio com domínio existente e portas 80/443 disponíveis, foi preparada a alternativa Caddy com HTTPS direto:

```sh
# Configure um domínio que você já controla, apontando para seu servidor.
export API_DOMAIN=api.seu-dominio-existente.com
docker compose -f compose.yaml -f compose.caddy.yaml up -d --build
```

Use DNS direto ao servidor; se mantiver uma CDN/proxy na frente, suas restrições continuam valendo. A configuração não habilita buffers do corpo de resposta ou prazo total de download. Há timeouts de inatividade e 100 s para cabeçalhos de resposta (metadados têm 90 s). Logs de requisições HTTP que poderiam revelar URLs/capacidades não são habilitados. Essa alternativa é fornecida como configuração; não cria servidor, domínio, conta ou assinatura. A sintaxe do Caddyfile foi validada com o binário oficial (`caddy adapt`), sem iniciar serviços. A composição Docker não foi executada neste computador Windows sem Docker. Depois de instalar, configure a variável pública `VITE_API_URL` com o HTTPS da API e publique o frontend pelo workflow existente. Nunca coloque credenciais nessa variável.

### Restrições externas verificadas na documentação

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): frontend estático, site até 1 GB e banda mensal flexível de 100 GB. As mídias são servidas pela API, não são gravadas no repositório nem no Pages; esses números não são um limite de mídia aplicado pelo Potato.
- [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/): transporte temporário de testes, sem garantia de disponibilidade, até 200 pedidos em voo, sem SSE, hostname variável. Computador/túnel precisam ficar ligados. Políticas e restrições do provedor continuam aplicáveis.
- [Conexões Cloudflare](https://developers.cloudflare.com/fundamentals/reference/connection-limits/): timeouts de conexão/leitura/escrita são externos. Um timeout de proxy pode interromper uma transferência; não é equivalente a uma quota de tamanho. O projeto não pode alterar limites de plano do provedor. Polling curto mantém o processamento fora de uma única requisição longa.
- [Volumes Docker](https://docs.docker.com/engine/storage/volumes/) usam armazenamento do host; [tmpfs](https://docs.docker.com/engine/storage/tmpfs/) usa memória, razão da troca. Consulte também a [configuração oficial do Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [streams Node 24](https://nodejs.org/docs/latest-v24.x/api/stream.html) e [Archiver/ZIP64](https://www.archiverjs.com/docs/archiver/).

Nenhuma hospedagem paga foi contratada ou provisionada. O túnel existente continua ativo para esta instalação; a alternativa está pronta para configuração em infraestrutura que você já possua.


### Testes reais da v3.1 (24/10/2026)

- Fonte pública de teste [Big Buck Bunny HLS, hospedado pela Mux para hls.js](https://test-streams.mux.dev/), variante 1080p, sem tamanho total informado na extração/transferência. O arquivo final teve **488.204.087 bytes** (~466 MiB), ultrapassando o antigo limite individual. Foram observados bytes crescendo com total desconhecido, sem percentual inventado.
- ZIP64 resultante com **488.204.307 bytes**, acima da antiga cota de ZIP, preparado localmente e em outra execução pela API HTTPS atual em `trycloudflare.com`. Os dois ZIPs foram baixados por streaming para disco e passaram no CRC de `zipfile.testzip()`. O teste HTTPS levou 141 segundos entre criação do trabalho e entrega. Isso é evidência desse tamanho nesta instalação, não uma promessa de aceitação de qualquer tamanho pelo provedor.
- Foram conferidos Range parcial acima do byte 104.857.600, intervalo inválido (`416`), HEAD, envio individual completo, remoção após envio, limpeza dos originais ao montar ZIP, recuperação do pacote pela sessão e isolamento contra outra sessão. Durante a transferência grande, uma observação do processo Node mostrou aproximadamente 101 MiB de memória residente; não é um benchmark de pico nem inclui todos os processos de codecs.
- Testes isolados cobrem duração longa e formatos de 50 GiB sem filtro de tamanho (metadados construídos), faixas para arquivos de 6 GiB, mensagens de falta de espaço/cota externa, continuidade da fila e watchdog baseado em atividade. Não foi preenchido o disco do usuário nem foi realizado um download real maior que 4 GiB. ZIP64 foi habilitado, mas não anunciamos esse volume como efetivamente testado.

![Bytes recebidos com total desconhecido na interface ASCII](docs/unknown-size.png)
