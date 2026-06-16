FROM node:22 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22 AS production-deps

WORKDIR /app/server

COPY server/package*.json ./
RUN npm install --omit=dev

FROM node:22-slim

ENV NODE_ENV=production
ENV PORT=9999
ENV DATA_DIR=/data

WORKDIR /app

COPY package*.json ./
COPY server ./server
COPY --from=production-deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/dist ./dist

EXPOSE 9999
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:9999/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
