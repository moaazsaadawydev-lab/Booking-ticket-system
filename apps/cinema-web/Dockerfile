FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

ENV NODE_ENV=production
RUN npx nx build cinema-web

FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/cinema-web/.next/standalone ./
COPY --from=builder /app/apps/cinema-web/.next/static ./apps/cinema-web/.next/static
COPY --from=builder /app/apps/cinema-web/public ./apps/cinema-web/public

EXPOSE 3000

CMD ["node", "apps/cinema-web/server.js"]
