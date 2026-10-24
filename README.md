# [p] Potato Downloader

Downloader de mídia com identidade própria em ASCII. Frontend em português, tons de batata, análise real de formatos e preparação de arquivos com **yt-dlp + ffmpeg**. Não usa API, instância nem código do Cobalt.

- **Frontend:** https://harleyzinn.github.io/potato-downloader/
- **Código:** https://github.com/Harleyzinn/potato-downloader

![Interface ASCII do Potato Downloader publicada no GitHub Pages](docs/interface.png)

## Estado da instalação

O frontend é permanente no GitHub Pages. A primeira instalação do backend usa **um túnel HTTPS temporário para este computador**, sem contratação ou cobrança. Ele só funciona enquanto o computador, o processo do motor e o `cloudflared` estiverem ligados. A interface avisa quando esse motor é temporário ou está desconectado. **Não é uma hospedagem de backend permanente.** Ao reiniciar o Quick Tunnel, atualize a variável pública `VITE_API_URL` e publique novamente.

Para funcionar continuamente com seu computador desligado, instale o backend em um servidor Linux/Docker que você controla, com endereço HTTPS estável. GitHub Pages não executa Node, Python, yt-dlp ou ffmpeg. Não é possível substituir esse servidor por um workflow de download ou por um arquivo estático.

## Arquitetura e escolhas

```text
GitHub Pages (HTML/CSS/TypeScript)
        | HTTPS + CORS
        v
Potato API (Node / TypeScript)
        | análise JSON / seleção de formato / processo limitado
        v
yt-dlp -> proxy local com validação e pinagem DNS -> plataforma pública
        | arquivo local -> ffmpeg quando necessário
        v
arquivo temporário -> streaming HTTP -> navegador
```

Vite + TypeScript sem framework de UI: componentes pequenos de apresentação, serviço tipado, preferências e estado separados. A API não é um proxy genérico de arquivos: aceita apenas uma lista de plataformas, guarda opções retornadas pelo extrator e permite escolher apenas essas opções. O navegador não recebe comandos de execução nem decide caminhos de arquivos.

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

O Compose vincula a API apenas a `127.0.0.1:8787`, limita memória/CPU/processos e usa `/tmp` em memória com limite de 512 MiB. Os arquivos de até 100 MiB são preparados ali. Configure seu proxy HTTPS ou túnel nomeado para encaminhar ao backend. Use um serviço já disponível; o projeto não cria contas, assinaturas ou infraestrutura cobrada.

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
2. Em **Settings > Secrets and variables > Actions > Variables**, crie a variável pública de repositório `VITE_API_URL` com a URL HTTPS do backend.
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
- Galerias/itens múltiplos apenas quando o extrator retorna entradas com formatos; até 8 itens. Nem toda galeria de fotos de Instagram/TikTok é suportada.
- Progresso real do download **para o servidor** quando o motor informa bytes totais; indicador indeterminado nos demais casos. Em streams separados o percentual pode reiniciar para a segunda faixa. Conversão não tem percentual fictício.
- Após preparação, streaming com `Content-Disposition` e nome sanitizado. Ao clicar, mostra **Download iniciado**; não alega que o arquivo foi salvo.
- 100 MiB por trabalho, 20 minutos por mídia, 2 processos simultâneos, 90 s de análise e 8 min de preparação, retenção de até 15 min. Conversão pode ultrapassar tamanho e ser cancelada.
- Preferências locais, restauração de padrões, movimento reduzido e navegação por teclado. Sem histórico.

Plataformas habilitadas por allowlist: YouTube, Vimeo, TikTok, Instagram, SoundCloud, Reddit, X/Twitter, Internet Archive e Wikimedia Commons. Elas usam os extratores do yt-dlp e podem falhar por mudanças da origem, bloqueios, região, autenticação ou ausência de formatos. **Wikimedia Commons e YouTube tiveram downloads reais verificados com mídia pública. As demais não são garantidas por este teste.** A interface consulta a lista do servidor.

