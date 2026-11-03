# syntax=docker/dockerfile:1
FROM node:22-slim AS web
WORKDIR /src
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --workspace web --include-workspace-root=false
COPY web web
RUN npm -w web run build

FROM node:22-slim
ENV NODE_ENV=production PORT=3847
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace server --include-workspace-root=false && npm cache clean --force
COPY server/src server/src
COPY server/migrations server/migrations
COPY site site
COPY docs/screenshots docs/screenshots
COPY packaging/deb/install-linux.sh packaging/deb/install-linux.sh
COPY packaging/install.sh packaging/install.sh
COPY --from=web /src/web/dist web/dist
COPY --from=web /src/web/next-build web/next-build
USER node
EXPOSE 3847
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/readyz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/src/main.ts"]
