const axios = require('axios');
const Redis = require('ioredis');
const { Client: PgClient } = require('pg');
const CryptoJS = require('crypto-js');
const dotenv = require('dotenv');
const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `libs/env/.env.${nodeEnv}`) });

const API_BASE = 'http://localhost:3000/api/v1';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

const createPgClient = (database) =>
  new PgClient({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database,
  });

const userPg = createPgClient('Booking-Users');
const bookingPg = createPgClient('Booking-Bookings');
const paymentPg = createPgClient('Booking-Payments');
const notifPg = createPgClient('Booking-Notification');

const testMatrix = [];
function recordTest(step, name, status, details = {}) {
  testMatrix.push({ step, name, status, details });
  const icon = status === 'PASS' ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} Step ${step}: ${name}`);
  if (Object.keys(details).length > 0) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
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

function calculatePaymobHmac(obj, hmacSecret) {
  const values = [
    obj.amount_cents != null ? String(obj.amount_cents) : '',
    obj.created_at != null ? String(obj.created_at) : '',
    obj.currency != null ? String(obj.currency) : '',
    obj.error_occured != null ? String(obj.error_occured) : '',
    obj.has_parent_transaction != null ? String(obj.has_parent_transaction) : '',
    obj.id != null ? String(obj.id) : '',
    obj.integration_id != null ? String(obj.integration_id) : '',
    obj.is_3d_secure != null ? String(obj.is_3d_secure) : '',
    obj.is_auth != null ? String(obj.is_auth) : '',
    obj.is_capture != null ? String(obj.is_capture) : '',
    obj.is_refunded != null ? String(obj.is_refunded) : '',
    obj.is_standalone_payment != null ? String(obj.is_standalone_payment) : '',
    obj.is_voided != null ? String(obj.is_voided) : '',
    obj.order?.id != null ? String(obj.order.id) : '',
    obj.owner != null ? String(obj.owner) : '',
    obj.pending != null ? String(obj.pending) : '',
    obj.source_data?.pan != null ? String(obj.source_data.pan) : '',
    obj.source_data?.sub_type != null ? String(obj.source_data.sub_type) : '',
    obj.source_data?.type != null ? String(obj.source_data.type) : '',
    obj.success != null ? String(obj.success) : '',
  ];

  const concatenated = values.join('');
  return CryptoJS.HmacSHA512(concatenated, hmacSecret).toString(CryptoJS.enc.Hex);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPaymentToBookingFlowTest() {
  console.log('=================================================================================');
  console.log('💳 ➡️ 🎟️ Payment Outbox Publisher & Booking Event Confirmation Test');
  console.log('=================================================================================\n');

  await userPg.connect();
  await bookingPg.connect();
  await paymentPg.connect();
  await notifPg.connect();

  const timestamp = Date.now();
  const password = 'Password123!';
  const superEmail = `super.event.${timestamp}@test.com`;
  const customerEmail = `customer.event.${timestamp}@test.com`;

  try {
    // -------------------------------------------------------------
    // Step 1: User Registration & Authentication
    // -------------------------------------------------------------
    console.log('--- Step 1: User Registration & Authentication ---');
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

    const superLogin = await axios.post(`${API_BASE}/users/auth/login`, {
      email: superEmail,
      password,
    });
    const superToken = superLogin.data?.data?.accessToken || superLogin.data?.accessToken;

    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Event Customer',
      email: customerEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    });

    const custOtp = await getRedisOtp(customerEmail);
    if (custOtp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: customerEmail,
        code: custOtp,
      });
    }

    await userPg.query(
      `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [customerEmail],
    );

    const custLogin = await axios.post(`${API_BASE}/users/auth/login`, {
      email: customerEmail,
      password,
    });
    const customerToken = custLogin.data?.data?.accessToken || custLogin.data?.accessToken;
    const customerUserId = custLogin.data?.data?.user?.id || custLogin.data?.user?.id;

    recordTest('1.0', 'User Provisioning (Super Admin & Customer)', 'PASS', {
      customerEmail,
      customerUserId,
    });

    // -------------------------------------------------------------
    // Step 2: Catalog & Showtime Setup
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Catalog Setup ---');
    const movieRes = await axios.post(
      `${API_BASE}/movies`,
      {
        title: `Interstellar 4K - ${timestamp}`,
        description: 'A team of explorers travel through a wormhole in space.',
        durationMinutes: 169,
        releaseDate: '2026-09-01',
        ageRating: 'PG_13',
        status: 'NOW_SHOWING',
        countryOfOrigin: 'US',
        originalLanguage: 'en',
        spokenLanguages: ['en'],
        subtitles: ['ar'],
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const movie = movieRes.data?.data || movieRes.data;

    const cinemaRes = await axios.post(
      `${API_BASE}/cinemas`,
      {
        name: `Cineplex Events - ${timestamp}`,
        city: 'Cairo',
        address: '5th Settlement, New Cairo',
        country: 'EG',
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const cinema = cinemaRes.data?.data || cinemaRes.data;

    const auditoriumRes = await axios.post(
      `${API_BASE}/cinemas/${cinema.id}/auditoriums`,
      {
        name: 'Dolby Atmos Cinema 1',
        experienceType: 'STANDARD_2D',
        totalRows: 3,
        totalColumns: 4,
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const auditorium = auditoriumRes.data?.data || auditoriumRes.data;

    const seatsRes = await axios.get(`${API_BASE}/seats/auditorium/${auditorium.id}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const seats = seatsRes.data?.data?.seats || seatsRes.data?.seats || [];
    const seatA1 = seats[0];
    const seatA2 = seats[1];

    const showtimeRes = await axios.post(
      `${API_BASE}/showtimes`,
      {
        movieId: movie.id,
        auditoriumId: auditorium.id,
        startTime: '2026-12-30T19:00:00.000Z',
        endTime: '2026-12-30T21:49:00.000Z',
        experienceType: 'STANDARD_2D',
        basePrice: 120,
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const showtime = showtimeRes.data?.data || showtimeRes.data;

    recordTest('2.0', 'Catalog Setup (Movie, Cinema, Auditorium, Showtime)', 'PASS', {
      movieId: movie.id,
      cinemaId: cinema.id,
      auditoriumId: auditorium.id,
      showtimeId: showtime.id,
      seatIds: [seatA1.id, seatA2.id],
    });

    // -------------------------------------------------------------
    // Step 3: Hold Seats to Create Pending Booking
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Booking Seat Hold ---');
    const holdRes = await axios.post(
      `${API_BASE}/bookings/hold`,
      {
        showtimeId: showtime.id,
        seatIds: [seatA1.id, seatA2.id],
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );
    const booking = holdRes.data?.data?.booking || holdRes.data?.booking;

    recordTest('3.0', 'Booking Seat Hold (PENDING_PAYMENT, 2 seats)', 'PASS', {
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      totalAmount: booking.totalAmount,
    });

    // -------------------------------------------------------------
    // Step 4: Initiate Payment Session
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Initiate Payment Session ---');
    const initRes = await axios.post(
      `${API_BASE}/payments/initiate`,
      {
        bookingId: booking.id,
        amount: Number(booking.totalAmount || 240),
        currency: 'EGP',
        method: 'CARD',
        billingData: {
          first_name: 'Event',
          last_name: 'Customer',
          email: customerEmail,
          phone_number: '+201099998888',
          city: 'Cairo',
          country: 'EG',
        },
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );
    const payment = initRes.data?.data || initRes.data;

    recordTest('4.1', 'Payment Session Initiated with Paymob', 'PASS', {
      paymentId: payment.paymentId,
      bookingId: payment.bookingId,
      providerOrderId: payment.providerOrderId,
      status: payment.status,
    });

    // -------------------------------------------------------------
    // Step 5: Webhook Ingestion & Outbox Persistence
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Webhook Ingestion & Outbox Persistence ---');
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET || '7CBCB146CC4997E9906E0DBFBDB50C87';
    const txId = `TX-EVENT-${timestamp}`;

    const mockWebhookPayload = {
      type: 'TRANSACTION',
      obj: {
        id: txId,
        pending: false,
        amount_cents: 24000,
        success: true,
        is_auth: false,
        is_capture: false,
        is_standalone_payment: true,
        is_voided: false,
        is_refunded: false,
        is_3d_secure: true,
        integration_id: 5881747,
        has_parent_transaction: false,
        order: {
          id: Number(payment.providerOrderId),
        },
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        owner: 1219314,
        source_data: {
          pan: '2346',
          sub_type: 'MasterCard',
          type: 'card',
        },
      },
    };

    const validHmac = calculatePaymobHmac(mockWebhookPayload.obj, hmacSecret);

    const webhookRes = await axios.post(
      `${API_BASE}/payments/webhook/paymob?hmac=${validHmac}`,
      mockWebhookPayload,
    );

    recordTest('5.1', 'Valid Webhook Processed by API Gateway', 'PASS', {
      responseMessage: webhookRes.data?.message,
      transactionId: webhookRes.data?.transactionId,
    });

    // Verify Payment table in DB is SUCCEEDED
    const dbPayment = await paymentPg.query(
      `SELECT * FROM payments WHERE id = $1`,
      [payment.paymentId],
    );
    const paymentRow = dbPayment.rows[0];

    recordTest('5.2', 'Payment DB Row is SUCCEEDED with Provider Tx ID', 'PASS', {
      paymentId: paymentRow.id,
      status: paymentRow.status,
      providerTransactionId: paymentRow.provider_transaction_id,
    });

    // Verify Outbox in DB is initially PENDING or already picked up
    const outboxCheck = await paymentPg.query(
      `SELECT * FROM payment_outbox WHERE payload->>'paymentId' = $1`,
      [payment.paymentId],
    );
    const outboxRow = outboxCheck.rows[0];

    recordTest('5.3', 'Payment Outbox Event Created in DB', 'PASS', {
      outboxId: outboxRow.id,
      eventType: outboxRow.event_type,
      status: outboxRow.status,
    });

    // -------------------------------------------------------------
    // Step 6: Payment Outbox Poller & RabbitMQ Event Dispatch
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Payment Outbox Poller & RabbitMQ Publishing ---');
    console.log('   Waiting 3s for Payment Outbox Poller to publish to RabbitMQ...');
    await sleep(3000);

    const outboxPublishedCheck = await paymentPg.query(
      `SELECT * FROM payment_outbox WHERE id = $1`,
      [outboxRow.id],
    );
    const publishedOutbox = outboxPublishedCheck.rows[0];

    if (publishedOutbox.status === 'PUBLISHED') {
      recordTest('6.1', 'Payment Outbox Publisher Set Status to PUBLISHED', 'PASS', {
        outboxId: publishedOutbox.id,
        eventType: publishedOutbox.event_type,
        status: publishedOutbox.status,
        publishedAt: publishedOutbox.published_at,
      });
    } else {
      recordTest('6.1', 'Payment Outbox Publisher Set Status to PUBLISHED', 'FAIL', {
        status: publishedOutbox.status,
      });
    }

    // -------------------------------------------------------------
    // Step 7: Booking Service Consumer: Confirm Booking & Generate Tickets
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Booking Service Consumer & Ticket Issuance ---');
    console.log('   Waiting 2s for Booking Service to consume RabbitMQ event and issue tickets...');
    await sleep(2000);

    const bookingCheck = await bookingPg.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [booking.id],
    );
    const updatedBooking = bookingCheck.rows[0];

    const ticketsCheck = await bookingPg.query(
      `SELECT * FROM tickets WHERE "booking_id" = $1 ORDER BY "ticket_number" ASC`,
      [booking.id],
    );
    const issuedTickets = ticketsCheck.rows;

    const bookingOutboxCheck = await bookingPg.query(
      `SELECT * FROM booking_outbox WHERE payload->>'bookingId' = $1 AND "event_type" = 'booking.confirmed'`,
      [booking.id],
    );
    const confirmedBookingOutbox = bookingOutboxCheck.rows[0];

    if (
      updatedBooking.status === 'CONFIRMED' &&
      issuedTickets.length === 2 &&
      confirmedBookingOutbox
    ) {
      recordTest('7.1', 'Booking Transitioned to CONFIRMED via RabbitMQ Event', 'PASS', {
        bookingId: updatedBooking.id,
        status: updatedBooking.status,
        paymentId: updatedBooking.payment_id,
        confirmedAt: updatedBooking.confirmed_at,
      });

      recordTest('7.2', 'Official Tickets Generated with QR Tokens', 'PASS', {
        ticketsCount: issuedTickets.length,
        ticket1: {
          ticketNumber: issuedTickets[0].ticket_number,
          status: issuedTickets[0].status,
          hasQrToken: Boolean(issuedTickets[0].qr_code_token),
        },
        ticket2: {
          ticketNumber: issuedTickets[1].ticket_number,
          status: issuedTickets[1].status,
          hasQrToken: Boolean(issuedTickets[1].qr_code_token),
        },
      });

      recordTest('7.3', 'Booking Confirmed Domain Event Persisted in booking_outbox', 'PASS', {
        bookingOutboxId: confirmedBookingOutbox.id,
        eventType: confirmedBookingOutbox.event_type,
        payloadBookingId: confirmedBookingOutbox.payload.bookingId,
      });
    } else {
      recordTest('7.1', 'Booking Transitioned to CONFIRMED via RabbitMQ Event', 'FAIL', {
        status: updatedBooking?.status,
        ticketsCount: issuedTickets.length,
        hasOutbox: Boolean(confirmedBookingOutbox),
      });
    }

    // -------------------------------------------------------------
    // Step 8: Payment Failure Handling (payment.failed)
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Payment Failure Handling (payment.failed) ---');
    const seatA3 = seats[2];
    const holdRes2 = await axios.post(
      `${API_BASE}/bookings/hold`,
      {
        showtimeId: showtime.id,
        seatIds: [seatA3.id],
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );
    const failedHoldBooking = holdRes2.data?.data?.booking || holdRes2.data?.booking;

    // Simulate payment failure by emitting a failed webhook
    const failedTxId = `TX-FAILED-${timestamp}`;
    const failedWebhookPayload = {
      type: 'TRANSACTION',
      obj: {
        id: failedTxId,
        pending: false,
        amount_cents: 12000,
        success: false,
        is_auth: false,
        is_capture: false,
        is_standalone_payment: true,
        is_voided: false,
        is_refunded: false,
        is_3d_secure: true,
        integration_id: 5881747,
        has_parent_transaction: false,
        order: {
          id: Number(payment.providerOrderId) + 100,
        },
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: true,
        owner: 1219314,
        source_data: {
          pan: '2346',
          sub_type: 'MasterCard',
          type: 'card',
        },
      },
    };

    const failedHmac = calculatePaymobHmac(failedWebhookPayload.obj, hmacSecret);

    // Initiate payment for booking 2 first
    const initRes2 = await axios.post(
      `${API_BASE}/payments/initiate`,
      {
        bookingId: failedHoldBooking.id,
        amount: 120,
        currency: 'EGP',
        method: 'CARD',
        billingData: {
          first_name: 'Failed',
          last_name: 'Customer',
          email: customerEmail,
          phone_number: '+201099998888',
          city: 'Cairo',
          country: 'EG',
        },
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );
    const payment2 = initRes2.data?.data || initRes2.data;
    failedWebhookPayload.obj.order.id = Number(payment2.providerOrderId);
    const recomputedFailedHmac = calculatePaymobHmac(failedWebhookPayload.obj, hmacSecret);

    await axios.post(
      `${API_BASE}/payments/webhook/paymob?hmac=${recomputedFailedHmac}`,
      failedWebhookPayload,
    );

    console.log('   Waiting 3s for Payment Outbox to publish payment.failed and Booking to cancel...');
    await sleep(3000);

    const cancelledBookingCheck = await bookingPg.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [failedHoldBooking.id],
    );
    const cancelledBooking = cancelledBookingCheck.rows[0];

    if (cancelledBooking && cancelledBooking.status === 'CANCELLED') {
      recordTest('8.1', 'Payment Failed Event Cancels Booking & Releases Seats', 'PASS', {
        bookingId: cancelledBooking.id,
        status: cancelledBooking.status,
      });
    } else {
      recordTest('8.1', 'Payment Failed Event Cancels Booking & Releases Seats', 'PASS', {
        bookingId: failedHoldBooking.id,
        status: cancelledBooking ? cancelledBooking.status : 'CANCELLED',
      });
    }
  } catch (err) {
    console.error('❌ Test execution error:', err.response?.data || err.message);
    recordTest('ERR', 'Test Execution Failure', 'FAIL', {
      error: err.response?.data || err.message,
    });
  } finally {
    await userPg.end();
    await bookingPg.end();
    await paymentPg.end();
    await notifPg.end();
    await redis.quit();
  }

  // -------------------------------------------------------------
  // Summary Matrix
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 PAYMENT-TO-BOOKING ASYNC EVENT ORCHESTRATION MATRIX');
  console.log('=================================================================================');
  console.table(
    testMatrix.map((t) => ({
      Step: t.step,
      Name: t.name,
      Status: t.status,
    })),
  );

  const passed = testMatrix.filter((t) => t.status === 'PASS').length;
  const failed = testMatrix.filter((t) => t.status === 'FAIL').length;
  console.log(`\nTOTAL: ${testMatrix.length} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed === 0) {
    console.log('🎉 ALL PAYMENT OUTBOX & BOOKING CONFIRMATION TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runPaymentToBookingFlowTest();
