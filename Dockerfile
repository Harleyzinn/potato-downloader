FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
ARG YTDLP_VERSION=2026.10.21
RUN python3 -m venv /opt/engine && /opt/engine/bin/pip install --no-cache-dir "yt-dlp[default]==${YTDLP_VERSION}"
WORKDIR /app
RUN mkdir /work && chown node:node /work
COPY package.json package-lock.json ./
RUN npm ci
COPY backend ./backend
COPY scripts ./scripts
COPY src/types.ts ./src/types.ts
ENV HOST=0.0.0.0 PORT=8787 YTDLP_PATH=/opt/engine/bin/yt-dlp FFMPEG_PATH=/usr/bin/ffmpeg
USER node
EXPOSE 8787
CMD ["node", "--import", "tsx", "backend/server.ts"]
