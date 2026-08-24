# Stage 1: Dependencies & Builder
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy package management files
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy workspace source files
COPY nx.json tsconfig.base.json ./
COPY apps/admin-dashboard ./apps/admin-dashboard
COPY libs ./libs

# Build the Next.js app in production mode
ENV NODE_ENV=production
RUN npx nx build admin-dashboard

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-dashboard/.next/static ./apps/admin-dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-dashboard/public ./apps/admin-dashboard/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/admin-dashboard/server.js"]
