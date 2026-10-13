# AEO Audit API (Express + headless Chromium).
# Builds the React client too, so the same image can serve everything when SERVE_CLIENT=true.

# ---------- build: install all deps and build the client ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
# mongodb-memory-server (a test-only devDependency) would otherwise download a MongoDB binary.
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY client client
RUN npm run build -w client

# ---------- runtime: production deps + Chromium ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=4000
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --omit=dev -w server && npm cache clean --force

# Headless Chromium + the system libraries it needs, matching the installed Playwright version.
RUN npx --no-install playwright install --with-deps chromium-headless-shell \
    && rm -rf /var/lib/apt/lists/*

COPY server server
COPY --from=build /app/client/dist client/dist

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.js"]
