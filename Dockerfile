FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/engine && /opt/engine/bin/pip install --no-cache-dir 'yt-dlp[default]==2026.10.21'
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY backend ./backend
COPY src/types.ts ./src/types.ts
ENV HOST=0.0.0.0 PORT=8787 YTDLP_PATH=/opt/engine/bin/yt-dlp FFMPEG_PATH=/usr/bin/ffmpeg
USER node
EXPOSE 8787
CMD ["node", "--import", "tsx", "backend/server.ts"]