## Segurança e privacidade

- Somente HTTP/HTTPS, sem credenciais em URLs, IPs literais, redes locais ou portas especiais na entrada. Domínios de plataformas precisam corresponder à allowlist, incluindo fronteiras de subdomínio.
- Todo tráfego do yt-dlp usa proxy privado em loopback que valida DNS de cada destino, rejeita IPs privados/reservados/mapeados e fixa o IP público no socket. Cada redirecionamento passa pela mesma verificação, reduzindo SSRF e rebinding.
- Execução com argumentos, sem shell e sem argumentos fornecidos pelo cliente. Apenas IDs de formatos previamente analisados; caminhos locais controlados pelo servidor.
- Limites de corpo, processos, saída JSON, tempo e arquivos. Watchdog de tamanho em disco e limpeza periódica/cancelamento. Arquivos não são carregados inteiros na memória do navegador.
- IDs aleatórios de análise/trabalho funcionam como capacidades temporárias. Não compartilhe links de arquivos que queira manter privados. Não são persistidos no navegador nem publicados no repositório.
- O limitador é por IP da conexão; por um túnel todos podem compartilhar o limite. Para maior escala, implemente uma política na borda e isolamento de rede/contêiner; CORS não substitui autenticação nem controle de abuso.
- Não registra URLs, títulos ou erros brutos do extrator. Metadados ficam em memória até expirar e arquivos temporários no servidor até 15 min. Um encerramento forçado do sistema pode deixar temporários; o administrador deve manter a limpeza da pasta temporária do sistema. O Compose usa tmpfs.

## Checks e testes

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Testes cobrem IPs privados/reservados e IPv6 mapeado, proxy HTTP/CONNECT, fronteiras de domínio, metadados/formatos/DRM, sanitização, mensagens e progresso. O teste real usa [File:Example.ogg no Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Example.ogg), mídia pública com licença indicada na página original. A fonte foi analisada e convertida para MP3 e o arquivo resultante foi transferido pelo navegador a partir do Pages (74.383 bytes). Também foi baixado um vídeo WebM de 240p do [trecho Big Buck Bunny, Blender Foundation, CC BY 3.0](https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_first_23_seconds_1080p.ogv) (957.029 bytes). Mídias de teste não são redistribuídas no repositório. Esses testes não comprovam disponibilidade de todas as plataformas.

Verificação do Pages: workflow de checks e deploy concluído com sucesso; assets carregados no subcaminho correto; análise, seleção real de formato, conversão e download MP3 feitos pela origem publicada; preferências salvas, recarregadas e restauradas; navegação por teclado conferida. Sem rolagem horizontal nas larguras de 390 e 1280 px. Requisições de origem não autorizada receberam 403; plataforma fora da lista foi rejeitada. Um filme oficial da Blender Foundation no YouTube também foi baixado pela API e inspecionado com ffmpeg: MP4 de 35.624.855 bytes com vídeo AV1 144p e áudio AAC. Consulte também [VERIFICATION.md](VERIFICATION.md). Docker não foi executado neste ambiente Windows.

## Licenças e créditos

Código original do Potato: MIT, veja [LICENSE](LICENSE). yt-dlp: [Unlicense](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE), executado como processo independente, sem binário no repositório. ffmpeg-static: [GPL-3.0-or-later e informações de distribuição](https://github.com/eugeneware/ffmpeg-static); as licenças dos binários e fontes correspondentes estão no projeto e na [distribuição ffmpeg](https://ffmpeg.org/legal.html). Cloudflared: [Apache-2.0](https://github.com/cloudflare/cloudflared/blob/master/LICENSE), ferramenta opcional de túnel instalada separadamente. Vite, TypeScript, ESLint e ipaddr.js mantêm seus avisos nos pacotes instalados. Consulte o lockfile para versões exatas. Não há código ou assets copiados do Cobalt.
