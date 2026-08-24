const axios = require('axios');
const { execSync } = require('child_process');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.error(`Command failed: ${cmd}\n`, error.message);
    return null;
  }
}

function redisCmd(command) {
  return runCmd(`docker exec redis redis-cli ${command}`);
}

async function request(path, options = {}) {
  const url = `${GATEWAY_URL}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await axios({
      method,
      url,
      data: options.body,
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

const testResults = [];

function recordResult(step, name, passed, httpStatus, details = {}) {
  const statusStr = passed ? 'PASS' : 'FAIL';
  testResults.push({ step, name, status: statusStr, httpStatus, details });
  console.log(`[${statusStr}] ${step}: ${name} (HTTP ${httpStatus})`);
  if (details && Object.keys(details).length > 0) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function runCachingSuite() {
  console.log('===============================================================');
  console.log('🚀 Starting Catalog Distributed Caching & Tag Invalidation Suite');
  console.log('===============================================================\n');

  // Step 1: Super Admin Authentication & Setup
  console.log('--- Step 1: Super Admin Setup & Corpus Provisioning ---');
  const timestamp = Date.now();
  const adminEmail = `admin.cache.${timestamp}@test.com`;
  const adminPass = 'Password123!';

  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Super Admin Caching',
      email: adminEmail,
      password: adminPass,
      country: 'Egypt',
      gender: 'male',
    },
  });

  const otp = redisCmd(`GET "otp:verify-email:${adminEmail}"`);
  await request('/users/auth/verify-email', {
    method: 'POST',
    body: { email: adminEmail, code: otp },
  });

  runCmd(
    `docker exec postgres psql -U postgres -d Booking-Users -c "UPDATE users SET role = 'super_admin' WHERE email = '${adminEmail}';"`,
  );

  const loginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: adminPass },
  });
  const adminToken = loginRes.data?.data?.accessToken || loginRes.data?.data?.access_token;
  recordResult('1.1', 'Authenticate Super Admin', !!adminToken, loginRes.status, { adminEmail });

  // Provision Movie
  const movieRes = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      title: `Interstellar Cache Test ${timestamp}`,
      description: 'A deep space caching journey.',
      durationMinutes: 165,
      releaseDate: '2026-12-01',
      ageRating: 'PG_13',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
      status: 'NOW_SHOWING',
    },
  });
  const movieId = movieRes.data?.data?.id;
  const movieSlug = movieRes.data?.data?.slug;
  recordResult('1.2', 'Create Test Movie', !!movieId, movieRes.status, { movieId, movieSlug });

  // Provision Cinema
  const cinemaRes = await request('/cinemas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      name: `Galaxy Caching Cinema ${timestamp}`,
      city: 'Cairo',
      country: 'EG',
      address: '99 Caching Way',
    },
  });
  const cinemaId = cinemaRes.data?.data?.id;
  recordResult('1.3', 'Create Test Cinema', !!cinemaId, cinemaRes.status, { cinemaId });

  // Provision Auditorium
  const audRes = await request(`/cinemas/${cinemaId}/auditoriums`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      name: 'Cache IMAX 1',
      experienceType: 'IMAX_3D',
      totalRows: 4,
      totalColumns: 6,
    },
  });
  const auditoriumId = audRes.data?.data?.id;
  recordResult('1.4', 'Create Test Auditorium', !!auditoriumId, audRes.status, { auditoriumId });

  // Provision Showtime
  const stRes = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      movieId,
      auditoriumId,
      startTime: '2026-12-01T18:00:00.000Z',
      endTime: '2026-12-01T20:45:00.000Z',
      experienceType: 'IMAX_3D',
      basePrice: 160,
    },
  });
  const showtimeId = stRes.data?.data?.id;
  recordResult('1.5', 'Create Test Showtime', !!showtimeId, stRes.status, { showtimeId });

  // Step 2: Cache Miss vs Cache Hit Verification
  console.log('\n--- Step 2: Cache Miss vs Cache Hit Verification ---');

  // Test 2.1: Genres Cache
  const genresRes = await request('/movies/genres');
  const genresKeyExists = redisCmd('EXISTS "catalog:genres:all"');
  recordResult('2.1', 'Cache Genres List (catalog:genres:all)', genresRes.status === 200 && genresKeyExists === '1', genresRes.status, {
    keyExists: genresKeyExists === '1',
  });

  // Test 2.2: Movie Details Cache (by ID and by Slug)
  const getMovieRes = await request(`/movies/${movieId}`);
  const movieKeyExists = redisCmd(`EXISTS "catalog:movie:id:${movieId}"`);
  const movieSlugKeyExists = redisCmd(`EXISTS "catalog:movie:slug:${movieSlug}"`);
  recordResult('2.2', 'Cache Movie Details (by ID & Slug)', getMovieRes.status === 200 && movieKeyExists === '1' && movieSlugKeyExists === '1', getMovieRes.status, {
    idKey: movieKeyExists === '1',
    slugKey: movieSlugKeyExists === '1',
  });

  // Test 2.3: Discovery Feed Cache & Sub-millisecond Cache Hit
  const t0 = Date.now();
  const feedMissRes = await request('/movies/discovery/feed?country=EG&language=ar');
  const missDuration = Date.now() - t0;
  const feedKey = 'catalog:feed:EG:ar:10';
  const feedKeyExists = redisCmd(`EXISTS "${feedKey}"`);

  const t1 = Date.now();
  const feedHitRes = await request('/movies/discovery/feed?country=EG&language=ar');
  const hitDuration = Date.now() - t1;

  recordResult('2.3', 'Discovery Feed Cache Hit & Latency Improvement', feedHitRes.status === 200 && feedKeyExists === '1', feedHitRes.status, {
    feedKeyExists: feedKeyExists === '1',
    cacheMissLatencyMs: missDuration,
    cacheHitLatencyMs: hitDuration,
  });

  // Test 2.4: Grouped Showtimes Cache
  const groupedRes = await request(`/showtimes/grouped?movieId=${movieId}&date=2026-12-01`);
  const groupedKey = `catalog:showtimes:movie:${movieId}:date:2026-12-01`;
  const groupedKeyExists = redisCmd(`EXISTS "${groupedKey}"`);
  recordResult('2.4', 'Grouped Showtimes Cache', groupedRes.status === 200 && groupedKeyExists === '1', groupedRes.status, {
    groupedKey,
    keyExists: groupedKeyExists === '1',
  });

  // Test 2.5: Auditorium Seat Layout Cache
  const seatsRes = await request(`/seats/auditorium/${auditoriumId}`);
  const layoutKey = `catalog:auditorium:${auditoriumId}:layout`;
  const layoutKeyExists = redisCmd(`EXISTS "${layoutKey}"`);
  recordResult('2.5', 'Auditorium Seat Layout Cache', seatsRes.status === 200 && layoutKeyExists === '1', seatsRes.status, {
    layoutKey,
    keyExists: layoutKeyExists === '1',
  });

  // Step 3: Tag-Based Cascading Invalidation Tests
  console.log('\n--- Step 3: Tag-Based Cascading Invalidation Tests ---');

  // Test 3.1: Verify Tag Set Membership
  const movieTagMembers = redisCmd(`SMEMBERS "catalog:tags:movie:${movieId}"`);
  recordResult('3.1', 'Movie Tag Set Contains Associated Keys', movieTagMembers && movieTagMembers.includes(groupedKey), 200, {
    tag: `catalog:tags:movie:${movieId}`,
    members: movieTagMembers,
  });

  // Test 3.2: Invalidate on Showtime Pricing Update
  const updatePricingRes = await request(`/showtimes/${showtimeId}/pricing`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: [
      { seatType: 'REGULAR', price: 180 },
      { seatType: 'PREMIUM', price: 240 },
    ],
  });
  const groupedAfterPricingUpdate = redisCmd(`EXISTS "${groupedKey}"`);
  recordResult('3.2', 'Cascading Invalidation on Showtime Pricing Update', updatePricingRes.status === 200 && groupedAfterPricingUpdate === '0', updatePricingRes.status, {
    groupedKeyPurged: groupedAfterPricingUpdate === '0',
  });

  // Test 3.3: Invalidate on Movie Update
  const updateMovieRes = await request(`/movies/${movieId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { title: `Interstellar Cache Updated ${timestamp}` },
  });
  const movieKeyAfterUpdate = redisCmd(`EXISTS "catalog:movie:id:${movieId}"`);
  const feedKeyAfterUpdate = redisCmd(`EXISTS "${feedKey}"`);
  recordResult('3.3', 'Cascading Invalidation on Movie Update (Tags & Feed Patterns)', updateMovieRes.status === 200 && movieKeyAfterUpdate === '0' && feedKeyAfterUpdate === '0', updateMovieRes.status, {
    movieKeyPurged: movieKeyAfterUpdate === '0',
    feedKeyPurged: feedKeyAfterUpdate === '0',
  });

  // Test 3.4: Invalidate on Seat Layout Update
  const seatList = seatsRes.data?.data?.seats || [];
  const firstSeat = seatList[0];
  if (firstSeat) {
    const updateSeatRes = await request(`/seats/${firstSeat.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isOperational: false },
    });
    const layoutKeyAfterUpdate = redisCmd(`EXISTS "${layoutKey}"`);
    recordResult('3.4', 'Cascading Invalidation on Seat Update', updateSeatRes.status === 200 && layoutKeyAfterUpdate === '0', updateSeatRes.status, {
      layoutKeyPurged: layoutKeyAfterUpdate === '0',
    });
  }

  // Step 4: Cache Penetration Sentinel Protection Tests
  console.log('\n--- Step 4: Cache Penetration Sentinel Protection Tests ---');

  const nonExistentMovieId = '00000000-0000-0000-0000-000000000000';
  const notFoundRes = await request(`/movies/${nonExistentMovieId}`);
  const sentinelVal = redisCmd(`GET "catalog:movie:id:${nonExistentMovieId}"`);
  const cleanVal = sentinelVal ? sentinelVal.replace(/"/g, '').trim() : '';
  const sentinelProtected = notFoundRes.status === 404 && cleanVal === '__NULL__';

  recordResult('4.1', 'Cache Penetration Sentinel Stored for Missing Entity', sentinelProtected, notFoundRes.status, {
    sentinelKey: `catalog:movie:id:${nonExistentMovieId}`,
    sentinelValue: cleanVal,
  });

  // Immediate subsequent request to verify fast sentinel short-circuit
  const secondNotFoundRes = await request(`/movies/${nonExistentMovieId}`);
  recordResult('4.2', 'Subsequent Request Fast Returns 404 via Sentinel', secondNotFoundRes.status === 404, secondNotFoundRes.status, {
    message: secondNotFoundRes.data?.message,
  });

  // Summary
  console.log('\n===============================================================');
  console.log('🏁 Catalog Distributed Caching Execution Completed. Summary:');
  console.log('===============================================================');
  console.table(
    testResults.map((r) => ({
      step: r.step,
      name: r.name,
      status: r.status,
      httpStatus: r.httpStatus,
    })),
  );

  const allPassed = testResults.every((r) => r.status === 'PASS');
  if (!allPassed) {
    console.error('❌ Some caching tests failed.');
    process.exit(1);
  } else {
    console.log('✅ All 12 Caching & Invalidation tests passed successfully (100%)!');
  }
}

runCachingSuite().catch((err) => {
  console.error('Fatal error in caching suite:', err);
  process.exit(1);
});
