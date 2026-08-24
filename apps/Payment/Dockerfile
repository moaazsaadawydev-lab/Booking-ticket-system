FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx nx build Payment --configuration=production

FROM node:20-slim AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/Payment ./dist/apps/Payment
COPY libs/protos ./libs/protos

ENV NODE_ENV=docker-development
EXPOSE 50054
CMD ["node", "dist/apps/Payment/main.js"]
