FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

ENV NODE_ENV=production
RUN npx nx build admin-dashboard

FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/admin-dashboard/.next/standalone ./
COPY --from=builder /app/apps/admin-dashboard/.next/static ./apps/admin-dashboard/.next/static
COPY --from=builder /app/apps/admin-dashboard/public ./apps/admin-dashboard/public

EXPOSE 3000

CMD ["node", "apps/admin-dashboard/server.js"]
