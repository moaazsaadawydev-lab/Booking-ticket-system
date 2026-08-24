# Stage 1: Dependencies & Builder
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy package management files
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy workspace source files
COPY nx.json tsconfig.base.json ./
COPY apps/cinema-web ./apps/cinema-web
COPY libs ./libs

# Build the Next.js app in production mode
ENV NODE_ENV=production
RUN npx nx build cinema-web

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/cinema-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/cinema-web/.next/static ./apps/cinema-web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/cinema-web/public ./apps/cinema-web/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/cinema-web/server.js"]
