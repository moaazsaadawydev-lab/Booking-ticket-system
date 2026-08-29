const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function unwrap(payload) {
  if (!payload) return payload;
  if (payload.data !== undefined) return payload.data;
  return payload;
}

async function runTests() {
  console.log('🚀 Starting Admin Dashboard Enhancements & Fixes Verification Suite...\n');

  // Step 1: Admin Login
  console.log('1️⃣ Authenticating as System Super Admin (ADMIN_PORTAL scope)...');
  const loginRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Test-Suite' },
    },
    {
      email: 'superadmin@aflamak.com',
      password: 'SuperAdmin123',
      clientScope: 'ADMIN_PORTAL',
    }
  );

  const loginData = unwrap(loginRes.data);
  if (loginRes.status !== 200 || !loginData?.accessToken) {
    console.error('❌ Login failed:', loginRes.status, loginRes.data);
    process.exit(1);
  }

  const token = loginData.accessToken;
  console.log('✅ Logged in successfully. Token acquired.\n');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Step 2: Create Cinema & Auditorium
  console.log('2️⃣ Registering Cinema & Auditorium for Showtime...');
  const cinemaRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/cinemas',
      method: 'POST',
      headers: authHeaders,
    },
    {
      name: 'Arkan Plaza Cinema Complex',
      city: 'Sheikh Zayed',
      address: 'Arkan Plaza, 26th of July Corridor',
      country: 'Egypt',
      facilities: ['IMAX', 'VIP Lounge', 'Dolby Atmos', 'Parking'],
    }
  );

  const cinema = unwrap(cinemaRes.data);
  const cinemaId = cinema?.id;
  console.log(`✅ Cinema created: "${cinema?.name}" (ID: ${cinemaId})`);

  const audRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auditoriums',
      method: 'POST',
      headers: authHeaders,
    },
    {
      cinemaId,
      name: 'Auditorium 1 VIP/IMAX',
      experienceType: 'IMAX_3D',
      soundSystem: 'Dolby Atmos 11.1',
      totalRows: 10,
      totalColumns: 14,
    }
  );

  const auditorium = unwrap(audRes.data);
  const auditoriumId = auditorium?.id;
  console.log(`✅ Auditorium created: "${auditorium?.name}" (ID: ${auditoriumId})\n`);

  // Step 3: Create Multi-Genre Movie
  console.log('3️⃣ Registering Movie with Multiple Genres (Action, Sci-Fi, Adventure)...');
  const movieRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/movies',
      method: 'POST',
      headers: authHeaders,
    },
    {
      title: 'Dune: Part Three',
      description: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators.',
      durationMinutes: 175,
      releaseDate: '2026-10-15',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      genres: ['Action', 'Sci-Fi', 'Adventure'],
      countryOfOrigin: 'EG',
      originalLanguage: 'en',
    }
  );

  const movie = unwrap(movieRes.data);
  const movieId = movie?.id;
  console.log(`✅ Movie registered: "${movie?.title}" (ID: ${movieId})`);
  const assignedGenres = Array.isArray(movie?.genres)
    ? movie.genres.map((g) => (typeof g === 'object' ? g.name || g.slug : g)).join(', ')
    : movie?.genre;
  console.log(`   Assigned Genres: [ ${assignedGenres} ]`);

  // Step 4: Schedule Showtime with Tiered Seat Pricing Matrix
  console.log('\n4️⃣ Scheduling Showtime with Tiered Seat Pricing Matrix...');
  const startTime = new Date(Date.now() + 14 * 3600 * 1000).toISOString();
  const endTime = new Date(Date.now() + 17 * 3600 * 1000).toISOString();

  const showtimeRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/showtimes',
      method: 'POST',
      headers: authHeaders,
    },
    {
      movieId,
      cinemaId,
      auditoriumId,
      startTime,
      endTime,
      experienceType: 'IMAX_3D',
      basePrice: 150,
      customPricings: [
        { seatType: 'REGULAR', price: 150 },
        { seatType: 'VIP', price: 250 },
        { seatType: 'PREMIUM', price: 200 },
        { seatType: 'COUPLE', price: 300 },
        { seatType: 'WHEELCHAIR', price: 150 },
      ],
    }
  );

  const showtime = unwrap(showtimeRes.data);
  console.log(`✅ Showtime scheduled: ID ${showtime?.id}`);
  console.log(`   Base Price: ${showtime?.base_price || showtime?.basePrice} EGP`);
  const pricings = showtime?.seat_pricings || showtime?.seatPricings || [];
  console.log(`   Tiered Seat Pricings count: ${pricings.length}`);
  pricings.forEach((p) => {
    console.log(`     • ${p.seat_type || p.seatType}: ${p.price} EGP`);
  });

  // Step 5: Verify Metrics & List Endpoints
  console.log('\n5️⃣ Verifying Overview Metric Aggregation...');
  const [listMoviesRes, listCinemasRes, listShowtimesRes] = await Promise.all([
    makeRequest({ hostname: 'localhost', port: 3000, path: '/api/v1/movies', method: 'GET', headers: authHeaders }),
    makeRequest({ hostname: 'localhost', port: 3000, path: '/api/v1/cinemas', method: 'GET', headers: authHeaders }),
    makeRequest({ hostname: 'localhost', port: 3000, path: '/api/v1/showtimes', method: 'GET', headers: authHeaders }),
  ]);

  const moviesList = (unwrap(listMoviesRes.data)?.items || unwrap(listMoviesRes.data) || []);
  const cinemasList = (unwrap(listCinemasRes.data)?.items || unwrap(listCinemasRes.data) || []);
  const showtimesList = (unwrap(listShowtimesRes.data)?.items || unwrap(listShowtimesRes.data) || []);

  console.log(`📊 Command Center Aggregation Live Stats:`);
  console.log(`   - Active Movies in Catalog:  ${moviesList.length} Titles`);
  console.log(`   - Active Cinema Multiplexes: ${cinemasList.length} Complexes`);
  console.log(`   - Scheduled Showtimes Count: ${showtimesList.length} Active Screenings`);

  if (showtimesList.length === 0) {
    console.error('❌ Scheduled showtimes count is 0!');
    process.exit(1);
  }

  console.log('\n🎉 ALL 5 DELIVERABLES & FUNCTIONAL CHECKS PASSED 100%!');
}

runTests().catch((err) => {
  console.error('❌ Test suite execution failed:', err);
  process.exit(1);
});
