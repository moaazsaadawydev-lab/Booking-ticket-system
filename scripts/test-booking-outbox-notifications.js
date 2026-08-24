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
      responseType: options.responseType || 'json',
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

async function runTest() {
  console.log('=================================================================================');
  console.log('🎟️ Booking & Notifications: Transactional Outbox Pipeline & QR Ticket Delivery');
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
  const superAdminEmail = 'super.qr@test.com';
  console.log('   Registering Super Admin...');
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
  console.log('   Retrieving OTP for Super Admin...');
  const superOtp = await getRedisOtp(superAdminEmail);
  if (superOtp) {
    console.log('   Verifying email for Super Admin...');
    await request('/users/auth/verify-email', {
      method: 'POST',
      body: { email: superAdminEmail, code: superOtp },
    });
  }
  console.log('   Updating Super Admin role in DB...');
  await pgUsersClient.query(
    `UPDATE users SET role = 'super_admin', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
    [superAdminEmail],
  );
  console.log('   Logging in Super Admin...');
  const superLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: superAdminEmail, password },
  });
  const superAdminToken =
    superLoginRes.data?.data?.accessToken || superLoginRes.data?.accessToken;
  console.log('   Super Admin Token obtained:', !!superAdminToken);

  // Cinema Admin
  const cinemaAdminEmail = 'cinema.qr@test.com';
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
  const customerEmail = 'customer.qr@test.com';
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'QR Customer',
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
      title: `QR Test Movie ${Date.now().toString().slice(-4)}`,
      description: 'Validating in-memory QR code generation and outbox notifications.',
      durationMinutes: 140,
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
      name: `QR Cinema ${Date.now().toString().slice(-4)}`,
      city: 'Cairo',
      address: 'New Cairo, Egypt',
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
      name: 'Hall QR-1',
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
  const seat1 = seatsList[0];
  const seat2 = seatsList[1];

  // 1.5 Schedule Showtime
  const createShowtimeRes = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      movieId,
      auditoriumId,
      startTime: '2026-12-25T20:00:00.000Z',
      endTime: '2026-12-25T22:30:00.000Z',
      experienceType: 'STANDARD_2D',
      basePrice: 150,
    },
  });
  const showtimeId =
    createShowtimeRes.data?.data?.id || createShowtimeRes.data?.id;

  console.log(`✅ Setup Completed: Showtime ID ${showtimeId}\n`);

  // -------------------------------------------------------------
  // Step 2: Hold Seats & Verify Outbox
  // -------------------------------------------------------------
  console.log('--- Step 2: Hold Seats & Outbox Event ---');

  const holdRes = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      showtimeId,
      seatIds: [seat1.id, seat2.id],
    },
  });

  const booking = holdRes.data?.data?.booking || holdRes.data?.booking;
  const bookingId = booking?.id;

  console.log('   Waiting 3s for Outbox Worker to publish...');
  await sleep(3000);

  const holdOutboxDb = await pgBookingsClient.query(
    `SELECT id, event_type, status, published_at FROM booking_outbox WHERE payload->>'bookingId' = $1 AND event_type = 'booking.hold.created'`,
    [bookingId],
  );
  const holdRecord = holdOutboxDb.rows[0];
  const holdPassed = !!holdRecord && holdRecord.status === 'PUBLISHED';

  recordResult('2.1', 'Hold Seats & Outbox Published (booking.hold.created)', holdPassed, {
    bookingId,
    eventId: holdRecord?.id,
    status: holdRecord?.status,
    publishedAt: holdRecord?.published_at,
  });

  // -------------------------------------------------------------
  // Step 3: Confirm Booking & Validate Ticket QR Payload
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Confirm Booking & Outbox Ticket Payload ---');

  const confirmRes = await request(`/bookings/${bookingId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: { paymentId: '99999999-8888-4777-a666-555555555555' },
  });

  const confirmedBooking = confirmRes.data?.data?.booking || confirmRes.data?.booking;
  const tickets = confirmedBooking?.tickets || [];
  const firstTicket = tickets[0];

  console.log('   Waiting 3s for Outbox Worker to publish confirmation...');
  await sleep(3000);

  const confirmOutboxDb = await pgBookingsClient.query(
    `SELECT id, event_type, status, published_at, payload FROM booking_outbox WHERE payload->>'bookingId' = $1 AND event_type = 'booking.confirmed'`,
    [bookingId],
  );
  const confirmRecord = confirmOutboxDb.rows[0];
  const ticketsInPayload = confirmRecord?.payload?.tickets || [];
  const confirmPassed =
    !!confirmRecord &&
    confirmRecord.status === 'PUBLISHED' &&
    ticketsInPayload.length === 2 &&
    !!ticketsInPayload[0].qrCodeToken;

  recordResult('3.1', 'Booking Confirmed with Complete Ticket QR Payload', confirmPassed, {
    bookingId,
    eventId: confirmRecord?.id,
    status: confirmRecord?.status,
    ticketsCount: ticketsInPayload.length,
    firstTicketQrToken: ticketsInPayload[0]?.qrCodeToken?.slice(0, 16) + '...',
  });

  // -------------------------------------------------------------
  // Step 4: Verify Notifications Service Processed Event & Generated QR
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Verify Notifications Service ---');

  const notifDb = await pgNotificationsClient.query(
    `SELECT id, title, body, "sourceEventId" FROM notifications WHERE "sourceEventId" = $1`,
    [confirmRecord?.id],
  );
  const notifRecord = notifDb.rows[0];
  const notifPassed =
    !!notifRecord && notifRecord.title === 'Booking Confirmed!';

  recordResult('4.1', 'Notifications Service Processed Event & Issued QR Alerts', notifPassed, {
    notificationId: notifRecord?.id,
    title: notifRecord?.title,
    body: notifRecord?.body,
  });

  // -------------------------------------------------------------
  // Step 5: Test API Gateway On-The-Fly QR Endpoint (GET /api/v1/tickets/:id/qr-code)
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Test On-The-Fly Ticket QR Code Endpoint ---');
  console.log(`   Fetching QR code for Ticket ID: ${firstTicket?.id}`);

  const qrResponse = await request(`/tickets/${firstTicket?.id}/qr-code`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerToken}` },
    responseType: 'arraybuffer',
  });

  const contentType = qrResponse.headers['content-type'];
  const cacheControl = qrResponse.headers['cache-control'];
  const bufferLength = Buffer.isBuffer(qrResponse.data)
    ? qrResponse.data.length
    : Buffer.from(qrResponse.data).length;

  const isPng = contentType === 'image/png';
  const hasCacheControl = cacheControl?.includes('public');
  const hasValidLength = bufferLength > 100; // valid PNG QR is > 100 bytes

  const qrEndpointPassed =
    qrResponse.status === 200 && isPng && hasCacheControl && hasValidLength;

  recordResult('5.1', 'GET /api/v1/tickets/:id/qr-code returns valid image/png Buffer', qrEndpointPassed, {
    status: qrResponse.status,
    contentType,
    cacheControl,
    bufferSizeBytes: bufferLength,
    isPngHeader: isPng,
  });

  // 5.2 Test Access Control: Unauthorized customer cannot access another user's ticket QR
  console.log('\n--- Step 5.2: Test Access Control Security on QR Endpoint ---');
  const otherUserEmail = 'other.user.qr@test.com';
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Other User',
      email: otherUserEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    },
  });
  const otherOtp = await getRedisOtp(otherUserEmail);
  if (otherOtp) {
    await request('/users/auth/verify-email', {
      method: 'POST',
      body: { email: otherUserEmail, code: otherOtp },
    });
  }
  await pgUsersClient.query(
    `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
    [otherUserEmail],
  );
  const otherLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: otherUserEmail, password },
  });
  const otherUserToken =
    otherLoginRes.data?.data?.accessToken || otherLoginRes.data?.accessToken;

  const forbiddenQrRes = await request(`/tickets/${firstTicket?.id}/qr-code`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${otherUserToken}` },
  });

  const accessControlPassed =
    forbiddenQrRes.status === 403 || forbiddenQrRes.status === 404;

  recordResult('5.2', 'Ticket QR Access Control Rejects Unauthorized Users (403/404)', accessControlPassed, {
    status: forbiddenQrRes.status,
  });

  await pgUsersClient.end();
  await pgBookingsClient.end();
  await pgNotificationsClient.end();
  await redisClient.quit();

  // -------------------------------------------------------------
  // Summary Table
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 TEST SUMMARY & VERIFICATION MATRIX');
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
    console.log('🎉 ALL OUTBOX PIPELINE & QR TICKET DELIVERY TESTS PASSED (100%)!\n');
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Fatal Error in Test Execution:', err);
  process.exit(1);
});
