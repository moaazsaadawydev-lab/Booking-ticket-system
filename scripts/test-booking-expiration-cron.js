const axios = require('axios');
const { Client: PgClient } = require('pg');
const Redis = require('ioredis');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

const testResults = [];
let redisClient;

function recordResult(step, name, passed, details = {}) {
  const statusStr = passed ? 'PASS' : 'FAIL';
  testResults.push({ step, name, status: statusStr, details });
  console.log(`[${statusStr}] Step ${step}: ${name}`);
  if (details && Object.keys(details).length > 0) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function request(endpoint, options = {}) {
  const url = `${GATEWAY_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    ...(options.headers || {}),
  };

  if (!headers['Content-Type'] && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await axios({
      method,
      url,
      data: options.data || options.body,
      headers,
      validateStatus: () => true,
    });
    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (err) {
    return {
      status: err.response?.status || 500,
      data: err.response?.data || { message: err.message },
      headers: err.response?.headers || {},
    };
  }
}

async function getRedisOtp(email) {
  try {
    const val = await redisClient.get(`otp:verify-email:${email}`);
    return val ? val.trim() : '';
  } catch (e) {
    return '';
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runExpirationTest() {
  console.log('=================================================================================');
  console.log('⏰ Booking Microservice: Automatic Hold Expiration Cron Job Verification');
  console.log('=================================================================================\n');

  const pgUsersClient = new PgClient({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'Booking-Users',
  });
  await pgUsersClient.connect();

  const pgBookingsClient = new PgClient({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'Booking-Bookings',
  });
  await pgBookingsClient.connect();

  const pgNotificationsClient = new PgClient({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'Booking-Notification',
  });
  await pgNotificationsClient.connect();

  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  });

  const password = 'Password123!';

  // -------------------------------------------------------------
  // Step 1: User & Catalog Setup
  // -------------------------------------------------------------
  console.log('--- Step 1: User & Catalog Setup ---');

  // Super Admin
  const superAdminEmail = 'super.expire@test.com';
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Super Admin',
      email: superAdminEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    },
  });
  const superOtp = await getRedisOtp(superAdminEmail);
  if (superOtp) {
    await request('/users/auth/verify-email', {
      method: 'POST',
      body: { email: superAdminEmail, code: superOtp },
    });
  }
  await pgUsersClient.query(
    `UPDATE users SET role = 'super_admin', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
    [superAdminEmail],
  );
  const superLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: superAdminEmail, password },
  });
  const superAdminToken =
    superLoginRes.data?.data?.accessToken || superLoginRes.data?.accessToken;

  // Cinema Admin
  const cinemaAdminEmail = 'cinema.expire@test.com';
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Cinema Admin',
      email: cinemaAdminEmail,
      password,
      country: 'Egypt',
      gender: 'female',
    },
  });
  const cinemaOtp = await getRedisOtp(cinemaAdminEmail);
  if (cinemaOtp) {
    await request('/users/auth/verify-email', {
      method: 'POST',
      body: { email: cinemaAdminEmail, code: cinemaOtp },
    });
  }
  const cinemaAdminDb = await pgUsersClient.query(
    `UPDATE users SET role = 'cinema_admin', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1 RETURNING id`,
    [cinemaAdminEmail],
  );
  const cinemaAdminId = cinemaAdminDb.rows[0]?.id;
  const cinemaLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: cinemaAdminEmail, password },
  });
  const cinemaAdminToken =
    cinemaLoginRes.data?.data?.accessToken || cinemaLoginRes.data?.accessToken;

  // Customer User
  const customerEmail = 'customer.expire@test.com';
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Expire Customer',
      email: customerEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    },
  });
  const customerOtp = await getRedisOtp(customerEmail);
  if (customerOtp) {
    await request('/users/auth/verify-email', {
      method: 'POST',
      body: { email: customerEmail, code: customerOtp },
    });
  }
  await pgUsersClient.query(
    `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
    [customerEmail],
  );
  const customerLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: customerEmail, password },
  });
  const customerToken =
    customerLoginRes.data?.data?.accessToken || customerLoginRes.data?.accessToken;
  const customerUserId =
    customerLoginRes.data?.data?.user?.id || customerLoginRes.data?.user?.id;

  // 1.1 Create Movie
  const createMovieRes = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      title: `Expiration Movie ${Date.now().toString().slice(-4)}`,
      description: 'Testing automatic seat hold expiration cron.',
      durationMinutes: 110,
      releaseDate: '2026-08-01',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
      spokenLanguages: ['en'],
      subtitles: ['ar'],
      posterUrl: 'https://image.tmdb.org/t/p/w500/sample.jpg',
      trailerUrl: 'https://www.youtube.com/watch?v=sample',
    },
  });
  const movieId = createMovieRes.data?.data?.id || createMovieRes.data?.id;

  // 1.2 Create Cinema Branch
  const createCinemaRes = await request('/cinemas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: `Expire Cinema ${Date.now().toString().slice(-4)}`,
      city: 'Cairo',
      address: 'Heliopolis, Cairo',
      country: 'EG',
      adminUserIds: [cinemaAdminId],
    },
  });
  const cinemaId = createCinemaRes.data?.data?.id || createCinemaRes.data?.id;

  // 1.3 Create Auditorium
  const createAuditoriumRes = await request(`/cinemas/${cinemaId}/auditoriums`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      name: 'Hall Expire-1',
      experienceType: 'STANDARD_2D',
      totalRows: 4,
      totalColumns: 6,
    },
  });
  const auditoriumId =
    createAuditoriumRes.data?.data?.id || createAuditoriumRes.data?.id;

  // 1.4 Fetch Auditorium Seats
  const getSeatsRes = await request(`/seats/auditorium/${auditoriumId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
  });
  const seatsList = getSeatsRes.data?.data?.seats || getSeatsRes.data?.seats || [];
  const targetSeat = seatsList[0];
  const targetSeatId = targetSeat.id;

  // 1.5 Schedule Showtime
  const createShowtimeRes = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      movieId,
      auditoriumId,
      startTime: '2026-12-30T19:00:00.000Z',
      endTime: '2026-12-30T21:00:00.000Z',
      experienceType: 'STANDARD_2D',
      basePrice: 120,
    },
  });
  const showtimeId =
    createShowtimeRes.data?.data?.id || createShowtimeRes.data?.id;

  console.log(`✅ Setup Completed: Showtime ID ${showtimeId}, Target Seat: ${targetSeat.row_label}-${targetSeat.seat_number} (${targetSeatId})\n`);

  // -------------------------------------------------------------
  // Step 2: Hold Seat & Verify Redis Lock
  // -------------------------------------------------------------
  console.log('--- Step 2: Hold Seat & Verify Initial Hold ---');

  const holdRes = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      showtimeId,
      seatIds: [targetSeatId],
    },
  });

  const booking = holdRes.data?.data?.booking || holdRes.data?.booking;
  const bookingId = booking?.id;
  const bookingRef = booking?.booking_reference || booking?.bookingReference;

  // Verify Redis Lock key exists
  const redisLockKey = `booking:lock:${showtimeId}:${targetSeatId}`;
  const initialLockOwner = await redisClient.get(redisLockKey);

  const initialHoldPassed =
    holdRes.status === 201 &&
    booking?.status === 'PENDING_PAYMENT' &&
    !!initialLockOwner;

  recordResult('2.1', 'Seat Successfully Held & Redis Lock Acquired', initialHoldPassed, {
    bookingId,
    bookingRef,
    status: booking?.status,
    redisKey: redisLockKey,
    lockOwnerUserId: initialLockOwner,
  });

  // -------------------------------------------------------------
  // Step 3: Simulate Expired Hold & Wait for Background Cron Cycle
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Simulating Hold Expiration in Database ---');

  await pgBookingsClient.query(
    `UPDATE bookings 
     SET hold_expires_at = NOW() - INTERVAL '5 seconds' 
     WHERE id = $1`,
    [bookingId],
  );

  console.log('   Updated hold_expires_at to past timestamp.');
  console.log('   Waiting 12s for BookingExpirationService cron to detect and clean up hold...');
  await sleep(12000);

  // -------------------------------------------------------------
  // Step 4: Verify Expiration State Transitions & Cleanup
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Verify Expiration Assertions ---');

  // 4.1 PostgreSQL Booking Status check
  const dbBookingRes = await pgBookingsClient.query(
    `SELECT id, status, booking_reference, hold_expires_at 
     FROM bookings 
     WHERE id = $1`,
    [bookingId],
  );
  const updatedBooking = dbBookingRes.rows[0];
  const dbExpiredPassed =
    !!updatedBooking && updatedBooking.status === 'EXPIRED';

  recordResult('4.1', 'PostgreSQL Booking Status Transitioned to EXPIRED', dbExpiredPassed, {
    bookingId,
    status: updatedBooking?.status,
    holdExpiresAt: updatedBooking?.hold_expires_at,
  });

  // 4.2 Outbox Event check for booking.expired
  const outboxRes = await pgBookingsClient.query(
    `SELECT id, event_type, status, published_at, payload 
     FROM booking_outbox 
     WHERE payload->>'bookingId' = $1 AND event_type = 'booking.expired'`,
    [bookingId],
  );
  const expiredOutbox = outboxRes.rows[0];
  const outboxExpiredPassed =
    !!expiredOutbox &&
    expiredOutbox.event_type === 'booking.expired' &&
    expiredOutbox.status === 'PUBLISHED';

  recordResult('4.2', 'booking.expired Event Inserted & Published to RabbitMQ', outboxExpiredPassed, {
    eventId: expiredOutbox?.id,
    eventType: expiredOutbox?.event_type,
    outboxStatus: expiredOutbox?.status,
    publishedAt: expiredOutbox?.published_at,
  });

  // 4.3 Redis Lock Cleanup check
  const remainingLock = await redisClient.get(redisLockKey);
  const redisFreedPassed = remainingLock === null;

  recordResult('4.3', 'Lingering Redis Distributed Lock Key Released', redisFreedPassed, {
    redisKey: redisLockKey,
    remainingValue: remainingLock,
  });

  // 4.4 Notifications Consumer check
  const notifRes = await pgNotificationsClient.query(
    `SELECT id, "userId", title, body, "sourceEventId" 
     FROM notifications 
     WHERE "sourceEventId" = $1`,
    [expiredOutbox?.id],
  );
  const notifRecord = notifRes.rows[0];
  const notificationPassed =
    !!notifRecord && notifRecord.title === 'Seat Hold Expired';

  recordResult('4.4', 'Notifications Service Processed booking.expired Event', notificationPassed, {
    notificationId: notifRecord?.id,
    title: notifRecord?.title,
    body: notifRecord?.body,
  });

  // 4.5 Immediate Re-Hold Capability check
  console.log('\n--- Step 5: Test Immediate Re-Hold on Released Seat ---');
  const reholdRes = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      showtimeId,
      seatIds: [targetSeatId],
    },
  });

  const reholdBooking = reholdRes.data?.data?.booking || reholdRes.data?.booking;
  const reholdPassed =
    reholdRes.status === 201 &&
    reholdBooking?.status === 'PENDING_PAYMENT' &&
    reholdBooking?.id !== bookingId;

  recordResult('5.1', 'Released Seat Re-Held Successfully (201 Created)', reholdPassed, {
    newBookingId: reholdBooking?.id,
    newBookingRef: reholdBooking?.booking_reference || reholdBooking?.bookingReference,
    status: reholdBooking?.status,
  });

  await pgUsersClient.end();
  await pgBookingsClient.end();
  await pgNotificationsClient.end();
  await redisClient.quit();

  // -------------------------------------------------------------
  // Summary Table
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 EXPIRATION CRON VERIFICATION SUMMARY');
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
    console.log('🎉 ALL AUTOMATIC HOLD EXPIRATION CRON TESTS PASSED (100%)!\n');
  } else {
    console.log('❌ SOME EXPIRATION TESTS FAILED.\n');
    process.exit(1);
  }
}

runExpirationTest().catch((err) => {
  console.error('Fatal Error in Expiration Test:', err);
  process.exit(1);
});
