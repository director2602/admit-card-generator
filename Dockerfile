# Production image: Next.js app + Chromium for PDF rendering.
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 PUPPETEER_SKIP_DOWNLOAD=1
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY scripts/copy-fonts.mjs scripts/copy-fonts.mjs
RUN npm ci
COPY . .
RUN npm run build

FROM base AS run
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production CHROMIUM_PATH=/usr/bin/chromium PORT=3000
COPY --from=build /app /app
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 3000
# Apply migrations, then start the server (the generation worker runs inline by default).
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && npx next start -p ${PORT}"]
