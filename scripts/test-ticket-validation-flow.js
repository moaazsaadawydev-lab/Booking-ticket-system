const axios = require('axios');
const Redis = require('ioredis');
const { Client: PgClient } = require('pg');
const jwt = require('jsonwebtoken');
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

async function runTicketValidationFlowTest() {
  console.log('=================================================================================');
  console.log('🎟️ Gate Check-in Engine, RBAC (GATE_CHECKER) & JWT-Signed QR Code Verification');
  console.log('=================================================================================\n');

  await userPg.connect();
  await bookingPg.connect();
  await paymentPg.connect();

  const timestamp = Date.now();
  const password = 'Password123!';
  const superEmail = `super.gate.${timestamp}@test.com`;
  const gateEmail = `gate.staff.${timestamp}@test.com`;
  const customerEmail = `customer.gate.${timestamp}@test.com`;

  try {
    // -------------------------------------------------------------
    // Step 1: User Provisioning (Super Admin, Gate Staff, Customer)
    // -------------------------------------------------------------
    console.log('--- Step 1: User Provisioning & RBAC Setup ---');

    // 1.1 Super Admin
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

    // 1.2 Gate Checker Staff
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Gate Scanner Staff',
      email: gateEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    });
    const gateOtp = await getRedisOtp(gateEmail);
    if (gateOtp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: gateEmail,
        code: gateOtp,
      });
    }
    await userPg.query(
      `UPDATE users SET role = 'gate_checker', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [gateEmail],
    );
    const gateLogin = await axios.post(`${API_BASE}/users/auth/login`, {
      email: gateEmail,
      password,
    });
    const gateToken = gateLogin.data?.data?.accessToken || gateLogin.data?.accessToken;
    const gateUserDb = await userPg.query(`SELECT id FROM users WHERE email = $1`, [gateEmail]);
    const gateUserId = gateUserDb.rows[0].id;

    // 1.3 Regular Customer
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Cinema Goer',
      email: customerEmail,
      password,
      country: 'Egypt',
      gender: 'female',
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

    recordTest('1.0', 'User Provisioning (Super Admin, Gate Staff, Customer)', 'PASS', {
      gateEmail,
      gateUserId,
      gateRole: 'gate_checker',
    });

    // -------------------------------------------------------------
    // Step 2: Catalog & Showtime Setup
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Catalog & Showtime Setup ---');
    const movieRes = await axios.post(
      `${API_BASE}/movies`,
      {
        title: `Interstellar 70mm IMAX - ${timestamp}`,
        description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survival.',
        durationMinutes: 169,
        releaseDate: '2026-09-10',
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
        name: `Grand Cinema Complex - ${timestamp}`,
        city: 'Cairo',
        address: 'Downtown Fifth Settlement',
        country: 'EG',
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const cinema = cinemaRes.data?.data || cinemaRes.data;

    const auditoriumRes = await axios.post(
      `${API_BASE}/cinemas/${cinema.id}/auditoriums`,
      {
        name: 'VIP Laser Hall A',
        experienceType: 'VIP_LOUNGE',
        totalRows: 2,
        totalColumns: 4,
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const auditorium = auditoriumRes.data?.data || auditoriumRes.data;

    const seatsRes = await axios.get(`${API_BASE}/seats/auditorium/${auditorium.id}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const seats = seatsRes.data?.data?.seats || seatsRes.data?.seats || [];
    const seat1 = seats[0];
    const seat2 = seats[1];

    const showtimeRes = await axios.post(
      `${API_BASE}/showtimes`,
      {
        movieId: movie.id,
        auditoriumId: auditorium.id,
        startTime: '2026-12-31T21:00:00.000Z',
        endTime: '2026-12-31T23:49:00.000Z',
        experienceType: 'VIP_LOUNGE',
        basePrice: 250,
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const showtime = showtimeRes.data?.data || showtimeRes.data;

    recordTest('2.0', 'Catalog Setup (Movie, Cinema, Auditorium, Showtime)', 'PASS', {
      movieId: movie.id,
      cinemaId: cinema.id,
      auditoriumId: auditorium.id,
      showtimeId: showtime.id,
    });

    // -------------------------------------------------------------
    // Step 3: Booking & Confirmation Flow (Generating JWT Signed Tickets)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Booking & Confirmation Flow ---');
    const holdRes = await axios.post(
      `${API_BASE}/bookings/hold`,
      {
        showtimeId: showtime.id,
        seatIds: [seat1.id, seat2.id],
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );
    const booking = holdRes.data?.data?.booking || holdRes.data?.booking;

    const initRes = await axios.post(
      `${API_BASE}/payments/initiate`,
      {
        bookingId: booking.id,
        amount: 500,
        currency: 'EGP',
        method: 'CARD',
        billingData: {
          first_name: 'Cinema',
          last_name: 'Goer',
          email: customerEmail,
          phone_number: '+201098765432',
          city: 'Cairo',
          country: 'EG',
        },
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );
    const payment = initRes.data?.data || initRes.data;

    const hmacSecret = process.env.PAYMOB_HMAC_SECRET || '7CBCB146CC4997E9906E0DBFBDB50C87';
    const txId = `TX-GATE-${timestamp}`;
    const webhookPayload = {
      type: 'TRANSACTION',
      obj: {
        id: txId,
        pending: false,
        amount_cents: 50000,
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
          shipping_data: {
            email: customerEmail,
            first_name: 'Cinema',
            last_name: 'Goer',
          },
        },
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        owner: 1219314,
        source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
      },
    };

    const validHmac = calculatePaymobHmac(webhookPayload.obj, hmacSecret);
    await axios.post(
      `${API_BASE}/payments/webhook/paymob?hmac=${validHmac}`,
      webhookPayload,
    );

    console.log('   Waiting 4s for Payment Outbox -> Booking Confirmation & Ticket JWT Generation...');
    await sleep(4000);

    // Fetch generated tickets from DB
    const ticketsDbRes = await bookingPg.query(
      `SELECT * FROM tickets WHERE booking_id = $1 ORDER BY created_at ASC`,
      [booking.id],
    );
    const tickets = ticketsDbRes.rows;

    if (tickets.length !== 2) {
      throw new Error(`Expected 2 tickets in DB, found ${tickets.length}`);
    }

    const ticket1 = tickets[0];
    const ticket2 = tickets[1];
    const qrToken1 = ticket1.qr_code_token;

    // Decode token to verify claims
    const decodedJwt = jwt.decode(qrToken1);

    recordTest('3.0', 'Booking Confirmed & JWT-Signed QR Tickets Issued', 'PASS', {
      bookingId: booking.id,
      ticketsCount: tickets.length,
      ticket1Number: ticket1.ticket_number,
      jwtClaims: {
        sub: decodedJwt?.sub,
        bookingId: decodedJwt?.bookingId,
        seatNumber: decodedJwt?.seatNumber,
        type: decodedJwt?.type,
        exp: decodedJwt?.exp,
      },
    });

    // -------------------------------------------------------------
    // Step 4: Happy Path Gate Scan (POST /api/v1/tickets/validate)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Happy Path Gate Check-in Scan ---');
    const scanRes = await axios.post(
      `${API_BASE}/tickets/validate`,
      {
        qrToken: qrToken1,
        gateCinemaId: cinema.id,
        gateAuditoriumId: auditorium.id,
      },
      { headers: { Authorization: `Bearer ${gateToken}` } },
    );

    const scanData = scanRes.data?.data || scanRes.data;

    // Assert DB state updated to USED
    const ticketDbCheck = await bookingPg.query(
      `SELECT * FROM tickets WHERE id = $1`,
      [ticket1.id],
    );
    const updatedTicket = ticketDbCheck.rows[0];

    if (
      scanRes.status === 200 &&
      scanData.valid === true &&
      scanData.status === 'USED' &&
      updatedTicket.status === 'USED' &&
      updatedTicket.used_at !== null &&
      updatedTicket.scanned_by_user_id === gateUserId
    ) {
      recordTest('4.0', 'Happy Path Gate Scan Authorizes Entrance (Status -> USED)', 'PASS', {
        httpStatus: scanRes.status,
        valid: scanData.valid,
        ticketNumber: scanData.ticketNumber,
        status: scanData.status,
        scannedAt: scanData.scannedAt,
        scannedBy: scanData.scannedBy,
        dbStatus: updatedTicket.status,
        dbScannedByUserId: updatedTicket.scanned_by_user_id,
      });
    } else {
      recordTest('4.0', 'Happy Path Gate Scan Authorizes Entrance (Status -> USED)', 'FAIL', {
        scanData,
        updatedTicket,
      });
    }

    // -------------------------------------------------------------
    // Step 5: Double Entrance Guard (Re-scanning Same Ticket)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Double Entrance Guard ---');
    try {
      await axios.post(
        `${API_BASE}/tickets/validate`,
        {
          qrToken: qrToken1,
          gateCinemaId: cinema.id,
          gateAuditoriumId: auditorium.id,
        },
        { headers: { Authorization: `Bearer ${gateToken}` } },
      );
      recordTest('5.0', 'Double Entry Rejection (409 Conflict)', 'FAIL', {
        reason: 'Should have been rejected but received 200 OK',
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 409) {
        recordTest('5.0', 'Double Entry Rejection (409 Conflict)', 'PASS', {
          httpStatus: status,
          errorMessage: message,
        });
      } else {
        recordTest('5.0', 'Double Entry Rejection (409 Conflict)', 'FAIL', {
          httpStatus: status,
          errorMessage: message,
        });
      }
    }

    // -------------------------------------------------------------
    // Step 6: Tamper Prevention (Modified JWT Signature)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Tamper Prevention ---');
    const tamperedToken =
      qrToken1.substring(0, qrToken1.length - 6) + 'XXXXXX';
    try {
      await axios.post(
        `${API_BASE}/tickets/validate`,
        {
          qrToken: tamperedToken,
        },
        { headers: { Authorization: `Bearer ${gateToken}` } },
      );
      recordTest('6.0', 'Tamper Prevention (401 Unauthorized)', 'FAIL', {
        reason: 'Tampered token was accepted',
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 401) {
        recordTest('6.0', 'Tamper Prevention (401 Unauthorized)', 'PASS', {
          httpStatus: status,
          errorMessage: message,
        });
      } else {
        recordTest('6.0', 'Tamper Prevention (401 Unauthorized)', 'FAIL', {
          httpStatus: status,
          errorMessage: message,
        });
      }
    }

    // -------------------------------------------------------------
    // Step 7: Expiration Check (Expired Showtime Token)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Expiration Check ---');
    const jwtSecret =
      process.env.TICKET_JWT_SECRET ||
      process.env.JWT_SECRET ||
      'ticket-jwt-secret-key-12345';

    const expiredTokenPayload = {
      sub: ticket2.id,
      bookingId: booking.id,
      showtimeId: showtime.id,
      cinemaId: cinema.id,
      auditoriumId: auditorium.id,
      seatId: seat2.id,
      seatNumber: 'A-2',
      type: 'TICKET_QR',
      exp: Math.floor(Date.now() / 1000) - 300, // Expired 5 minutes ago
    };
    const expiredToken = jwt.sign(expiredTokenPayload, jwtSecret);

    try {
      await axios.post(
        `${API_BASE}/tickets/validate`,
        {
          qrToken: expiredToken,
        },
        { headers: { Authorization: `Bearer ${gateToken}` } },
      );
      recordTest('7.0', 'Expired Ticket Rejection (400 Bad Request)', 'FAIL', {
        reason: 'Expired token was accepted',
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 400 && message.toLowerCase().includes('expired')) {
        recordTest('7.0', 'Expired Ticket Rejection (400 Bad Request)', 'PASS', {
          httpStatus: status,
          errorMessage: message,
        });
      } else {
        recordTest('7.0', 'Expired Ticket Rejection (400 Bad Request)', 'FAIL', {
          httpStatus: status,
          errorMessage: message,
        });
      }
    }

    // -------------------------------------------------------------
    // Step 8: Contextual Mismatch Guard (Wrong Cinema / Hall)
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Contextual Branch / Hall Guard ---');
    const fakeCinemaId = '00000000-0000-0000-0000-000000000000';
    const qrToken2 = ticket2.qr_code_token;

    try {
      await axios.post(
        `${API_BASE}/tickets/validate`,
        {
          qrToken: qrToken2,
          gateCinemaId: fakeCinemaId,
        },
        { headers: { Authorization: `Bearer ${gateToken}` } },
      );
      recordTest('8.0', 'Contextual Cinema Branch Mismatch Rejection (400 Bad Request)', 'FAIL', {
        reason: 'Mismatched cinema branch was accepted',
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 400 && message.toLowerCase().includes('wrong cinema')) {
        recordTest('8.0', 'Contextual Cinema Branch Mismatch Rejection (400 Bad Request)', 'PASS', {
          httpStatus: status,
          errorMessage: message,
        });
      } else {
        recordTest('8.0', 'Contextual Cinema Branch Mismatch Rejection (400 Bad Request)', 'FAIL', {
          httpStatus: status,
          errorMessage: message,
        });
      }
    }

    // -------------------------------------------------------------
    // Step 9: RBAC Guard Check (Regular Customer Unauthorized)
    // -------------------------------------------------------------
    console.log('\n--- Step 9: RBAC Guard Check ---');
    try {
      await axios.post(
        `${API_BASE}/tickets/validate`,
        {
          qrToken: qrToken2,
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      recordTest('9.0', 'RBAC Guard Denies Access to Non-Staff Customer (403 Forbidden)', 'FAIL', {
        reason: 'Regular customer was allowed to scan tickets',
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 403) {
        recordTest('9.0', 'RBAC Guard Denies Access to Non-Staff Customer (403 Forbidden)', 'PASS', {
          httpStatus: status,
          errorMessage: message,
        });
      } else {
        recordTest('9.0', 'RBAC Guard Denies Access to Non-Staff Customer (403 Forbidden)', 'FAIL', {
          httpStatus: status,
          errorMessage: message,
        });
      }
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
    await redis.quit();
  }

  // -------------------------------------------------------------
  // Summary Matrix
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 GATE CHECK-IN & TICKET VALIDATION MATRIX');
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
    console.log('🎉 ALL GATE CHECK-IN & TICKET VALIDATION TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runTicketValidationFlowTest();
