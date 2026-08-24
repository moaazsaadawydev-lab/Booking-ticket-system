const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Client: PgClient } = require('pg');
const { execSync } = require('child_process');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

const testResults = [];

function recordResult(step, name, passed, httpStatus, details = {}) {
  const statusStr = passed ? 'PASS' : 'FAIL';
  testResults.push({ step, name, status: statusStr, httpStatus, details });
  console.log(`[${statusStr}] Step ${step}: ${name} (Status: ${httpStatus || 'N/A'})`);
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

  if (!headers['Content-Type'] && !(options.data instanceof (global.FormData || Object))) {
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

async function runBookingE2EFlow() {
  console.log('===============================================================');
  console.log('🎟️ Starting End-to-End Booking Flow & Full Lifecycle Verification');
  console.log('===============================================================\n');

  const pgClient = new PgClient({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'Booking-Users',
  });

  await pgClient.connect();

  const password = 'Password123!';

  // =============================================================
  // Step 1: User Provisioning & Authentication
  // =============================================================
  console.log('\n--- Step 1: User Provisioning & Authentication ---');

  // 1.1 Super Admin Setup
  const superAdminEmail = 'admin.booking@test.com';
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

  await pgClient.query(
    `UPDATE users SET role = 'super_admin', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
    [superAdminEmail],
  );

  const superLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: superAdminEmail, password },
  });

  const superAdminToken =
    superLoginRes.data?.data?.accessToken ||
    superLoginRes.data?.accessToken;

  const superAdminPassed = superLoginRes.status === 200 && !!superAdminToken;
  recordResult(
    '1.1',
    'Authenticate Super Admin',
    superAdminPassed,
    superLoginRes.status,
    { email: superAdminEmail, hasToken: !!superAdminToken },
  );

  // 1.2 Cinema Admin Setup
  const cinemaAdminEmail = 'branch.admin@test.com';
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Branch Admin',
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

  const cinemaUserDb = await pgClient.query(
    `UPDATE users SET role = 'cinema_admin', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1 RETURNING id`,
    [cinemaAdminEmail],
  );
  const cinemaAdminId = cinemaUserDb.rows[0]?.id;

  const cinemaLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: cinemaAdminEmail, password },
  });

  const cinemaAdminToken =
    cinemaLoginRes.data?.data?.accessToken ||
    cinemaLoginRes.data?.accessToken;

  const cinemaAdminPassed =
    cinemaLoginRes.status === 200 && !!cinemaAdminToken && !!cinemaAdminId;
  recordResult(
    '1.2',
    'Authenticate Cinema Admin & Extract UUID',
    cinemaAdminPassed,
    cinemaLoginRes.status,
    { email: cinemaAdminEmail, cinemaAdminId, hasToken: !!cinemaAdminToken },
  );

  // 1.3 Customer User Setup
  const customerEmail = 'customer.jane@test.com';
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Jane Doe',
      email: customerEmail,
      password,
      country: 'Egypt',
      gender: 'female',
    },
  });

  const customerOtp = getRedisOtp(customerEmail);
  if (customerOtp) {
    await request('/users/auth/verify-email', {
      method: 'POST',
      body: { email: customerEmail, code: customerOtp },
    });
  }

  await pgClient.query(
    `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
    [customerEmail],
  );

  const customerLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: customerEmail, password },
  });

  const customerToken =
    customerLoginRes.data?.data?.accessToken ||
    customerLoginRes.data?.accessToken;

  const customerPassed = customerLoginRes.status === 200 && !!customerToken;
  recordResult(
    '1.3',
    'Authenticate Customer User',
    customerPassed,
    customerLoginRes.status,
    { email: customerEmail, hasToken: !!customerToken },
  );

  await pgClient.end();

  // =============================================================
  // Step 2: Catalog Setup (Super Admin & Cinema Admin)
  // =============================================================
  console.log('\n--- Step 2: Catalog Setup ---');

  // 2.1 Create Movie
  const createMovieRes = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      title: 'Inception',
      description: 'A thief who steals corporate secrets through dream-sharing technology.',
      durationMinutes: 148,
      releaseDate: '2010-07-16',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
      spokenLanguages: ['en', 'ja', 'fr'],
      subtitles: ['ar', 'en'],
      posterUrl: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
      bannerUrl: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
      trailerUrl: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
      directors: ['Christopher Nolan'],
      cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page'],
    },
  });

  const movieData = createMovieRes.data?.data || createMovieRes.data;
  const movieId = movieData?.id;
  const moviePassed =
    (createMovieRes.status === 201 || createMovieRes.status === 200) && !!movieId;
  recordResult(
    '2.1',
    'Create Movie (Inception)',
    moviePassed,
    createMovieRes.status,
    { movieId, title: movieData?.title, trailerUrl: movieData?.trailer_url || movieData?.trailerUrl },
  );

  // 2.2 Create Cinema Branch
  const createCinemaRes = await request('/cinemas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'Grand Plaza Cinema - Tagamoa',
      city: 'Cairo',
      address: 'Fifth Settlement, Tagamoa, New Cairo',
      country: 'EG',
      facilities: ['Parking', 'Dolby Atmos', 'VIP Lounge'],
      adminUserIds: [cinemaAdminId],
    },
  });

  const cinemaData = createCinemaRes.data?.data || createCinemaRes.data;
  const cinemaId = cinemaData?.id;
  const cinemaCreatedPassed =
    (createCinemaRes.status === 201 || createCinemaRes.status === 200) && !!cinemaId;
  recordResult(
    '2.2',
    'Create Cinema Branch & Assign Admin',
    cinemaCreatedPassed,
    createCinemaRes.status,
    { cinemaId, name: cinemaData?.name },
  );

  // 2.3 Create Auditorium with Auto-Generated Seats
  const createAuditoriumRes = await request(`/cinemas/${cinemaId}/auditoriums`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      name: 'Hall 1 - Dolby Atmos',
      experienceType: 'STANDARD_2D',
      soundSystem: 'Dolby Atmos',
      totalRows: 4,
      totalColumns: 6,
    },
  });

  const auditoriumData = createAuditoriumRes.data?.data || createAuditoriumRes.data;
  const auditoriumId = auditoriumData?.id;
  const auditoriumPassed =
    (createAuditoriumRes.status === 201 || createAuditoriumRes.status === 200) &&
    !!auditoriumId;
  recordResult(
    '2.3',
    'Create Auditorium (Hall 1 - Dolby Atmos)',
    auditoriumPassed,
    createAuditoriumRes.status,
    { auditoriumId, name: auditoriumData?.name, totalSeats: auditoriumData?.total_seats },
  );

  // 2.4 Fetch Auditorium Seats
  const getSeatsRes = await request(`/seats/auditorium/${auditoriumId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
  });

  const layoutData = getSeatsRes.data?.data || getSeatsRes.data;
  const seatsList = layoutData?.seats || [];
  const seatFetchPassed = getSeatsRes.status === 200 && seatsList.length >= 4;
  recordResult(
    '2.4',
    'Fetch Auditorium Seats Layout',
    seatFetchPassed,
    getSeatsRes.status,
    { totalSeatsReturned: seatsList.length, sampleSeat: seatsList[0] },
  );

  const seat1 = seatsList[0];
  const seat2 = seatsList[1];
  const seat3 = seatsList[2];

  // 2.5 Schedule Showtime
  const createShowtimeRes = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      movieId,
      auditoriumId,
      startTime: '2026-12-15T18:00:00.000Z',
      endTime: '2026-12-15T20:30:00.000Z',
      experienceType: 'STANDARD_2D',
      basePrice: 100,
    },
  });

  const showtimeData = createShowtimeRes.data?.data || createShowtimeRes.data;
  const showtimeId = showtimeData?.id;
  const showtimePassed =
    (createShowtimeRes.status === 201 || createShowtimeRes.status === 200) &&
    !!showtimeId;
  recordResult(
    '2.5',
    'Schedule Showtime for Inception',
    showtimePassed,
    createShowtimeRes.status,
    { showtimeId, startTime: showtimeData?.start_time },
  );

  // 2.6 Configure Tiered Pricing
  const setPricingRes = await request(`/showtimes/${showtimeId}/pricing`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      pricings: [
        { seatType: 'REGULAR', price: 100 },
        { seatType: 'PREMIUM', price: 150 },
        { seatType: 'VIP', price: 200 },
      ],
    },
  });

  const pricingData = setPricingRes.data?.data || setPricingRes.data;
  const pricingPassed = setPricingRes.status === 200;
  recordResult(
    '2.6',
    'Configure Showtime Tiered Seat Pricing',
    pricingPassed,
    setPricingRes.status,
    { pricingsCount: pricingData?.seat_pricings?.length || 3 },
  );

  // =============================================================
  // Step 3: Booking Flow & Business Logic Assertions
  // =============================================================
  console.log('\n--- Step 3: Booking Flow & Business Logic Assertions ---');

  // 3.1 Hold Seats (Positive Case)
  const holdRes = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      showtimeId,
      seatIds: [seat1.id, seat2.id],
    },
  });

  const holdPayload = holdRes.data?.data || holdRes.data;
  const booking1 = holdPayload?.booking || holdPayload;
  const booking1Id = booking1?.id;

  const holdPassed =
    holdRes.status === 201 &&
    !!booking1Id &&
    booking1.status === 'PENDING_PAYMENT' &&
    Number(booking1.total_amount || booking1.totalAmount) === 200 &&
    (booking1.booking_reference || booking1.bookingReference)?.startsWith('BK-') &&
    !!(booking1.hold_expires_at || booking1.holdExpiresAt);

  recordResult(
    '3.1',
    'Hold Seats (Positive Case - 2 Seats)',
    holdPassed,
    holdRes.status,
    {
      bookingId: booking1Id,
      bookingReference: booking1?.booking_reference || booking1?.bookingReference,
      status: booking1?.status,
      totalAmount: booking1?.total_amount || booking1?.totalAmount,
      holdExpiresAt: booking1?.hold_expires_at || booking1?.holdExpiresAt,
      holdDurationSeconds: holdPayload?.hold_duration_seconds || holdPayload?.holdDurationSeconds,
    },
  );

  // 3.2 Seat Collision / Conflict Test (Negative Case)
  const collisionRes = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      showtimeId,
      seatIds: [seat1.id],
    },
  });

  const collisionPassed =
    collisionRes.status === 409 ||
    collisionRes.status === 400 ||
    collisionRes.data?.statusCode === 409 ||
    String(collisionRes.data?.message).includes('already reserved');

  recordResult(
    '3.2',
    'Seat Collision / Conflict Test (Negative Case - Expect 409/Conflict)',
    collisionPassed,
    collisionRes.status,
    {
      expectedStatus: 409,
      receivedStatus: collisionRes.status,
      errorResponse: collisionRes.data,
    },
  );

  // 3.3 Confirm Booking & Ticket Generation
  const paymentId = 'a1234567-89ab-cdef-0123-456789abcdef';
  const confirmRes = await request(`/bookings/${booking1Id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: { paymentId },
  });

  const confirmPayload = confirmRes.data?.data || confirmRes.data;
  const confirmedBooking = confirmPayload?.booking || confirmPayload;
  const tickets = confirmedBooking?.tickets || [];

  const confirmPassed =
    confirmRes.status === 200 &&
    confirmedBooking?.status === 'CONFIRMED' &&
    tickets.length === 2 &&
    tickets.every(
      (t) =>
        (t.ticket_number || t.ticketNumber)?.startsWith('TKT-') &&
        !!(t.qr_code_token || t.qrCodeToken) &&
        t.status === 'ISSUED',
    );

  recordResult(
    '3.3',
    'Confirm Booking & Generate Tickets',
    confirmPassed,
    confirmRes.status,
    {
      bookingId: confirmedBooking?.id,
      status: confirmedBooking?.status,
      paymentId: confirmedBooking?.payment_id || confirmedBooking?.paymentId,
      ticketsCount: tickets.length,
      tickets: tickets.map((t) => ({
        ticketNumber: t.ticket_number || t.ticketNumber,
        status: t.status,
      })),
    },
  );

  // 3.4 Query Customer Bookings (My Bookings)
  const myBookingsRes = await request('/bookings/my-bookings?page=1&limit=10', {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerToken}` },
  });

  const myBookingsData = myBookingsRes.data?.data || myBookingsRes.data;
  const myBookingsList = myBookingsData?.bookings || [];
  const foundBooking = myBookingsList.find((b) => b.id === booking1Id);

  const myBookingsPassed =
    myBookingsRes.status === 200 &&
    !!foundBooking &&
    foundBooking.status === 'CONFIRMED' &&
    foundBooking.tickets?.length === 2;

  recordResult(
    '3.4',
    'Query Customer Bookings (GET /bookings/my-bookings)',
    myBookingsPassed,
    myBookingsRes.status,
    {
      total: myBookingsData?.total,
      foundBookingId: foundBooking?.id,
      ticketsCount: foundBooking?.tickets?.length,
    },
  );

  // 3.5 Query Booking By ID
  const getByIdRes = await request(`/bookings/${booking1Id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerToken}` },
  });

  const getByIdData = getByIdRes.data?.data || getByIdRes.data;
  const getByIdPassed =
    getByIdRes.status === 200 &&
    getByIdData?.id === booking1Id &&
    getByIdData?.status === 'CONFIRMED';

  recordResult(
    '3.5',
    'Query Booking By ID (GET /bookings/:id)',
    getByIdPassed,
    getByIdRes.status,
    {
      id: getByIdData?.id,
      bookingReference: getByIdData?.booking_reference || getByIdData?.bookingReference,
      status: getByIdData?.status,
      seatsCount: getByIdData?.seats?.length,
    },
  );

  // 3.6 Hold & Cancel Test Flow
  const holdSeat3Res = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      showtimeId,
      seatIds: [seat3.id],
    },
  });

  const holdSeat3Payload = holdSeat3Res.data?.data || holdSeat3Res.data;
  const booking3 = holdSeat3Payload?.booking || holdSeat3Payload;
  const booking3Id = booking3?.id;

  const cancelRes = await request(`/bookings/${booking3Id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: { reason: 'Changed my mind' },
  });

  const verifyCancelledRes = await request(`/bookings/${booking3Id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const cancelledData = verifyCancelledRes.data?.data || verifyCancelledRes.data;

  // Immediately attempt to re-hold seat3
  const reholdRes = await request('/bookings/hold', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      showtimeId,
      seatIds: [seat3.id],
    },
  });

  const reholdPayload = reholdRes.data?.data || reholdRes.data;
  const reholdBooking = reholdPayload?.booking || reholdPayload;

  const cancelAndReholdPassed =
    holdSeat3Res.status === 201 &&
    cancelRes.status === 200 &&
    cancelledData?.status === 'CANCELLED' &&
    reholdRes.status === 201 &&
    !!reholdBooking?.id;

  recordResult(
    '3.6',
    'Hold, Cancel & Re-Hold Released Seat Flow',
    cancelAndReholdPassed,
    reholdRes.status,
    {
      initialHoldBookingId: booking3Id,
      cancelledStatus: cancelledData?.status,
      reholdBookingId: reholdBooking?.id,
      reholdStatus: reholdBooking?.status,
    },
  );

  // =============================================================
  // SUMMARY REPORT
  // =============================================================
  console.log('\n===============================================================');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('===============================================================');
  const total = testResults.length;
  const passedCount = testResults.filter((r) => r.status === 'PASS').length;
  const failedCount = total - passedCount;

  console.table(
    testResults.map((r) => ({
      Step: r.step,
      Name: r.name,
      Status: r.status,
      HTTP: r.httpStatus,
    })),
  );

  console.log(`\nTOTAL: ${total} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  if (failedCount === 0) {
    console.log('🎉 ALL BOOKING E2E INTEGRATION TESTS PASSED (100%)!\n');
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runBookingE2EFlow().catch((err) => {
  console.error('Fatal Error running Booking E2E Flow:', err);
  process.exit(1);
});
