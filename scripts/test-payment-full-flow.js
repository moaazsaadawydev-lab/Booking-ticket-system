const axios = require('axios');
const Redis = require('ioredis');
const { Client: PgClient } = require('pg');
const CryptoJS = require('crypto-js');
const dotenv = require('dotenv');
const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `libs/env/.env.${nodeEnv}`) });

const API_BASE = 'http://localhost:3000/api/v1';
const HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || '7CBCB146CC4997E9906E0DBFBDB50C87';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

const pgClient = new PgClient({
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 5433,
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '624562',
  database: process.env.PAYMENT_DATABASE_NAME || 'Booking-Payments',
});

const userPg = new PgClient({
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 5433,
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '624562',
  database: 'Booking-Users',
});

const testResults = [];

function recordResult(step, name, passed, details = {}) {
  const statusStr = passed ? 'PASS' : 'FAIL';
  testResults.push({ step, name, status: statusStr, details });
  console.log(`[${statusStr}] Step ${step}: ${name}`);
  if (details && Object.keys(details).length > 0) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

function computePaymobHmac(payload, secret) {
  const obj = payload.obj || payload;
  const concatenated = [
    obj.amount_cents ?? '',
    obj.created_at ?? '',
    obj.currency ?? '',
    obj.error_occured ?? '',
    obj.has_parent_transaction ?? '',
    obj.id ?? '',
    obj.integration_id ?? '',
    obj.is_3d_secure ?? '',
    obj.is_auth ?? '',
    obj.is_capture ?? '',
    obj.is_refunded ?? '',
    obj.is_standalone_payment ?? '',
    obj.is_voided ?? '',
    obj.order?.id ?? obj.order ?? '',
    obj.owner ?? '',
    obj.pending ?? '',
    obj.source_data?.pan ?? '',
    obj.source_data?.sub_type ?? '',
    obj.source_data?.type ?? '',
    obj.success ?? '',
  ].join('');

  return CryptoJS.HmacSHA512(concatenated, secret).toString(CryptoJS.enc.Hex);
}

async function getRedisOtp(email) {
  const keys = await redis.keys(`*${email}*`);
  for (const k of keys) {
    const val = await redis.get(k);
    if (val && /^\d{4,6}$/.test(val.trim())) {
      return val.trim();
    }
  }
  return null;
}

async function runPaymentFullFlowTest() {
  console.log('=================================================================================');
  console.log('💳 Payment Microservice: Complete Payment Flow & Webhook Orchestration Test');
  console.log('=================================================================================\n');

  await pgClient.connect();
  await userPg.connect();

  let superAdminToken = '';
  let customerToken = '';
  let customerUserId = '';
  let showtimeId = '';
  let seatId = '';
  let bookingId = '';
  let paymentId = '';
  let providerOrderId = '';
  const mockTxId = `TX-${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // Step 1: User Registration & Authentication Setup
    // -------------------------------------------------------------
    console.log('--- Step 1: User Registration & Authentication ---');
    const superEmail = `super.pay.${Date.now()}@test.com`;
    const customerEmail = `customer.pay.${Date.now()}@test.com`;
    const password = 'Password123!';

    // Register Super Admin
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Super Admin',
      email: superEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    });

    const superOtp = await getRedisOtp(superEmail);
    if (superOtp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: superEmail,
        code: superOtp,
      });
    }

    await userPg.query(
      `UPDATE users SET role = 'super_admin', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [superEmail],
    );

    const superLoginRes = await axios.post(`${API_BASE}/users/auth/login`, {
      email: superEmail,
      password,
    });
    superAdminToken = superLoginRes.data?.data?.accessToken || superLoginRes.data?.accessToken;

    // Register Customer User
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Payment Customer',
      email: customerEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    });

    const customerOtp = await getRedisOtp(customerEmail);
    if (customerOtp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: customerEmail,
        code: customerOtp,
      });
    }

    await userPg.query(
      `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [customerEmail],
    );

    const custLoginRes = await axios.post(`${API_BASE}/users/auth/login`, {
      email: customerEmail,
      password,
    });
    customerToken = custLoginRes.data?.data?.accessToken || custLoginRes.data?.accessToken;
    customerUserId = custLoginRes.data?.data?.user?.id || custLoginRes.data?.user?.id;

    recordResult('1.0', 'User Provisioning (Super Admin & Customer)', !!superAdminToken && !!customerToken, {
      customerUserId,
      customerEmail,
    });

    // -------------------------------------------------------------
    // Step 2: Catalog Setup (Movie, Cinema, Auditorium, Seats, Showtime)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Catalog Setup ---');
    const movieRes = await axios.post(
      `${API_BASE}/movies`,
      {
        title: `Payment Test Movie ${Date.now().toString().slice(-4)}`,
        description: 'End-to-end payment test movie',
        durationMinutes: 120,
        releaseDate: '2026-09-01',
        ageRating: 'PG_13',
        status: 'NOW_SHOWING',
        countryOfOrigin: 'US',
        originalLanguage: 'en',
        spokenLanguages: ['en'],
        subtitles: ['ar'],
        posterUrl: 'https://image.tmdb.org/t/p/w500/sample.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=sample',
      },
      { headers: { Authorization: `Bearer ${superAdminToken}` } },
    );
    const movieId = movieRes.data?.data?.id || movieRes.data?.id;

    const cinemaRes = await axios.post(
      `${API_BASE}/cinemas`,
      {
        name: `Cinema Payment Mall ${Date.now().toString().slice(-4)}`,
        city: 'Cairo',
        address: 'Downtown Fifth Settlement',
        country: 'EG',
      },
      { headers: { Authorization: `Bearer ${superAdminToken}` } },
    );
    const cinemaId = cinemaRes.data?.data?.id || cinemaRes.data?.id;

    const auditoriumRes = await axios.post(
      `${API_BASE}/cinemas/${cinemaId}/auditoriums`,
      {
        name: 'Hall Pay-1',
        experienceType: 'STANDARD_2D',
        totalRows: 2,
        totalColumns: 4,
      },
      { headers: { Authorization: `Bearer ${superAdminToken}` } },
    );
    const auditoriumId = auditoriumRes.data?.data?.id || auditoriumRes.data?.id;

    const seatsRes = await axios.get(`${API_BASE}/seats/auditorium/${auditoriumId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const seatsList = seatsRes.data?.data?.seats || seatsRes.data?.seats || [];
    seatId = seatsList[0].id;

    const showtimeRes = await axios.post(
      `${API_BASE}/showtimes`,
      {
        movieId,
        auditoriumId,
        startTime: '2026-12-25T20:00:00.000Z',
        endTime: '2026-12-25T22:30:00.000Z',
        experienceType: 'STANDARD_2D',
        basePrice: 150,
      },
      { headers: { Authorization: `Bearer ${superAdminToken}` } },
    );
    showtimeId = showtimeRes.data?.data?.id || showtimeRes.data?.id;

    recordResult('2.0', 'Catalog Setup (Movie, Cinema, Auditorium, Showtime)', !!showtimeId && !!seatId, {
      movieId,
      cinemaId,
      auditoriumId,
      showtimeId,
      seatId,
    });

    // -------------------------------------------------------------
    // Step 3: Booking Seat Hold
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Booking Seat Hold ---');
    const holdRes = await axios.post(
      `${API_BASE}/bookings/hold`,
      {
        showtimeId,
        seatIds: [seatId],
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );
    const booking = holdRes.data?.data?.booking || holdRes.data?.booking;
    bookingId = booking?.id;

    recordResult('3.0', 'Booking Seat Hold Creation', booking?.status === 'PENDING_PAYMENT', {
      bookingId,
      status: booking?.status,
      totalAmount: booking?.totalAmount,
    });

    // -------------------------------------------------------------
    // Step 4: Paymob Auth Token Redis Caching Test
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Paymob Auth Token Redis Caching ---');
    const initialCachedToken = await redis.get('paymob:auth_token');
    const tokenTTLBefore = await redis.ttl('paymob:auth_token');

    recordResult('4.1', 'Paymob Auth Token Caching Inspection in Redis', true, {
      hasCachedToken: !!initialCachedToken,
      ttlRemainingSeconds: tokenTTLBefore,
    });

    // -------------------------------------------------------------
    // Step 5: Initiate Payment Session via API Gateway
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Initiate Payment Session via API Gateway ---');
    const initRes = await axios.post(
      `${API_BASE}/payments/initiate`,
      {
        bookingId,
        amount: 150.0,
        currency: 'EGP',
        method: 'CARD',
        billingData: {
          first_name: 'Payment',
          last_name: 'Customer',
          email: customerEmail,
          phone_number: '+201099998888',
          city: 'Cairo',
          country: 'EG',
        },
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );

    const initData = initRes.data?.data || initRes.data;
    paymentId = initData.paymentId;
    providerOrderId = initData.providerOrderId;
    const paymentToken = initData.paymentToken;
    const iframeUrl = initData.iframeUrl;

    const isInitValid =
      !!paymentId &&
      !!paymentToken &&
      !!providerOrderId &&
      iframeUrl.includes('accept.paymob.com');

    recordResult('5.1', 'Payment Session Initiated with Paymob Checkout URL', isInitValid, {
      paymentId,
      providerOrderId,
      paymentTokenPrefix: paymentToken ? paymentToken.slice(0, 20) + '...' : 'none',
      iframeUrl: iframeUrl ? iframeUrl.slice(0, 65) + '...' : 'none',
    });

    // Verify Redis Token is populated and has TTL
    const postCachedToken = await redis.get('paymob:auth_token');
    const postTTL = await redis.ttl('paymob:auth_token');

    recordResult('5.2', 'Paymob Auth Token Cached in Redis after Checkout', !!postCachedToken && postTTL > 2000, {
      tokenLength: postCachedToken ? postCachedToken.length : 0,
      ttlSeconds: postTTL,
    });

    // Verify DB Payment record is PENDING
    const dbPaymentRes = await pgClient.query(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
    const dbPayment = dbPaymentRes.rows[0];

    recordResult('5.3', 'Payment Row in Database is PENDING', dbPayment.status === 'PENDING', {
      dbPaymentId: dbPayment.id,
      status: dbPayment.status,
      providerOrderId: dbPayment.provider_order_id,
      amount: dbPayment.amount,
    });

    // -------------------------------------------------------------
    // Step 6: Tampered Webhook HMAC Rejection Test
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Tampered Webhook Signature Rejection ---');
    const mockWebhookPayload = {
      type: 'TRANSACTION',
      obj: {
        id: mockTxId,
        pending: false,
        amount_cents: 15000,
        success: true,
        is_auth: false,
        is_capture: false,
        is_standalone_payment: true,
        is_voided: false,
        is_refunded: false,
        is_3d_secure: true,
        integration_id: 5881747,
        owner: 1219314,
        order: {
          id: Number(providerOrderId),
          merchant_order_id: bookingId,
        },
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        source_data: {
          pan: '2346',
          sub_type: 'MasterCard',
          type: 'card',
        },
      },
    };

    let tamperedRejected = false;
    try {
      await axios.post(
        `${API_BASE}/payments/webhook/paymob?hmac=INVALID_TAMPERED_SIGNATURE_12345`,
        mockWebhookPayload,
      );
    } catch (err) {
      tamperedRejected = err.response?.status === 400 || err.response?.status === 500;
    }

    recordResult('6.1', 'Tampered Webhook Signature Correctly Rejected', tamperedRejected, {
      tamperedRejected,
    });

    // -------------------------------------------------------------
    // Step 7: Valid Paymob Webhook Processing & State Transition
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Valid Paymob Webhook Ingestion & State Transition ---');
    const validHmac = computePaymobHmac(mockWebhookPayload, HMAC_SECRET);

    const webhookRes = await axios.post(
      `${API_BASE}/payments/webhook/paymob?hmac=${validHmac}`,
      mockWebhookPayload,
    );
    const webhookData = webhookRes.data?.data || webhookRes.data;

    recordResult('7.1', 'Valid Webhook Accepted by API Gateway', webhookRes.status === 200 && webhookData.success, {
      responseMessage: webhookData.message,
      transactionId: webhookData.transactionId,
    });

    // Assert Payment in DB transitioned to SUCCEEDED
    const succPaymentRes = await pgClient.query(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
    const succPayment = succPaymentRes.rows[0];

    recordResult('7.2', 'Payment Transitioned to SUCCEEDED in PostgreSQL', succPayment.status === 'SUCCEEDED', {
      paymentId: succPayment.id,
      status: succPayment.status,
      providerTransactionId: succPayment.provider_transaction_id,
    });

    // Assert Audit Log was persisted in payment_logs
    const logRes = await pgClient.query(
      `SELECT * FROM payment_logs WHERE payment_id = $1 ORDER BY created_at DESC`,
      [paymentId],
    );
    const validLog = logRes.rows.find((l) => l.is_valid_signature === true);

    recordResult('7.3', 'Audit Log Persisted in payment_logs with Valid Signature Flag', !!validLog, {
      logsCount: logRes.rows.length,
      hasValidSignature: validLog ? validLog.is_valid_signature : false,
      providerTransactionId: validLog ? validLog.provider_transaction_id : null,
    });

    // Assert Domain Event Persisted in payment_outbox
    const outboxRes = await pgClient.query(
      `SELECT * FROM payment_outbox WHERE payload->>'paymentId' = $1 ORDER BY created_at DESC`,
      [paymentId],
    );
    const outboxEvent = outboxRes.rows[0];

    recordResult('7.4', 'Payment Succeeded Event Persisted in payment_outbox', !!outboxEvent && outboxEvent.event_type === 'payment.succeeded', {
      outboxId: outboxEvent ? outboxEvent.id : null,
      eventType: outboxEvent ? outboxEvent.event_type : null,
      status: outboxEvent ? outboxEvent.status : null,
      routingKey: outboxEvent ? outboxEvent.routing_key : null,
    });

    // -------------------------------------------------------------
    // Step 8: Idempotency Verification on Duplicate Webhook Delivery
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Idempotency & Duplicate Webhook Delivery Verification ---');
    const dupRes = await axios.post(
      `${API_BASE}/payments/webhook/paymob?hmac=${validHmac}`,
      mockWebhookPayload,
    );
    const dupData = dupRes.data?.data || dupRes.data;

    const outboxCountAfterRes = await pgClient.query(
      `SELECT COUNT(*) as count FROM payment_outbox WHERE payload->>'paymentId' = $1`,
      [paymentId],
    );
    const outboxCount = Number(outboxCountAfterRes.rows[0].count);

    recordResult('8.1', 'Duplicate Webhook Returns 200 and Zero Duplicate Outbox Records', dupRes.status === 200 && outboxCount === 1, {
      status: dupRes.status,
      message: dupData.message,
      outboxRecordCount: outboxCount,
    });

    // -------------------------------------------------------------
    // Step 9: Get Payment by ID & by Booking ID
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Query Payment by ID & by Booking ID ---');
    const getByIdRes = await axios.get(`${API_BASE}/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const byIdData = getByIdRes.data?.data || getByIdRes.data;

    const getByBookingRes = await axios.get(`${API_BASE}/payments/booking/${bookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const byBookingData = getByBookingRes.data?.data || getByBookingRes.data;

    const idMatches = (byIdData.payment?.id || byIdData.id) === paymentId;
    const bookingMatches = (byBookingData.payment?.bookingId || byBookingData.bookingId) === bookingId;

    recordResult('9.1', 'Query Payment by ID & Booking ID Verification', idMatches && bookingMatches, {
      paymentId: byIdData.payment?.id || byIdData.id,
      bookingId: byBookingData.payment?.bookingId || byBookingData.bookingId,
      status: byIdData.payment?.status || byIdData.status,
      logsCount: (byIdData.payment?.logs || byIdData.logs)?.length || 0,
    });
  } catch (err) {
    console.error('Fatal Error during payment full flow test:', err.response?.data || err.message);
    recordResult('FAIL_ERROR', 'Test Pipeline Execution', false, {
      error: err.response?.data || err.message,
    });
  } finally {
    await pgClient.end();
    await userPg.end();
    await redis.quit();
  }

  // -------------------------------------------------------------
  // Test Summary Matrix
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 COMPLETE PAYMENT EXECUTION LIFECYCLE VERIFICATION MATRIX');
  console.log('=================================================================================');

  console.table(
    testResults.map((r) => ({
      Step: r.step,
      Name: r.name,
      Status: r.status,
    })),
  );

  const total = testResults.length;
  const passedCount = testResults.filter((r) => r.status === 'PASS').length;
  const failedCount = total - passedCount;

  console.log(`\nTOTAL: ${total} | PASSED: ${passedCount} | FAILED: ${failedCount}`);

  if (failedCount === 0) {
    console.log('🎉 ALL PAYMENT & WEBHOOK LIFECYCLE TESTS PASSED WITH 100% SUCCESS!\n');
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runPaymentFullFlowTest().catch((err) => {
  console.error('Unhandled Test Failure:', err);
  process.exit(1);
});
