FROM node:24.22.2-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --include=dev
COPY apps apps
COPY scripts scripts
RUN npm run build && npm run audit:secrets && npm prune --omit=dev

FROM node:24.22.2-bookworm-slim
ENV NODE_ENV=production PORT=10000 PERSISTENT_DATA_DIR=/var/data DATABASE_PATH=/var/data/pathwise.sqlite STORAGE_KIND=docker-volume AGENT_INSTANCES=1 PAYMENTS_ENABLED=false
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/server apps/server
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/scripts scripts
COPY package.json package-lock.json ./
RUN mkdir -p /var/data && chown node:node /var/data
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:10000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/src/index.ts"]
