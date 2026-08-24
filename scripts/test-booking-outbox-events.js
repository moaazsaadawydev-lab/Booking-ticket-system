const axios = require('axios');
const { Client: PgClient } = require('pg');
const { execSync } = require('child_process');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

const testResults = [];

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

  if (!headers['Content-Type']) {
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

function getRedisOtp(email) {
  try {
    const out = execSync(`docker exec redis redis-cli GET "otp:verify-email:${email}"`, {
      encoding: 'utf-8',
    });
    return out.replace(/[\r\n"]/g, '').trim();
  } catch (e) {
    return '';
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOutboxVerificationTest() {
  console.log('========================================================================');
  console.log('📬 Starting Transactional Outbox Worker & Notifications Integration Test');
  console.log('========================================================================\n');

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

  const password = 'Password123!';

  // -------------------------------------------------------------
  // Step 1: User & Catalog Setup
  // -------------------------------------------------------------
  console.log('--- Step 1: Provisioning Users & Catalog ---');

  // Super Admin
  const superAdminEmail = 'super.outbox@test.com';
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
  const superOtp = getRedisOtp(superAdminEmail);
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
  const cinemaAdminEmail = 'cinema.outbox@test.com';
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
  const cinemaOtp = getRedisOtp(cinemaAdminEmail);
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
  const customerEmail = 'customer.outbox@test.com';
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Outbox Customer',
      email: customerEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    },
  });
  const customerOtp = getRedisOtp(customerEmail);
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
      title: `Outbox Movie ${Date.now().toString().slice(-4)}`,
      description: 'Testing transactional outbox publishing and notifications.',
      durationMinutes: 135,
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
      name: `Outbox Cinema ${Date.now().toString().slice(-4)}`,
      city: 'Cairo',
      address: 'Tagamoa, Cairo',
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
      name: 'Outbox Hall 1',
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
  const seatA1 = seatsList[0];
  const seatA2 = seatsList[1];
  const seatB1 = seatsList[6];

  // 1.5 Schedule Showtime
  const createShowtimeRes = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      movieId,
      auditoriumId,
      startTime: '2026-12-22T18:00:00.000Z',
      endTime: '2026-12-22T20:30:00.000Z',
      experienceType: 'STANDARD_2D',
      basePrice: 100,
    },
  });
  const showtimeId =
    createShowtimeRes.data?.data?.id || createShowtimeRes.data?.id;

  console.log(`✅ Setup Completed: Showtime ID ${showtimeId}\n`);

  // -------------------------------------------------------------
  // Step 2: Trigger Booking Hold & Verify Outbox Event
  // -------------------------------------------------------------
  console.log('--- Step 2: Triggering Booking Hold ---');

  const holdRes = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      showtimeId,
      seatIds: [seatA1.id, seatA2.id],
    },
  });

  const holdPayload = holdRes.data?.data || holdRes.data;
  const booking1 = holdPayload?.booking || holdPayload;
  const booking1Id = booking1?.id;

  console.log(`   Held Booking ID: ${booking1Id} (Reference: ${booking1?.booking_reference || booking1?.bookingReference})`);

  // Wait 2.5 seconds for outbox worker to poll and publish
  console.log('   Waiting 3s for Outbox Worker to publish...');
  await sleep(3000);

  // 2.1 Verify booking_outbox in Booking-Bookings database
  const outboxHoldRes = await pgBookingsClient.query(
    `SELECT id, event_type, status, retry_count, published_at, payload
     FROM booking_outbox
     WHERE payload->>'bookingId' = $1 AND event_type = 'booking.hold.created'`,
    [booking1Id],
  );

  const holdOutboxRecord = outboxHoldRes.rows[0];
  const holdOutboxPassed =
    !!holdOutboxRecord &&
    holdOutboxRecord.event_type === 'booking.hold.created' &&
    holdOutboxRecord.status === 'PUBLISHED' &&
    !!holdOutboxRecord.published_at;

  recordResult(
    '2.1',
    'Booking Hold Outbox Event Generated & Published',
    holdOutboxPassed,
    {
      eventId: holdOutboxRecord?.id,
      eventType: holdOutboxRecord?.event_type,
      status: holdOutboxRecord?.status,
      publishedAt: holdOutboxRecord?.published_at,
    },
  );

  // 2.2 Verify notification created in Booking-Notification database
  const notifHoldRes = await pgNotificationsClient.query(
    `SELECT id, "userId", title, body, type, "sourceEventId"
     FROM notifications
     WHERE "sourceEventId" = $1`,
    [holdOutboxRecord?.id],
  );

  const holdNotification = notifHoldRes.rows[0];
  const holdNotificationPassed =
    !!holdNotification &&
    holdNotification.title === 'Seats Held Successfully' &&
    holdNotification.body.includes(booking1?.booking_reference || booking1?.bookingReference);

  recordResult(
    '2.2',
    'Notifications Service Processed booking.hold.created Event',
    holdNotificationPassed,
    {
      notificationId: holdNotification?.id,
      title: holdNotification?.title,
      body: holdNotification?.body,
      sourceEventId: holdNotification?.sourceEventId,
    },
  );

  // -------------------------------------------------------------
  // Step 3: Trigger Booking Confirmation & Verify Outbox Event
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Triggering Booking Confirmation ---');

  const confirmRes = await request(`/bookings/${booking1Id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: { paymentId: 'b1111111-2222-3333-4444-555555555555' },
  });

  console.log('   Waiting 3s for Outbox Worker to publish confirmation event...');
  await sleep(3000);

  // 3.1 Verify booking_outbox for booking.confirmed
  const outboxConfirmRes = await pgBookingsClient.query(
    `SELECT id, event_type, status, retry_count, published_at, payload
     FROM booking_outbox
     WHERE payload->>'bookingId' = $1 AND event_type = 'booking.confirmed'`,
    [booking1Id],
  );

  const confirmOutboxRecord = outboxConfirmRes.rows[0];
  const confirmOutboxPassed =
    !!confirmOutboxRecord &&
    confirmOutboxRecord.event_type === 'booking.confirmed' &&
    confirmOutboxRecord.status === 'PUBLISHED' &&
    !!confirmOutboxRecord.published_at;

  recordResult(
    '3.1',
    'Booking Confirmed Outbox Event Generated & Published',
    confirmOutboxPassed,
    {
      eventId: confirmOutboxRecord?.id,
      eventType: confirmOutboxRecord?.event_type,
      status: confirmOutboxRecord?.status,
      publishedAt: confirmOutboxRecord?.published_at,
    },
  );

  // 3.2 Verify notification created for confirmed booking
  const notifConfirmRes = await pgNotificationsClient.query(
    `SELECT id, "userId", title, body, type, "sourceEventId"
     FROM notifications
     WHERE "sourceEventId" = $1`,
    [confirmOutboxRecord?.id],
  );

  const confirmNotification = notifConfirmRes.rows[0];
  const confirmNotificationPassed =
    !!confirmNotification &&
    confirmNotification.title === 'Booking Confirmed!';

  recordResult(
    '3.2',
    'Notifications Service Processed booking.confirmed Event',
    confirmNotificationPassed,
    {
      notificationId: confirmNotification?.id,
      title: confirmNotification?.title,
      body: confirmNotification?.body,
    },
  );

  // -------------------------------------------------------------
  // Step 4: Trigger Booking Cancellation & Verify Outbox Event
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Triggering Booking Cancellation ---');

  // Hold a different seat for cancellation test
  const holdForCancelRes = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      showtimeId,
      seatIds: [seatB1.id],
    },
  });
  const booking2Id =
    holdForCancelRes.data?.data?.booking?.id ||
    holdForCancelRes.data?.booking?.id;

  const cancelRes = await request(`/bookings/${booking2Id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: { reason: 'User requested refund/cancellation' },
  });

  console.log('   Waiting 3s for Outbox Worker to publish cancellation event...');
  await sleep(3000);

  // 4.1 Verify booking_outbox for booking.cancelled
  const outboxCancelRes = await pgBookingsClient.query(
    `SELECT id, event_type, status, retry_count, published_at, payload
     FROM booking_outbox
     WHERE payload->>'bookingId' = $1 AND event_type = 'booking.cancelled'`,
    [booking2Id],
  );

  const cancelOutboxRecord = outboxCancelRes.rows[0];
  const cancelOutboxPassed =
    !!cancelOutboxRecord &&
    cancelOutboxRecord.event_type === 'booking.cancelled' &&
    cancelOutboxRecord.status === 'PUBLISHED' &&
    !!cancelOutboxRecord.published_at;

  recordResult(
    '4.1',
    'Booking Cancelled Outbox Event Generated & Published',
    cancelOutboxPassed,
    {
      eventId: cancelOutboxRecord?.id,
      eventType: cancelOutboxRecord?.event_type,
      status: cancelOutboxRecord?.status,
      publishedAt: cancelOutboxRecord?.published_at,
    },
  );

  // 4.2 Verify notification created for cancelled booking
  const notifCancelRes = await pgNotificationsClient.query(
    `SELECT id, "userId", title, body, type, "sourceEventId"
     FROM notifications
     WHERE "sourceEventId" = $1`,
    [cancelOutboxRecord?.id],
  );

  const cancelNotification = notifCancelRes.rows[0];
  const cancelNotificationPassed =
    !!cancelNotification &&
    cancelNotification.title === 'Booking Cancelled';

  recordResult(
    '4.2',
    'Notifications Service Processed booking.cancelled Event',
    cancelNotificationPassed,
    {
      notificationId: cancelNotification?.id,
      title: cancelNotification?.title,
      body: cancelNotification?.body,
    },
  );

  await pgUsersClient.end();
  await pgBookingsClient.end();
  await pgNotificationsClient.end();

  // -------------------------------------------------------------
  // Summary Table
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('📊 OUTBOX & NOTIFICATIONS INTEGRATION SUMMARY');
  console.log('========================================================================');

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
    console.log('🎉 ALL TRANSACTIONAL OUTBOX & NOTIFICATION INTEGRATION TESTS PASSED (100%)!\n');
  } else {
    console.log('❌ SOME OUTBOX TESTS FAILED.\n');
    process.exit(1);
  }
}

runOutboxVerificationTest().catch((err) => {
  console.error('Fatal Error in Outbox Verification:', err);
  process.exit(1);
});
