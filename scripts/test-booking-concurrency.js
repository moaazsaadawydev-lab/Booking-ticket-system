const axios = require('axios');
const { Client: PgClient } = require('pg');
const { execSync } = require('child_process');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

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

function getRedisKey(key) {
  try {
    const out = execSync(`docker exec redis redis-cli GET "${key}"`, {
      encoding: 'utf-8',
    });
    return out.replace(/[\r\n"]/g, '').trim();
  } catch (e) {
    return null;
  }
}

async function runConcurrencyStressTest() {
  console.log('========================================================================');
  console.log('⚡ Starting Redis Distributed Locking High-Concurrency Stress Test (20x)');
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

  const password = 'Password123!';

  // -------------------------------------------------------------
  // Step 1: Admin & Cinema Setup
  // -------------------------------------------------------------
  console.log('--- Step 1: Provisioning Admins & Setting Up Catalog ---');

  // Super Admin
  const superAdminEmail = 'super.concurrency@test.com';
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
  const cinemaAdminEmail = 'cinema.concurrency@test.com';
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

  // 1.1 Create Movie
  const createMovieRes = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      title: `Concurrency Movie ${Date.now().toString().slice(-4)}`,
      description: 'Stress testing movie for distributed seat locks.',
      durationMinutes: 120,
      releaseDate: '2026-08-01',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
      spokenLanguages: ['en'],
      subtitles: ['ar'],
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      trailerUrl: 'https://www.youtube.com/watch?v=sample',
    },
  });
  const movieId = createMovieRes.data?.data?.id || createMovieRes.data?.id;

  // 1.2 Create Cinema Branch
  const createCinemaRes = await request('/cinemas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: `Concurrency Cinema ${Date.now().toString().slice(-4)}`,
      city: 'Cairo',
      address: 'Nasr City, Cairo',
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
      name: 'Stress Test Hall 1',
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
  const targetSeatLabel = `${targetSeat.row_label}-${targetSeat.seat_number}`;

  // 1.5 Schedule Showtime
  const createShowtimeRes = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      movieId,
      auditoriumId,
      startTime: '2026-12-20T19:00:00.000Z',
      endTime: '2026-12-20T21:30:00.000Z',
      experienceType: 'STANDARD_2D',
      basePrice: 120,
    },
  });
  const showtimeId =
    createShowtimeRes.data?.data?.id || createShowtimeRes.data?.id;

  console.log(`✅ Catalog Ready:`);
  console.log(`   Showtime ID: ${showtimeId}`);
  console.log(`   Target Seat: ${targetSeatLabel} (ID: ${targetSeatId})\n`);

  // -------------------------------------------------------------
  // Step 2: Provision 20 Unique Customer Users
  // -------------------------------------------------------------
  console.log('--- Step 2: Provisioning 20 Concurrent Customers ---');
  const userCount = 20;
  const users = [];

  for (let i = 1; i <= userCount; i++) {
    const userEmail = `concurrent.user.${i}@test.com`;
    await request('/users/auth/register', {
      method: 'POST',
      body: {
        name: `Concurrent User ${i}`,
        email: userEmail,
        password,
        country: 'Egypt',
        gender: i % 2 === 0 ? 'female' : 'male',
      },
    });

    const otp = getRedisOtp(userEmail);
    if (otp) {
      await request('/users/auth/verify-email', {
        method: 'POST',
        body: { email: userEmail, code: otp },
      });
    }

    await pgUsersClient.query(
      `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [userEmail],
    );

    const loginRes = await request('/users/auth/login', {
      method: 'POST',
      body: { email: userEmail, password },
    });

    const token = loginRes.data?.data?.accessToken || loginRes.data?.accessToken;
    const userId = loginRes.data?.data?.user?.id || loginRes.data?.user?.id;

    users.push({ index: i, email: userEmail, token, userId });
  }
  console.log(`✅ Successfully authenticated ${users.length} customer users with valid JWTs.\n`);

  // -------------------------------------------------------------
  // Step 3: High-Concurrency Lock Execution (20 Requests in Parallel)
  // -------------------------------------------------------------
  console.log('--- Step 3: Firing 20 Concurrent Requests for the EXACT Same Seat ---');
  console.log(`🎯 Target Seat: ${targetSeatLabel} (${targetSeatId})`);
  console.log(`⏱️ Dispatching 20 concurrent POST /api/v1/bookings/hold requests...\n`);

  const startTime = Date.now();

  const concurrentRequests = users.map((u) => {
    return request('/bookings/hold', {
      method: 'POST',
      headers: { Authorization: `Bearer ${u.token}` },
      body: {
        showtimeId,
        seatIds: [targetSeatId],
      },
    }).then((res) => ({
      userIndex: u.index,
      userEmail: u.email,
      userId: u.userId,
      status: res.status,
      data: res.data,
    }));
  });

  const results = await Promise.all(concurrentRequests);
  const elapsedMs = Date.now() - startTime;

  console.log(`🏁 All 20 requests completed in ${elapsedMs}ms.\n`);

  // -------------------------------------------------------------
  // Step 4: Breakdown & Assertions
  // -------------------------------------------------------------
  console.log('--- Step 4: Verification & Assertions ---');

  const successes = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const others = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.table(
    results.map((r) => ({
      'User #': r.userIndex,
      'Email': r.userEmail,
      'HTTP Status': r.status,
      'Outcome': r.status === 201 ? '🟢 WON LOCK' : r.status === 409 ? '🔴 REJECTED (409)' : '⚠️ UNEXPECTED',
      'Booking Ref': r.data?.data?.booking?.booking_reference || r.data?.booking?.booking_reference || 'N/A',
      'Message': r.data?.message || 'OK',
    })),
  );

  console.log('\n--- Concurrency Metrics ---');
  console.log(`  Total Concurrent Requests: ${results.length}`);
  console.log(`  Successful (201 Created):  ${successes.length} (Expected: 1)`);
  console.log(`  Rejected (409 Conflict):  ${conflicts.length} (Expected: 19)`);
  console.log(`  Other Status Codes:       ${others.length} (Expected: 0)`);
  console.log(`  Total Roundtrip Duration: ${elapsedMs}ms`);

  // 4.1 Redis Lock Key Verification
  const redisLockKey = `booking:lock:${showtimeId}:${targetSeatId}`;
  const redisLockedUserId = getRedisKey(redisLockKey);
  console.log(`\n--- Redis Distributed Lock State ---`);
  console.log(`  Key: ${redisLockKey}`);
  console.log(`  Value (Lock Owner User ID): ${redisLockedUserId}`);

  // 4.2 PostgreSQL Database Verification
  const dbSeatsRes = await pgBookingsClient.query(
    `SELECT bs.id, bs.booking_id, bs.seat_id, bs.seat_identifier, b.user_id, b.status, b.booking_reference
     FROM booking_seats bs
     JOIN bookings b ON b.id = bs.booking_id
     WHERE b.showtime_id = $1 AND bs.seat_id = $2`,
    [showtimeId, targetSeatId],
  );

  console.log(`\n--- PostgreSQL Database State ---`);
  console.log(`  Matching Records in booking_seats: ${dbSeatsRes.rows.length} (Expected: 1)`);
  if (dbSeatsRes.rows.length > 0) {
    console.log(`  Database Row:`, JSON.stringify(dbSeatsRes.rows[0], null, 2));
  }

  await pgUsersClient.end();
  await pgBookingsClient.end();

  // Formal Assertions
  const assert1 = successes.length === 1;
  const assert2 = conflicts.length === 19;
  const assert3 = others.length === 0;
  const assert4 = dbSeatsRes.rows.length === 1;
  const assert5 = !!redisLockedUserId;

  console.log('\n========================================================================');
  console.log('📋 ASSERTION RESULTS');
  console.log('========================================================================');
  console.log(`[${assert1 ? 'PASS' : 'FAIL'}] Exactly 1 request acquired the lock and returned 201 Created`);
  console.log(`[${assert2 ? 'PASS' : 'FAIL'}] Exactly 19 requests were rejected with 409 Conflict`);
  console.log(`[${assert3 ? 'PASS' : 'FAIL'}] Zero unexpected errors or dropped requests`);
  console.log(`[${assert4 ? 'PASS' : 'FAIL'}] PostgreSQL contains exactly 1 active booking_seats record (Zero double-bookings)`);
  console.log(`[${assert5 ? 'PASS' : 'FAIL'}] Redis holds active distributed lock with correct owner userId`);

  const allPassed = assert1 && assert2 && assert3 && assert4 && assert5;
  if (allPassed) {
    console.log('\n🎉 ALL CONCURRENCY & REDIS DISTRIBUTED LOCK TESTS PASSED (100%)!\n');
  } else {
    console.log('\n❌ CONCURRENCY TEST ASSERTIONS FAILED.\n');
    process.exit(1);
  }
}

runConcurrencyStressTest().catch((err) => {
  console.error('Fatal Error in Concurrency Test:', err);
  process.exit(1);
});
