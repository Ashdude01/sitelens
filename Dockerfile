# syntax=docker/dockerfile:1
# Multi-stage build → small runtime image with the Next.js standalone server.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# This stage also serves as the "tools" image for CLI jobs (imports, calibrate), see docker-compose.yml.

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data \
    MIGRATIONS_DIR=/app/drizzle \
    DATABASE_URL=file:///data/sitelens.db
# Uncomment to enable USE_BROWSER=1 (adds ~300 MB):
# RUN apt-get update && apt-get install -y --no-install-recommends chromium && rm -rf /var/lib/apt/lists/*
# ENV CHROMIUM_PATH=/usr/bin/chromium
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/data ./data
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p /data && chown -R node:node /data /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
