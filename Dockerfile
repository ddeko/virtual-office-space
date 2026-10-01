# Multiplayer server (serves the site + WebSockets). Used by Fly.io and Render.
FROM oven/bun:1.3-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
RUN mkdir -p /data
ENV NODE_ENV=production PORT=3000 LAYOUT_FILE=/data/layout.json
EXPOSE 3000
CMD ["bun", "server.ts"]
