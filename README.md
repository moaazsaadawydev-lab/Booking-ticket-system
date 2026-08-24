# 🎬 Aflamak - Distributed Cinema Booking & Ticket Microservices Platform

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeORM](https://img.shields.io/badge/TypeORM-FE0979?style=for-the-badge&logo=typeorm&logoColor=white)](https://typeorm.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Nx](https://img.shields.io/badge/Nx-143055?style=for-the-badge&logo=nx&logoColor=white)](https://nx.dev/)

A distributed cinema booking, payment execution, and digital ticket orchestration system. Built with **NestJS**, **Nx Monorepo**, **gRPC**, **RabbitMQ**, **PostgreSQL**, and **Redis**, featuring payment processing via **Paymob**, real-time ticket delivery with **JWT-signed QR codes**, and a secure **Gate Entrance Check-in Engine**.

---

## 📑 Table of Contents
1. [System Overview & Architecture](#-system-overview--architecture)
2. [End-to-End Event-Driven Workflow](#-end-to-end-event-driven-workflow)
3. [Microservices Ecosystem](#-microservices-ecosystem)
4. [Concurrency, Security & Reliability Patterns](#-concurrency-security--reliability-patterns)
5. [Frontend Applications](#-frontend-applications)
6. [Environment Variables Reference](#-environment-variables-reference)
7. [Installation & Setup Guide](#-installation--setup-guide)
8. [End-to-End Verification Test Matrix](#-end-to-end-verification-test-matrix)

---

## 🏛 System Overview & Architecture

The platform is designed following **Domain-Driven Design (DDD)** and **Event-Driven Architecture (EDA)** principles:

* **Synchronous Communication**: Low-latency internal Remote Procedure Calls (**gRPC / Protocol Buffers**) between API Gateway and Core Domain microservices.
* **Asynchronous Communication**: Distributed message broker (**RabbitMQ**) for event choreography via the **Transactional Outbox Pattern**.
* **High-Throughput Concurrency**: **Redis Distributed Locks** preventing double seat allocations and race conditions during webhook ingestion.
* **Resilient Payments**: Integration with **Paymob Payment Gateway** (Card & Mobile Wallet) backed by HMAC-SHA512 verification, payment state machines, and retry policies.
* **Secure Check-In**: Time-bounded, cryptographically signed **JWT QR codes** and pessimistic-locked gate validation preventing double-entry and ticket forgery.

```
                                  SYSTEM ARCHITECTURE TOPOLOGY
                                  
  ┌───────────────────────┐            ┌───────────────────────┐
  │   Client Web App      │            │    Admin Dashboard    │
  │ (Next.js - Port 3001) │            │ (Next.js - Port 3002) │
  └───────────┬───────────┘            └───────────┬───────────┘
              │                                    │
              └──────────────────┬─────────────────┘
                                 │ HTTP / REST (JSON)
                                 ▼
                    ┌─────────────────────────┐
                    │       API Gateway       │
                    │       (Port 3000)       │
                    └────────────┬────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │ gRPC                      │ gRPC                      │ gRPC
     ▼                           ▼                           ▼
┌─────────────┐           ┌─────────────┐             ┌─────────────┐
│    Users    │           │   Catalog   │             │   Booking   │
│ Microservice│           │ Microservice│             │ Microservice│
│ (Port 50051)│           │ (Port 50052)│             │ (Port 50053)│
└─────────────┘           └─────────────┘             └──────┬──────┘
                                                             │
     ┌───────────────────────────────────────────────────────┼───────────────────────────┐
     │ gRPC / Events                                         │ RabbitMQ Event Bus        │
     ▼                                                       ▼                           ▼
┌─────────────┐                                       ┌─────────────┐             ┌─────────────┐
│   Payment   │ ──(payment.succeeded / failed)──►     │Notifications│             │    Media    │
│ Microservice│                                       │ Microservice│             │ Microservice│
│ (Port 50054)│                                       │  (QR & Mail)│             │   (MinIO)   │
└─────────────┘                                       └─────────────┘             └─────────────┘
```

---

## 🔄 End-to-End Event-Driven Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Gateway as API Gateway
    participant Catalog as Catalog Service
    participant Booking as Booking Service
    participant Redis as Redis Cache / Locks
    participant Payment as Payment Service
    participant Paymob as Paymob Gateway
    participant RMQ as RabbitMQ Exchange
    participant Notif as Notifications Service
    actor GateStaff as Gate Checker (Staff)

    Note over Customer, Gateway: 1. Discovery & Reservation
    Customer->>Gateway: POST /api/v1/bookings (showtimeId, seatIds)
    Gateway->>Booking: gRPC CreateBookingHold()
    Booking->>Redis: Acquire Distributed Seat Lock (NX EX 600)
    Booking-->>Gateway: Booking Hold Created (Status: PENDING_PAYMENT)
    Gateway-->>Customer: 201 Created (bookingId, amount)

    Note over Customer, Paymob: 2. Checkout & Webhook Ingestion
    Customer->>Gateway: POST /api/v1/payments/initiate
    Gateway->>Payment: gRPC InitiatePayment()
    Payment->>Paymob: Authenticate & Request Payment Key
    Payment-->>Customer: Paymob Iframe / Redirect URL
    Customer->>Paymob: Completes Payment Transaction
    Paymob->>Gateway: POST /api/v1/payments/webhook (HMAC Signature)
    Gateway->>Payment: gRPC ProcessWebhook()
    Payment->>Payment: Verify HMAC-SHA512 Digest & Acquire Lock
    Payment->>Payment: DB Transaction: Payment -> SUCCESS, Write Outbox Event

    Note over Payment, Notif: 3. Outbox Publishing & Ticket Issuance
    Payment->>RMQ: PaymentOutboxPublisher emits `payment.succeeded`
    RMQ->>Booking: Booking Consumer handles `payment.succeeded`
    Booking->>Booking: DB Transaction: Booking -> CONFIRMED, Issue JWT QR Tickets
    Booking->>RMQ: BookingOutboxPublisher emits `booking.confirmed`
    RMQ->>Notif: Notifications Consumer handles `booking.confirmed`
    Notif->>Notif: Generates 250px PNG QR Code Buffers & Base64 URLs
    Notif->>Customer: Dispatches Branded HTML Confirmation Email (Nodemailer SMTP)

    Note over Customer, GateStaff: 4. Gate Entrance Check-In
    Customer->>GateStaff: Presents Ticket QR Code
    GateStaff->>Gateway: POST /api/v1/tickets/validate (qrToken, gateCinemaId)
    Gateway->>Booking: gRPC ValidateTicket()
    Booking->>Booking: Verifies JWT Sig, Expiration & Cinema Branch
    Booking->>Booking: Pessimistic Row Lock: Updates Status -> USED (409 on replay)
    Booking-->>Gateway: 200 OK (Status: USED, Entrance Authorized)
    Gateway-->>GateStaff: Green Checkmark & Seat Details
```

---

## 📦 Microservices Ecosystem

### 1. `apps/api-gateway` (Unified REST API & Security Gateway)
* **Port**: `3000` (Prefix: `/api/v1`)
* **Key Features**:
  * Centralized routing and HTTP-to-gRPC transformation.
  * `JwtAuthGuard` & `RolesGuard` protecting endpoints based on hierarchical roles.
  * Client Scope enforcement: `CLIENT_WEB` vs `ADMIN_PORTAL` route access controls.
  * Standardized response interceptors (`TransformResponseInterceptor`) and global exception filters.

### 2. `apps/Users` (Identity, Authentication & RBAC)
* **gRPC Port**: `50051` | **Database**: `Booking-Users`
* **Key Features**:
  * Role Promotion Hierarchy:
    * `SUPER_ADMIN`: Full promotion permissions across all user roles.
    * `ADMIN`: Can assign `CINEMA_ADMIN`, `STAFF`, `GATE_CHECKER` (blocked from assigning `SUPER_ADMIN` or `ADMIN`).
    * `CINEMA_ADMIN`: Scoped to manage `STAFF` and `GATE_CHECKER` within their assigned `cinemaId`.
  * Scoped Authentication: Validates client scopes (`ADMIN_PORTAL` requires staff/admin role; `403 Forbidden` for standard customers).
  * Session Invalidation: Automatic Redis session purge on role upgrade or password change.

### 3. `apps/Catalog` (Movie Discovery & Cinema Architecture)
* **gRPC Port**: `50052` | **Database**: `Booking-Catalog`
* **Key Features**:
  * Cinema chains, auditoriums, seating layouts (VIP, Regular, Premium), and showtimes.
  * Multi-level caching with Redis for high-traffic movie discovery feeds.
  * PostgreSQL `pg_trgm` fuzzy search for movie titles, actors, and directors.

### 4. `apps/Booking` (Distributed Reservation & Ticket Engine)
* **gRPC Port**: `50053` | **Database**: `Booking-Bookings`
* **Key Features**:
  * High-concurrency seat holds backed by Redis locks with TTL (`10 minutes`).
  * Expired seat sweep cron worker releasing uncompleted reservations.
  * **JWT-Signed QR Code Generation**: Issues tamper-proof tokens (`exp: showtimeEnd + 30m`) signed with custom claims.
  * **Gate Validation Engine**: Validates tickets at the entrance with row-level `pessimistic_write` locks preventing double check-ins.

### 5. `apps/Payment` (Payment State Machine & Webhooks)
* **gRPC Port**: `50054` | **Database**: `Booking-Payments`
* **Key Features**:
  * Paymob 3-step checkout lifecycle (Auth $\rightarrow$ Order Registration $\rightarrow$ Payment Key Request).
  * Redis JWT caching (`paymob:auth_token`, 50-minute TTL) eliminating redundant auth requests.
  * HMAC-SHA512 webhook digest verification and distributed locking (`payment:lock:webhook:<txId>`).
  * Idempotency enforcement and detailed transaction audit logging (`payment_logs`).
  * Transactional Outbox publisher polling pending events and publishing to RabbitMQ with retry backoff.

### 6. `apps/Notifications` (QR Code Engine & Email Dispatcher)
* **Queue**: `notification_queue` | **Database**: `Booking-Notification`
* **Key Features**:
  * Idempotent consumer for `booking.confirmed` with unique DB constraints (`sourceEventId`).
  * High-resolution in-memory QR code generator (PNG Buffer, Base64 Data URL, and CID attachments).
  * Dark-mode cinema email template (`BookingConfirmed.hbs`) with movie posters, seat badges, and barcode visuals.
  * Background scheduled publisher (`@Cron('0/5 * * * * *')`) dispatching via Nodemailer SMTP.

### 7. `apps/Media` (Asset Storage & File Pipeline)
* **Queue**: `media_queue` | **Storage**: MinIO S3 Object Storage
* **Key Features**:
  * Multi-size image cropping, optimization, and secure profile/poster uploads.

---

## 🛡 Concurrency, Security & Reliability Patterns

| Pattern | Implementation | Benefit |
| :--- | :--- | :--- |
| **Distributed Seat Lock** | `Redis.set(key, val, 'NX', 'EX', 600)` | Prevents race conditions and double bookings when multiple users click the same seat simultaneously. |
| **Transactional Outbox** | Two-phase DB commit + `@Cron` publisher | Guarantees at-least-once message delivery to RabbitMQ without expensive Two-Phase Commit (2PC). |
| **Pessimistic Check-in Lock** | `SELECT ... FOR UPDATE` on `tickets` | Eliminates replay attacks / concurrent entrance attempts with duplicate screenshots (`409 Conflict`). |
| **HMAC-SHA512 Verification** | `CryptoJS.HmacSHA512(concatString, secret)` | Ensures webhook callbacks originate strictly from Paymob's payment servers. |
| **JWT Ticket QR Signing** | Signed payload with `sub`, `showtimeId`, `exp` | Offline-verifiable tickets immune to token forgery or client-side tampering (`401 Unauthorized`). |
| **Session Invalidation** | `redisService.revokeAllUserSessions(userId)` | Immediate authorization revocation upon role promotion, password reset, or account suspension. |

---

## 💻 Frontend Applications

| Application | Technology | Container Port | Host Port | Description |
| :--- | :--- | :---: | :---: | :--- |
| **`cinema-web`** | Next.js 16 (App Router) | `3000` | `3001` | Customer-facing movie discovery, seat selection, and digital ticket viewer. |
| **`admin-dashboard`** | Next.js 16 (App Router) | `3000` | `3002` | Cinema operations portal for showtime scheduling, staff assignments, and analytics. |

Both frontend applications are packaged with multi-stage production Dockerfiles utilizing Next.js `output: 'standalone'` mode for minimal memory footprint and fast startup times.

---

## ⚙️ Environment Variables Reference

Create a `.env.development` file under `libs/env/`:

```env
# API Gateway
API_GATEWAY_PORT=3000

# PostgreSQL Databases
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USER=postgres
DATABASE_PASSWORD=Password123!

USERS_DATABASE_NAME=Booking-Users
NOTIFICATIONS_DATABASE_NAME=Booking-Notification
CATALOG_DATABASE_NAME=Booking-Catalog
BOOKING_DATABASE_NAME=Booking-Bookings
PAYMENT_DATABASE_NAME=Booking-Payments

# Redis & Message Broker
REDIS_HOST=localhost
REDIS_PORT=6379
MQ_URL=amqp://admin:admin123@localhost:5672

# JWT Secrets
JWT_ACCESS_SECRET=your-super-secret-access-key-32-chars
JWT_ACCESS_EXPIRE_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-32-chars
JWT_REFRESH_EXPIRE_IN=7d
TICKET_JWT_SECRET=your-ticket-signing-jwt-secret

# Mailer (SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password

# Paymob Integration
PAYMOB_MERCHANT_ID=1219314
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_SECRET_KEY=egy_sk_test_...
PAYMOB_PUBLIC_KEY=egy_pk_test_...
PAYMOB_HMAC_SECRET=your_hmac_secret
PAYMOB_CARD_INTEGRATION_ID=5881747
PAYMOB_WALLET_INTEGRATION_ID=5881792
PAYMOB_IFRAME_ID=1072064

# MinIO Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=profile-photos
MEDIA_BASE_URL=http://localhost:9000/profile-photos/
```

---

## 🚀 Installation & Setup Guide

### 1. Prerequisites
* **Node.js**: `v20.x` or `v22.x`
* **Docker & Docker Compose**: `v24+`
* **NPM**: `v10+`

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/moaazsaadawydev-lab/Booking-ticket-system.git
cd Booking-ticket-system
npm install --legacy-peer-deps
```

### 3. Spin Up Infrastructure Containers
```bash
# Start PostgreSQL, RabbitMQ, Redis, MinIO, Microservices & Frontends
docker compose up -d --build
```

### 4. Database Setup & Seeding
```bash
# Truncate and clean all database tables and flush Redis
npm run full:reset

# Seed default movie genres
npm run seed:catalog:genres
```

### 5. Running Microservices Locally (Development Mode)
```bash
# Run all microservices concurrently
npm run start:all:dev

# Or run individual microservices
npm run start:api:dev
npm run start:users:dev
npm run start:catalog:dev
npm run start:booking:dev
npm run start:payments:dev
npm run start:notifications:dev
```

---

## 🧪 End-to-End Verification Test Matrix

All microservices are backed by end-to-end integration test suites:

```bash
# 1. Full Payment Checkout, Webhook HMAC & Redis Lock Test
node scripts/test-payment-full-flow.js

# 2. Payment Outbox Publisher & Asynchronous Booking Confirmation
node scripts/test-payment-to-booking-flow.js

# 3. Gate Entrance Check-In, RBAC & JWT QR Code Verification
node scripts/test-ticket-validation-flow.js

# 4. Notifications Microservice, In-Memory QR Engine & Email Dispatch
node scripts/test-notifications-flow.js

# 5. User Role Promotion, Hierarchical RBAC & Scoped Authentication
node scripts/test-scoped-auth-and-roles-flow.js

# 6. Containerized Frontend Health & Standalone Asset Verification
node scripts/test-frontend-containers.js
```

### 📊 Verification Status Summary

| Test Suite | Focus Area | Assertions | Status |
| :--- | :--- | :---: | :---: |
| [`test-payment-full-flow.js`](file:///d:/Moaz/Programing/Web%20development/Full%20stack/Projects/Booking%20ticket%20system/scripts/test-payment-full-flow.js) | Paymob Checkout, Webhook HMAC, Redis Cache & Locks | 14 / 14 | **100% PASS** ✅ |
| [`test-payment-to-booking-flow.js`](file:///d:/Moaz/Programing/Web%20development/Full%20stack/Projects/Booking%20ticket%20system/scripts/test-payment-to-booking-flow.js) | Transactional Outbox, RMQ Events, Booking Transitions | 12 / 12 | **100% PASS** ✅ |
| [`test-ticket-validation-flow.js`](file:///d:/Moaz/Programing/Web%20development/Full%20stack/Projects/Booking%20ticket%20system/scripts/test-ticket-validation-flow.js) | JWT QR Verification, Double-Entry Guard, Replay Prevention | 9 / 9 | **100% PASS** ✅ |
| [`test-notifications-flow.js`](file:///d:/Moaz/Programing/Web%20development/Full%20stack/Projects/Booking%20ticket%20system/scripts/test-notifications-flow.js) | RMQ Consumer, QR Code PNG/Base64, Handlebars Email | 10 / 10 | **100% PASS** ✅ |
| [`test-scoped-auth-and-roles-flow.js`](file:///d:/Moaz/Programing/Web%20development/Full%20stack/Projects/Booking%20ticket%20system/scripts/test-scoped-auth-and-roles-flow.js) | `clientScope` (`ADMIN_PORTAL`), Role Promotion RBAC | 7 / 7 | **100% PASS** ✅ |
| [`test-frontend-containers.js`](file:///d:/Moaz/Programing/Web%20development/Full%20stack/Projects/Booking%20ticket%20system/scripts/test-frontend-containers.js) | `cinema-web` & `admin-dashboard` Docker Containers | 4 / 4 | **100% PASS** ✅ |

---

## 👥 Authors & License

Developed by **Moaaz Saadawy** and the engineering team.
Licensed under the [MIT License](LICENSE).
