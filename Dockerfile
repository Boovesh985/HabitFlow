# All-in-one image: builds the React web app and serves it from the Express API.
# One container + one PostgreSQL database is all you need.

FROM node:24-alpine AS web
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:24-alpine AS api
RUN apk add --no-cache openssl
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:24-alpine
RUN apk add --no-cache openssl tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    STATIC_DIR=/app/public
COPY --from=api /app/server/node_modules ./node_modules
COPY --from=api /app/server/dist ./dist
COPY --from=api /app/server/prisma ./prisma
COPY --from=api /app/server/package.json ./
COPY --from=web /app/client/dist ./public
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# Apply pending database migrations, then start the API + web server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
