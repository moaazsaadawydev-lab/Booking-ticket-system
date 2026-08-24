FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx nx build Booking --configuration=production

FROM node:20-slim AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/Booking ./dist/apps/Booking
COPY libs/protos ./libs/protos

ENV NODE_ENV=docker-development
EXPOSE 50053 3003
CMD ["node", "dist/apps/Booking/main.js"]
