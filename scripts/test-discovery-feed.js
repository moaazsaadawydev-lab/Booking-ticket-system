const { execSync } = require('child_process');

const GATEWAY_URL = 'http://localhost:3000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${GATEWAY_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runSqlUsers(sql) {
  const cmd = `docker exec -i postgres psql -U postgres -d Booking-Users -t -A -c "${sql}"`;
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

async function getRedisOtp(email) {
  const cmd = `docker exec -i redis redis-cli GET "otp:verify-email:${email}"`;
  for (let i = 0; i < 10; i++) {
    try {
      const otp = execSync(cmd, { encoding: 'utf8' }).trim();
      if (otp && otp !== 'null' && otp.length === 6) return otp;
    } catch {}
    await sleep(300);
  }
  return null;
}

const testResults = [];
function recordResult(step, name, passed, status, details = {}) {
  const statusStr = passed ? 'PASS' : 'FAIL';
  testResults.push({ step, name, status: statusStr, httpStatus: status });
  console.log(
    `[${statusStr}] ${step}: ${name} (HTTP ${status})\n   Details:`,
    JSON.stringify(details, null, 2)
  );
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 Starting Content Localization & Discovery Feed Test Suite');
  console.log('===============================================================\n');

  // Step 1: Admin Setup & Authentication
  console.log('--- Step 1: Super Admin Provisioning & Authentication ---');
  const adminEmail = `admin.discovery.${Date.now()}@test.com`;
  const registerRes = await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Discovery Admin',
      email: adminEmail,
      password: 'Password123!',
      country: 'Egypt',
      gender: 'male',
    },
  });

  const otp = await getRedisOtp(adminEmail);
  const verifyRes = await request('/users/auth/verify-email', {
    method: 'POST',
    body: { email: adminEmail, code: otp },
  });

  runSqlUsers(`UPDATE users SET role = 'super_admin' WHERE email = '${adminEmail}';`);

  const loginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: 'Password123!' },
  });

  const token =
    loginRes.data?.data?.accessToken ||
    loginRes.data?.data?.access_token ||
    loginRes.data?.accessToken;
  recordResult('1.1', 'Authenticate Super Admin', Boolean(token), loginRes.status, { adminEmail });

  // Fetch genres
  const genresRes = await request('/movies/genres');
  const genresList = genresRes.data?.data?.genres || genresRes.data?.genres || [];
  const genreIds = genresList.slice(0, 2).map((g) => g.id);

  // Step 2: Create Localized Movies
  console.log('\n--- Step 2: Provision Localized Movies ---');
  
  // Movie 1: Egyptian Arabic (NOW_SHOWING)
  const egMovieNow = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'El Fil El Azraq 3',
      description: 'Egyptian psychological thriller continuation.',
      durationMinutes: 130,
      releaseDate: '2026-06-15',
      ageRating: 'R',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'EG',
      originalLanguage: 'ar',
      spokenLanguages: ['ar'],
      subtitles: ['en'],
      directors: ['Marwan Hamed'],
      cast: ['Karim Abdel Aziz', 'Nelly Karim'],
      genreIds,
    },
  });
  const egMovieNowId = egMovieNow.data?.data?.id;
  recordResult('2.1', 'Create Egyptian Movie (NOW_SHOWING, EG, ar)', egMovieNow.status === 201, egMovieNow.status, {
    id: egMovieNowId,
    title: egMovieNow.data?.data?.title,
    countryOfOrigin: egMovieNow.data?.data?.country_of_origin,
    originalLanguage: egMovieNow.data?.data?.original_language,
  });

  // Movie 2: Egyptian Arabic (COMING_SOON)
  const egMovieSoon = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'Welad Rizk 4',
      description: 'Four brothers pull off their biggest heist in Cairo.',
      durationMinutes: 125,
      releaseDate: '2026-10-01',
      ageRating: 'R',
      status: 'COMING_SOON',
      countryOfOrigin: 'EG',
      originalLanguage: 'ar',
      spokenLanguages: ['ar'],
      subtitles: ['en'],
      directors: ['Tarek Al Eryan'],
      cast: ['Ahmed Ezz', 'Amr Youssef'],
      genreIds,
    },
  });
  const egMovieSoonId = egMovieSoon.data?.data?.id;
  recordResult('2.2', 'Create Egyptian Movie (COMING_SOON, EG, ar)', egMovieSoon.status === 201, egMovieSoon.status, {
    id: egMovieSoonId,
    title: egMovieSoon.data?.data?.title,
  });

  // Movie 3: US English (NOW_SHOWING)
  const usMovieNow = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'Avengers: Secret Wars',
      description: 'Multiverse heroes unite against a cosmic adversary.',
      durationMinutes: 180,
      releaseDate: '2026-05-01',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
      spokenLanguages: ['en'],
      subtitles: ['ar', 'fr'],
      directors: ['Anthony Russo', 'Joe Russo'],
      cast: ['Robert Downey Jr.', 'Chris Evans'],
      genreIds,
    },
  });
  const usMovieNowId = usMovieNow.data?.data?.id;
  recordResult('2.3', 'Create US Movie (NOW_SHOWING, US, en)', usMovieNow.status === 201, usMovieNow.status, {
    id: usMovieNowId,
    title: usMovieNow.data?.data?.title,
  });

  // Movie 4: US English (COMING_SOON)
  const usMovieSoon = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'Avatar: Fire and Ash',
      description: 'Journey into the volcanic regions of Pandora.',
      durationMinutes: 190,
      releaseDate: '2026-12-19',
      ageRating: 'PG_13',
      status: 'COMING_SOON',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
      spokenLanguages: ['en'],
      subtitles: ['ar'],
      directors: ['James Cameron'],
      cast: ['Sam Worthington', 'Zoe Saldana'],
      genreIds,
    },
  });
  const usMovieSoonId = usMovieSoon.data?.data?.id;
  recordResult('2.4', 'Create US Movie (COMING_SOON, US, en)', usMovieSoon.status === 201, usMovieSoon.status, {
    id: usMovieSoonId,
    title: usMovieSoon.data?.data?.title,
  });

  // Step 3: Create Localized Cinemas & Auditoriums
  console.log('\n--- Step 3: Provision Localized Cinemas & Schedules ---');
  
  // Egyptian Cinema
  const egCinema = await request('/cinemas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: 'Cairo Festival Stars Cinema',
      city: 'Cairo',
      country: 'EG',
      address: '5th Settlement, New Cairo',
      description: 'Premier cinema multiplex in Cairo.',
    },
  });
  const egCinemaId = egCinema.data?.data?.id;

  const egAuditorium = await request(`/cinemas/${egCinemaId}/auditoriums`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: 'Screen 1 VIP',
      experienceType: 'VIP_LOUNGE',
      soundSystem: 'Dolby Atmos',
      totalRows: 4,
      totalColumns: 8,
    },
  });
  const egAuditoriumId = egAuditorium.data?.data?.id;

  // Schedule Showtime for Egyptian movie in Egyptian cinema
  const egShowtime = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      movieId: egMovieNowId,
      auditoriumId: egAuditoriumId,
      startTime: '2026-09-10T19:00:00.000Z',
      endTime: '2026-09-10T21:10:00.000Z',
      experienceType: 'VIP_LOUNGE',
      basePrice: 160,
    },
  });
  recordResult('3.1', 'Schedule Showtime in Egyptian Cinema (country = EG)', egShowtime.status === 201, egShowtime.status, {
    cinema: 'Cairo Festival Stars Cinema (EG)',
    movie: 'El Fil El Azraq 3',
  });

  // US Cinema
  const usCinema = await request('/cinemas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: 'AMC Empire Times Square',
      city: 'New York',
      country: 'US',
      address: '234 W 42nd St, New York, NY',
      description: 'Flagship AMC theatre in NYC.',
    },
  });
  const usCinemaId = usCinema.data?.data?.id;

  const usAuditorium = await request(`/cinemas/${usCinemaId}/auditoriums`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: 'IMAX Laser Hall',
      experienceType: 'IMAX_3D',
      soundSystem: 'Dolby Atmos 12.1',
      totalRows: 5,
      totalColumns: 10,
    },
  });
  const usAuditoriumId = usAuditorium.data?.data?.id;

  // Schedule Showtime for US movie in US cinema
  const usShowtime = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      movieId: usMovieNowId,
      auditoriumId: usAuditoriumId,
      startTime: '2026-09-10T20:00:00.000Z',
      endTime: '2026-09-10T23:00:00.000Z',
      experienceType: 'IMAX_3D',
      basePrice: 200,
    },
  });
  recordResult('3.2', 'Schedule Showtime in US Cinema (country = US)', usShowtime.status === 201, usShowtime.status, {
    cinema: 'AMC Empire Times Square (US)',
    movie: 'Avengers: Secret Wars',
  });

  // Step 4: Validate Discovery Feed Localization & Relevance Weighting
  console.log('\n--- Step 4: Discovery Feed Localized Ranking Tests ---');

  // Test 4.1: Query with country=EG&language=ar
  const egFeedRes = await request('/movies/discovery/feed?country=EG&language=ar');
  const egFeed = egFeedRes.data?.data || {};

  const egNowShowingMatch = (egFeed.now_showing_local || []).some((m) => m.id === egMovieNowId);
  const egComingSoonMatch = (egFeed.coming_soon_local || []).some((m) => m.id === egMovieSoonId);
  const egTopFeatured = egFeed.featured?.[0]?.id === egMovieNowId || egFeed.featured?.[0]?.id === egMovieSoonId;

  recordResult(
    '4.1',
    'Discovery Feed for Egypt (country=EG, language=ar)',
    egFeedRes.status === 200 && egNowShowingMatch && egComingSoonMatch && egTopFeatured,
    egFeedRes.status,
    {
      topFeaturedTitle: egFeed.featured?.[0]?.title,
      nowShowingLocalCount: (egFeed.now_showing_local || []).length,
      comingSoonLocalCount: (egFeed.coming_soon_local || []).length,
      topRatedCount: (egFeed.top_rated || []).length,
    }
  );

  // Test 4.2: Query with country=US&language=en
  const usFeedRes = await request('/movies/discovery/feed?country=US&language=en');
  const usFeed = usFeedRes.data?.data || {};

  const usNowShowingMatch = (usFeed.now_showing_local || []).some((m) => m.id === usMovieNowId);
  const usComingSoonMatch = (usFeed.coming_soon_local || []).some((m) => m.id === usMovieSoonId);
  const usTopFeatured = usFeed.featured?.[0]?.id === usMovieNowId || usFeed.featured?.[0]?.id === usMovieSoonId;

  recordResult(
    '4.2',
    'Discovery Feed for US (country=US, language=en)',
    usFeedRes.status === 200 && usNowShowingMatch && usComingSoonMatch && usTopFeatured,
    usFeedRes.status,
    {
      topFeaturedTitle: usFeed.featured?.[0]?.title,
      nowShowingLocalCount: (usFeed.now_showing_local || []).length,
      comingSoonLocalCount: (usFeed.coming_soon_local || []).length,
    }
  );

  // Test 4.3: Authenticated Discovery Feed without country query param
  const authFeedRes = await request('/movies/discovery/feed', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const authFeed = authFeedRes.data?.data || {};
  const authMatchedUserCountry = (authFeed.now_showing_local || []).some((m) => m.id === egMovieNowId);

  recordResult(
    '4.3',
    'Discovery Feed via JWT context (inherits user country = EG)',
    authFeedRes.status === 200 && authMatchedUserCountry,
    authFeedRes.status,
    {
      topFeaturedTitle: authFeed.featured?.[0]?.title,
      userDefaultCountry: 'EG',
    }
  );

  // Test 4.4: Global Search / List Unaffected
  const listAllRes = await request('/movies');
  const totalListed = listAllRes.data?.data?.items?.length || 0;
  recordResult(
    '4.4',
    'Global Worldwide Movie Listing (Non-localized GET /movies)',
    listAllRes.status === 200 && totalListed >= 4,
    listAllRes.status,
    { totalWorldwideMovies: totalListed }
  );

  console.log('\n===============================================================');
  console.log('🏁 Discovery Feed Execution Completed. Summary:');
  console.log('===============================================================');
  console.table(testResults);
}

run().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
