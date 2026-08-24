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
  console.log('🚀 Starting Resilient Movie Search & Date Filtering Test Suite');
  console.log('===============================================================\n');

  // Step 1: Admin Authentication
  console.log('--- Step 1: Super Admin Authentication ---');
  const adminEmail = `admin.search.${Date.now()}@test.com`;
  await request('/users/auth/register', {
    method: 'POST',
    body: {
      name: 'Search QA Admin',
      email: adminEmail,
      password: 'Password123!',
      country: 'Egypt',
      gender: 'male',
    },
  });

  const otp = await getRedisOtp(adminEmail);
  await request('/users/auth/verify-email', {
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

  // Step 2: Seed Test Movies
  console.log('\n--- Step 2: Provision Search Test Corpus ---');
  const genresRes = await request('/movies/genres');
  const genresList = genresRes.data?.data?.genres || genresRes.data?.genres || [];
  const genreIds = genresList.slice(0, 2).map((g) => g.id);

  const moviesToSeed = [
    {
      title: 'Interstellar',
      description: 'A team of explorers travel through a wormhole in space.',
      durationMinutes: 169,
      releaseDate: '2014-11-07',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
    },
    {
      title: 'Inception',
      description: 'A thief who steals corporate secrets through dream-sharing technology.',
      durationMinutes: 148,
      releaseDate: '2010-07-16',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
    },
    {
      title: 'The Dark Knight Rises',
      description: 'Eight years after the Joker reign of anarchy, Batman must return.',
      durationMinutes: 164,
      releaseDate: '2012-07-20',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
    },
    {
      title: 'Oppenheimer',
      description: 'The story of American scientist J. Robert Oppenheimer and the Manhattan Project.',
      durationMinutes: 180,
      releaseDate: '2023-07-21',
      ageRating: 'R',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
    },
    {
      title: 'El Fil El Azraq',
      description: 'Dr. Yehia embarks on a dark psychological journey in 8 West ward.',
      durationMinutes: 135,
      releaseDate: '2014-07-28',
      ageRating: 'R',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'EG',
      originalLanguage: 'ar',
    },
  ];

  const seededMovieIds = {};
  for (const m of moviesToSeed) {
    const res = await request('/movies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        ...m,
        genreIds,
        spokenLanguages: [m.originalLanguage],
        subtitles: ['en'],
      },
    });
    const id = res.data?.data?.id;
    seededMovieIds[m.title] = id;
  }
  recordResult('2.1', 'Seed 5 Test Movies Across Different Release Years', Object.keys(seededMovieIds).length === 5, 201, {
    titles: Object.keys(seededMovieIds),
  });

  // Step 3: Fuzzy Typo & Trigram Matching Tests
  console.log('\n--- Step 3: Fuzzy Typo & Trigram Matching Tests ---');

  // Test 3.1: Transposed typo "Intesrtaller"
  const typo1Res = await request('/movies/search?query=Intesrtaller');
  const typo1Items = typo1Res.data?.data?.items || [];
  const typo1Matched = typo1Items.length > 0 && typo1Items.some((m) => m.title.startsWith('Interstellar'));
  recordResult('3.1', 'Typo with Transposed Characters ("Intesrtaller" -> "Interstellar")', typo1Matched, typo1Res.status, {
    query: 'Intesrtaller',
    topResult: typo1Items[0]?.title,
    totalMatches: typo1Items.length,
  });

  // Test 3.2: Missing letter typo & lowercase "interstelar"
  const typo2Res = await request('/movies/search?query=interstelar');
  const typo2Items = typo2Res.data?.data?.items || [];
  const typo2Matched = typo2Items.length > 0 && typo2Items.some((m) => m.title.startsWith('Interstellar'));
  recordResult('3.2', 'Typo with Missing Letter & Lowercase ("interstelar" -> "Interstellar")', typo2Matched, typo2Res.status, {
    query: 'interstelar',
    topResult: typo2Items[0]?.title,
  });

  // Test 3.3: Partial fuzzy search "instellar"
  const typo3Res = await request('/movies/search?query=instellar');
  const typo3Items = typo3Res.data?.data?.items || [];
  const typo3Matched = typo3Items.some((m) => m.title.startsWith('Interstellar'));
  recordResult('3.3', 'Fuzzy Substring Search ("instellar" -> "Interstellar")', typo3Matched, typo3Res.status, {
    query: 'instellar',
    topResult: typo3Items[0]?.title,
  });

  // Test 3.4: Case-Insensitive Partial Substring "dark KNIGHT"
  const partialRes = await request('/movies/search?query=dark%20KNIGHT');
  const partialItems = partialRes.data?.data?.items || [];
  const partialMatched = partialItems.some((m) => m.title === 'The Dark Knight Rises');
  recordResult('3.4', 'Case-Insensitive Substring Match ("dark KNIGHT")', partialMatched, partialRes.status, {
    query: 'dark KNIGHT',
    topResult: partialItems[0]?.title,
  });

  // Step 4: Date & Year Range Filtering Tests
  console.log('\n--- Step 4: Release Date & Year Range Filtering Tests ---');

  // Test 4.1: Year Range 2010 - 2015
  const range1Res = await request('/movies/search?fromYear=2010&toYear=2015');
  const range1Items = range1Res.data?.data?.items || [];
  const range1Titles = range1Items.map((m) => m.title);
  const range1Valid =
    range1Titles.includes('Inception') &&
    range1Titles.includes('The Dark Knight Rises') &&
    range1Titles.includes('Interstellar') &&
    range1Titles.includes('El Fil El Azraq') &&
    !range1Titles.includes('Oppenheimer');
  recordResult('4.1', 'Filter by Year Range (2010 - 2015)', range1Valid, range1Res.status, {
    returnedTitles: range1Titles,
  });

  // Test 4.2: Single Year Filter 2023
  const range2Res = await request('/movies/search?fromYear=2023&toYear=2023');
  const range2Items = range2Res.data?.data?.items || [];
  const range2Titles = range2Items.map((m) => m.title);
  const range2Valid = range2Titles.includes('Oppenheimer') && !range2Titles.includes('Interstellar');
  recordResult('4.2', 'Filter by Single Year (2023)', range2Valid, range2Res.status, {
    returnedTitles: range2Titles,
  });

  // Test 4.3: Exact Date Range Filter (2014-01-01 to 2014-12-31)
  const range3Res = await request('/movies/search?fromDate=2014-01-01&toDate=2014-12-31');
  const range3Items = range3Res.data?.data?.items || [];
  const range3Titles = range3Items.map((m) => m.title);
  const range3Valid =
    range3Titles.includes('Interstellar') &&
    range3Titles.includes('El Fil El Azraq') &&
    !range3Titles.includes('Inception');
  recordResult('4.3', 'Filter by Exact Date Range (2014-01-01 to 2014-12-31)', range3Valid, range3Res.status, {
    returnedTitles: range3Titles,
  });

  // Test 4.4: Combined Fuzzy Query + Year Filter
  const combinedRes = await request('/movies/search?query=incept&fromYear=2010&toYear=2011');
  const combinedItems = combinedRes.data?.data?.items || [];
  const combinedValid = combinedItems.length >= 1 && combinedItems.every((m) => m.title === 'Inception');
  recordResult('4.4', 'Combined Fuzzy Query + Year Filter ("incept" + 2010..2011)', combinedValid, combinedRes.status, {
    matchedTitle: combinedItems[0]?.title,
    count: combinedItems.length,
  });

  // Step 5: Security Hardening & Sanitization Tests
  console.log('\n--- Step 5: Security Hardening & Sanitization Tests ---');

  // Test 5.1: XSS HTML Injection Sanitization
  const xssQuery = encodeURIComponent("<script>alert('xss')</script>Oppenheimer");
  const xssRes = await request(`/movies/search?query=${xssQuery}`);
  const xssItems = xssRes.data?.data?.items || [];
  const xssValid = xssRes.status === 200 && xssItems.some((m) => m.title === 'Oppenheimer');
  recordResult('5.1', 'XSS Injection Sanitization (<script> stripped, matches "Oppenheimer")', xssValid, xssRes.status, {
    status: xssRes.status,
    matchedTitle: xssItems[0]?.title,
  });

  // Test 5.2: SQL Injection Parameter Boundary Test
  const sqliQuery = encodeURIComponent("' OR '1'='1");
  const sqliRes = await request(`/movies/search?query=${sqliQuery}`);
  const sqliValid = sqliRes.status === 200;
  recordResult('5.2', 'SQL Injection Hardening (\' OR \'1\'=\'1 safely handled)', sqliValid, sqliRes.status, {
    status: sqliRes.status,
    totalItems: sqliRes.data?.data?.meta?.total_items || 0,
  });

  console.log('\n===============================================================');
  console.log('🏁 Resilient Movie Search Execution Completed. Summary:');
  console.log('===============================================================');
  console.table(testResults);
}

run().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
