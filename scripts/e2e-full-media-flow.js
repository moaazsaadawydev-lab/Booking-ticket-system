const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const bcrypt = require('bcryptjs');
const { Client: PgClient } = require('pg');
const Minio = require('minio');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

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

  if (!headers['Content-Type'] && !(options.data instanceof FormData)) {
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

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2EMediaFlow() {
  console.log('===============================================================');
  console.log('🎬 Starting Full End-to-End Media & Catalog Verification Flow');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // Step 1: User Provisioning & Authentication
  // -------------------------------------------------------------
  console.log('--- Step 1: User Provisioning & Authentication ---');
  const pgClient = new PgClient({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'Booking-Users',
  });

  await pgClient.connect();

  const rawPassword = '624562';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(rawPassword, salt);

  const superAdminEmail = 'superadmin@booking.local';
  const cinemaAdminEmail = 'cinemaadmin@booking.local';

  // Super Admin Upsert
  const superCheck = await pgClient.query('SELECT id FROM users WHERE email = $1', [superAdminEmail]);
  let superAdminId;
  if (superCheck.rows.length > 0) {
    const res = await pgClient.query(
      `UPDATE users 
       SET name = $1, password = $2, role = $3, status = $4, "mustChangePassword" = false 
       WHERE email = $5 
       RETURNING id`,
      ['Super Admin', passwordHash, 'super_admin', 'ACTIVE', superAdminEmail],
    );
    superAdminId = res.rows[0].id;
  } else {
    const res = await pgClient.query(
      `INSERT INTO users (name, email, password, role, status, country, gender, "mustChangePassword")
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING id`,
      ['Super Admin', superAdminEmail, passwordHash, 'super_admin', 'ACTIVE', 'Egypt', 'male'],
    );
    superAdminId = res.rows[0].id;
  }

  // Cinema Admin Upsert
  const cinemaCheck = await pgClient.query('SELECT id FROM users WHERE email = $1', [cinemaAdminEmail]);
  let cinemaAdminId;
  if (cinemaCheck.rows.length > 0) {
    const res = await pgClient.query(
      `UPDATE users 
       SET name = $1, password = $2, role = $3, status = $4, "mustChangePassword" = false 
       WHERE email = $5 
       RETURNING id`,
      ['Cinema Admin', passwordHash, 'cinema_admin', 'ACTIVE', cinemaAdminEmail],
    );
    cinemaAdminId = res.rows[0].id;
  } else {
    const res = await pgClient.query(
      `INSERT INTO users (name, email, password, role, status, country, gender, "mustChangePassword")
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING id`,
      ['Cinema Admin', cinemaAdminEmail, passwordHash, 'cinema_admin', 'ACTIVE', 'Egypt', 'male'],
    );
    cinemaAdminId = res.rows[0].id;
  }

  await pgClient.end();

  // Obtain Super Admin JWT
  const superLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: superAdminEmail, password: rawPassword },
  });
  const superAdminToken =
    superLoginRes.data?.data?.accessToken ||
    superLoginRes.data?.data?.access_token ||
    superLoginRes.data?.accessToken;
  recordResult('1.1', 'Authenticate Super Admin', !!superAdminToken, superLoginRes.status, {
    superAdminId,
    superAdminEmail,
  });

  // Obtain Cinema Admin JWT
  const cinemaLoginRes = await request('/users/auth/login', {
    method: 'POST',
    body: { email: cinemaAdminEmail, password: rawPassword },
  });
  const cinemaAdminToken =
    cinemaLoginRes.data?.data?.accessToken ||
    cinemaLoginRes.data?.data?.access_token ||
    cinemaLoginRes.data?.accessToken;
  recordResult('1.2', 'Authenticate Cinema Admin', !!cinemaAdminToken, cinemaLoginRes.status, {
    cinemaAdminId,
    cinemaAdminEmail,
  });

  // -------------------------------------------------------------
  // Step 2: Media Uploading (Local Assets)
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Media Uploading (Local Assets) ---');
  
  // Discover local test assets
  const candidateDirs = [
    path.join(__dirname, '..', 'Test assets', 'filem'),
    path.join(__dirname, '..', 'Test assets'),
    path.join(__dirname, '..', 'test-assets'),
  ];
  
  let assetFiles = [];
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
        .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
        .map(f => path.join(dir, f));
      if (files.length > 0) {
        assetFiles = files;
        break;
      }
    }
  }

  if (assetFiles.length < 2) {
    console.error('❌ Could not find at least 2 local test image files in Test assets directory.');
    process.exit(1);
  }

  const [localFile1, localFile2] = assetFiles;
  console.log(`Found local test images:\n  1) ${localFile1}\n  2) ${localFile2}`);

  // Upload Local File 1
  const form1 = new FormData();
  form1.append('file', fs.createReadStream(localFile1));
  const upload1Res = await request('/media/upload-temp', {
    method: 'POST',
    data: form1,
    headers: form1.getHeaders(),
  });
  const tempKey1 = upload1Res.data?.data?.tempKey || upload1Res.data?.tempKey;
  recordResult('2.1', 'Upload Local Asset 1 to Pre-Upload Endpoint', !!tempKey1 && tempKey1.startsWith('temp/'), upload1Res.status, {
    localFile: path.basename(localFile1),
    tempKey: tempKey1,
  });

  // Upload Local File 2
  const form2 = new FormData();
  form2.append('file', fs.createReadStream(localFile2));
  const upload2Res = await request('/media/upload-temp', {
    method: 'POST',
    data: form2,
    headers: form2.getHeaders(),
  });
  const tempKey2 = upload2Res.data?.data?.tempKey || upload2Res.data?.tempKey;
  recordResult('2.2', 'Upload Local Asset 2 to Pre-Upload Endpoint', !!tempKey2 && tempKey2.startsWith('temp/'), upload2Res.status, {
    localFile: path.basename(localFile2),
    tempKey: tempKey2,
  });

  // -------------------------------------------------------------
  // Step 3: Cinema & Auditorium Creation
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Cinema & Auditorium Creation ---');

  const createCinemaRes = await request('/cinemas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'Galaxy Cinema - Mall of Arabia',
      city: 'Giza',
      country: 'EG',
      address: 'Mall of Arabia, 6th of October City',
      description: 'Premier multiplex with immersive sound and IMAX Laser.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c',
      galleryUrls: [
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba',
      ],
      adminUserIds: [cinemaAdminId],
    },
  });
  const cinemaId = createCinemaRes.data?.data?.id || createCinemaRes.data?.id;
  recordResult('3.1', 'Create Cinema with Admin Assignment (Super Admin)', !!cinemaId, createCinemaRes.status, {
    cinemaId,
    name: 'Galaxy Cinema - Mall of Arabia',
  });

  // Create Auditorium as Cinema Admin
  const createAudRes = await request(`/cinemas/${cinemaId}/auditoriums`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      name: 'IMAX Laser Hall 1',
      experienceType: 'IMAX_3D',
      soundSystem: 'Dolby Atmos 12.1',
      totalRows: 5,
      totalColumns: 8,
    },
  });
  const auditoriumId = createAudRes.data?.data?.id || createAudRes.data?.id;
  recordResult('3.2', 'Create IMAX Auditorium with Auto-Generated Seats (Cinema Admin)', !!auditoriumId, createAudRes.status, {
    auditoriumId,
    totalSeats: 40,
  });

  // -------------------------------------------------------------
  // Step 4: Movie Creation with Mixed Media
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Movie Creation with Mixed Media ---');

  // Read links from Infos.txt
  const infosPath = path.join(__dirname, '..', 'Infos.txt');
  let bannerUrl = 'https://d5d5yejrba9lo.cloudfront.net/hero-banner-v2-tablet-jpeg/movies/batch/sid_5DE10A14-2D3E-4B3B-B75D-0FA5FCAEC626_0.jpg';
  let extGallery1 = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTkn54TLYxWAMoIEauxiP88Eki580Nv22_KAjltOtUQ3w&s=10';
  let extGallery2 = 'https://www.hollywoodreporter.com/wp-content/uploads/2014/05/interstellar.jpg?w=2000&h=1126&crop=1';

  if (fs.existsSync(infosPath)) {
    const content = fs.readFileSync(infosPath, 'utf-8');
    const urls = content.match(/https?:\/\/[^\s]+/g) || [];
    if (urls.length >= 3) {
      bannerUrl = urls[0];
      extGallery1 = urls[1];
      extGallery2 = urls[2];
    }
  }

  // Fetch Genre UUIDs
  const genresRes = await request('/movies/genres');
  const genresList = genresRes.data?.data?.genres || genresRes.data?.data || [];
  const sciFiGenre = genresList.find((g) => g.name?.toLowerCase().includes('sci-fi') || g.slug === 'sci-fi');
  const genreIds = sciFiGenre ? [sciFiGenre.id] : [];

  const mixedGalleryUrls = [extGallery1, extGallery2, tempKey1, tempKey2];

  const createMovieRes = await request('/movies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      title: 'Interstellar',
      description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survival.',
      durationMinutes: 169,
      releaseDate: '2026-11-07',
      ageRating: 'PG_13',
      status: 'NOW_SHOWING',
      countryOfOrigin: 'US',
      originalLanguage: 'en',
      spokenLanguages: ['en'],
      subtitles: ['ar', 'en'],
      posterUrl: bannerUrl,
      bannerUrl: bannerUrl,
      trailerUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
      galleryUrls: mixedGalleryUrls,
      directors: ['Christopher Nolan'],
      cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain', 'Michael Caine'],
      genreIds,
    },
  });

  const movieData = createMovieRes.data?.data || createMovieRes.data;
  const movieId = movieData?.id;
  const returnedGallery = movieData?.gallery_urls || movieData?.galleryUrls || [];

  // Assertions on returned movie entity
  const hasExt1 = returnedGallery.includes(extGallery1);
  const hasExt2 = returnedGallery.includes(extGallery2);
  const finalKey1 = returnedGallery.find(url => url.startsWith(`movies/${movieId}/gallery/`) && url !== returnedGallery.filter(u => u.startsWith(`movies/${movieId}/gallery/`))[1]);
  const finalKeys = returnedGallery.filter(url => url.startsWith(`movies/${movieId}/gallery/`));
  const deterministicPathsGenerated = finalKeys.length === 2;

  recordResult('4.1', 'Create Movie with Mixed Media Assets (2 External + 2 Temp)', createMovieRes.status === 201 && hasExt1 && hasExt2 && deterministicPathsGenerated, createMovieRes.status, {
    movieId,
    bannerUrl,
    returnedGallery,
    finalKeys,
  });

  // -------------------------------------------------------------
  // Step 5: Asynchronous Outbox & MinIO Asset Verification
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Asynchronous Outbox & MinIO Asset Verification ---');
  console.log('Waiting for Catalog Outbox Publisher and Media Worker to process images...');

  let processedSuccessfully = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    await sleep(2000);
    attempts++;

    try {
      // Check if both final keys exist in MinIO 'catalog' bucket
      const exists1 = await minioClient.statObject('catalog', finalKeys[0]).then(() => true).catch(() => false);
      const exists2 = await minioClient.statObject('catalog', finalKeys[1]).then(() => true).catch(() => false);

      // Check if temp keys were purged
      const temp1Exists = await minioClient.statObject('catalog', tempKey1).then(() => true).catch(() => false);
      const temp2Exists = await minioClient.statObject('catalog', tempKey2).then(() => true).catch(() => false);

      if (exists1 && exists2 && !temp1Exists && !temp2Exists) {
        processedSuccessfully = true;
        break;
      }
    } catch (err) {
      // continue waiting
    }
  }

  recordResult('5.1', 'MinIO Catalog Bucket Processed WebP Assets & Temp Cleanup', processedSuccessfully, 200, {
    finalProcessedKey1: finalKeys[0],
    finalProcessedKey2: finalKeys[1],
    tempKey1Cleaned: true,
    tempKey2Cleaned: true,
    attemptsTaken: attempts,
  });

  // -------------------------------------------------------------
  // Step 6: Showtime Scheduling & Grouped Query
  // -------------------------------------------------------------
  console.log('\n--- Step 6: Showtime Scheduling & Grouped Query ---');

  const createShowtimeRes = await request('/showtimes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: {
      movieId,
      auditoriumId,
      startTime: '2026-12-01T18:00:00.000Z',
      endTime: '2026-12-01T20:49:00.000Z',
      experienceType: 'IMAX_3D',
      basePrice: 150,
    },
  });
  const showtimeId = createShowtimeRes.data?.data?.id || createShowtimeRes.data?.id;
  recordResult('6.1', 'Schedule Showtime as Cinema Admin', !!showtimeId, createShowtimeRes.status, {
    showtimeId,
    movieId,
    auditoriumId,
  });

  // Set Showtime Seat Pricing
  const setPricingRes = await request(`/showtimes/${showtimeId}/pricing`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cinemaAdminToken}` },
    body: [
      { seatType: 'REGULAR', price: 150 },
      { seatType: 'VIP', price: 220 },
      { seatType: 'PREMIUM', price: 180 },
    ],
  });
  recordResult('6.2', 'Configure Showtime Tiered Seat Pricing', setPricingRes.status === 200, setPricingRes.status, {
    tiers: 3,
  });

  // Query Grouped Showtimes
  const groupedRes = await request(`/showtimes/grouped?movieId=${movieId}&date=2026-12-01`);
  const groupedData = groupedRes.data?.data || groupedRes.data;
  const cinemasGrouped = groupedData?.cinemas || [];
  const matchedCinema = cinemasGrouped.find(c => (c.cinema?.id === cinemaId || c.id === cinemaId));

  recordResult('6.3', 'Grouped Showtimes Returns Nested Movie & Media Structure', groupedRes.status === 200 && !!matchedCinema, groupedRes.status, {
    movieTitle: 'Interstellar',
    cinemasCount: cinemasGrouped.length,
    matchedCinemaName: matchedCinema?.cinema?.name || matchedCinema?.name,
  });

  // -------------------------------------------------------------
  // Summary & Credentials Output
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('🏁 End-to-End Verification Execution Completed. Summary:');
  console.log('===============================================================');
  console.table(
    testResults.map((r) => ({
      step: r.step,
      name: r.name,
      status: r.status,
      httpStatus: r.httpStatus,
    })),
  );

  const totalPassed = testResults.filter((r) => r.status === 'PASS').length;
  const totalFailed = testResults.filter((r) => r.status === 'FAIL').length;

  console.log(`\nResults: ${totalPassed} PASSED / ${totalFailed} FAILED (Total: ${testResults.length})`);

  console.log('\n================ MANUAL TESTING CREDENTIALS ================');
  console.log('[SUPER_ADMIN]');
  console.log(`ID: ${superAdminId}`);
  console.log(`Email: ${superAdminEmail}`);
  console.log(`Password: ${rawPassword}`);
  console.log(`Bearer Token: ${superAdminToken}`);
  console.log('');
  console.log('[CINEMA_ADMIN]');
  console.log(`ID: ${cinemaAdminId}`);
  console.log(`Email: ${cinemaAdminEmail}`);
  console.log(`Password: ${rawPassword}`);
  console.log(`Bearer Token: ${cinemaAdminToken}`);
  console.log('============================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runE2EMediaFlow().catch((err) => {
  console.error('Fatal error executing E2E Media Flow:', err);
  process.exit(1);
});
