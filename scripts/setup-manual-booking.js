const axios = require('axios');
const Redis = require('ioredis');
const { Client: PgClient } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `libs/env/.env.${nodeEnv}`) });

const API_BASE = 'http://localhost:3000/api/v1';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

const userPg = new PgClient({
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 5433,
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '624562',
  database: 'Booking-Users',
});

async function getRedisOtp(email) {
  const keys = await redis.keys(`*${email}*`);
  for (const k of keys) {
    const val = await redis.get(k);
    if (val && /^\d{4,6}$/.test(val.trim())) {
      return val.trim();
    }
  }
  return null;
}

async function setupManualBooking() {
  console.log('=================================================================================');
  console.log('🎬 Setting Up Fresh Pending Booking for Manual Postman Testing');
  console.log('=================================================================================\n');

  await userPg.connect();

  const password = 'Password123!';
  const superEmail = `admin@booking.local`;
  const customerEmail = `customer@booking.local`;
  const customerPhone = '+201012345678';
  const customerName = 'Moaz Saadawy';

  try {
    // -------------------------------------------------------------
    // Step 1: Provision Super Admin
    // -------------------------------------------------------------
    console.log('1️⃣ Provisioning Super Admin...');
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Super Admin',
      email: superEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    });

    const superOtp = await getRedisOtp(superEmail);
    if (superOtp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: superEmail,
        code: superOtp,
      });
    }

    await userPg.query(
      `UPDATE users SET role = 'super_admin', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [superEmail],
    );

    const superLogin = await axios.post(`${API_BASE}/users/auth/login`, {
      email: superEmail,
      password,
    });
    const superToken = superLogin.data?.data?.accessToken || superLogin.data?.accessToken;
    console.log('   ✅ Super Admin Ready');

    // -------------------------------------------------------------
    // Step 2: Provision Customer User
    // -------------------------------------------------------------
    console.log('\n2️⃣ Provisioning Verified Customer User...');
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: customerName,
      email: customerEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    });

    const custOtp = await getRedisOtp(customerEmail);
    if (custOtp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: customerEmail,
        code: custOtp,
      });
    }

    await userPg.query(
      `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [customerEmail],
    );

    const custLogin = await axios.post(`${API_BASE}/users/auth/login`, {
      email: customerEmail,
      password,
    });
    const customerToken = custLogin.data?.data?.accessToken || custLogin.data?.accessToken;
    const customerUserId = custLogin.data?.data?.user?.id || custLogin.data?.user?.id;
    console.log('   ✅ Customer User Ready');

    // -------------------------------------------------------------
    // Step 3: Create Catalog (Movie, Cinema, Auditorium, Showtime)
    // -------------------------------------------------------------
    console.log('\n3️⃣ Setting Up Catalog & Showtimes...');
    const movieRes = await axios.post(
      `${API_BASE}/movies`,
      {
        title: 'Inception: Special 4K Re-Release',
        description: 'A thief who steals corporate secrets through the use of dream-sharing technology.',
        durationMinutes: 148,
        releaseDate: '2026-09-01',
        ageRating: 'PG_13',
        status: 'NOW_SHOWING',
        countryOfOrigin: 'US',
        originalLanguage: 'en',
        spokenLanguages: ['en'],
        subtitles: ['ar'],
        posterUrl: 'https://image.tmdb.org/t/p/w500/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const movie = movieRes.data?.data || movieRes.data;

    const cinemaRes = await axios.post(
      `${API_BASE}/cinemas`,
      {
        name: 'Grand Stars Cinema - Mall of Arabia',
        city: '6th of October, Cairo',
        address: 'Juhayna Square, Mall of Arabia, Gate 4',
        country: 'EG',
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const cinema = cinemaRes.data?.data || cinemaRes.data;

    const auditoriumRes = await axios.post(
      `${API_BASE}/cinemas/${cinema.id}/auditoriums`,
      {
        name: 'IMAX VIP Hall 1',
        experienceType: 'STANDARD_2D',
        totalRows: 3,
        totalColumns: 6,
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const auditorium = auditoriumRes.data?.data || auditoriumRes.data;

    const seatsRes = await axios.get(`${API_BASE}/seats/auditorium/${auditorium.id}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const seats = seatsRes.data?.data?.seats || seatsRes.data?.seats || [];
    const chosenSeat = seats[0];

    const showtimeRes = await axios.post(
      `${API_BASE}/showtimes`,
      {
        movieId: movie.id,
        auditoriumId: auditorium.id,
        startTime: '2026-12-25T20:00:00.000Z',
        endTime: '2026-12-25T22:30:00.000Z',
        experienceType: 'STANDARD_2D',
        basePrice: 150,
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const showtime = showtimeRes.data?.data || showtimeRes.data;
    console.log('   ✅ Movie, Cinema, Auditorium, and Showtime Created');

    // -------------------------------------------------------------
    // Step 4: Hold Seats to Create Pending Booking
    // -------------------------------------------------------------
    console.log('\n4️⃣ Creating Pending Seat Hold Booking...');
    const holdRes = await axios.post(
      `${API_BASE}/bookings/hold`,
      {
        showtimeId: showtime.id,
        seatIds: [chosenSeat.id],
      },
      { headers: { Authorization: `Bearer ${customerToken}` } },
    );
    const booking = holdRes.data?.data?.booking || holdRes.data?.booking;

    console.log('\n=================================================================================');
    console.log('🎉 FRESH PENDING BOOKING CREATED SUCCESSFULLY FOR POSTMAN TESTING!');
    console.log('=================================================================================\n');

    console.log('📋 --- CUSTOMER CREDENTIALS & AUTH TOKEN ---');
    console.log(`Email:       ${customerEmail}`);
    console.log(`Password:    ${password}`);
    console.log(`User ID:     ${customerUserId}`);
    console.log(`\n🔑 JWT Bearer Token:`);
    console.log(`${customerToken}\n`);

    console.log('🎟️ --- BOOKING DETAILS ---');
    console.log(`Booking ID:         ${booking.id}`);
    console.log(`Booking Reference:  ${booking.bookingReference || booking.booking_reference || 'N/A'}`);
    console.log(`Status:             ${booking.status}`);
    console.log(`Total Amount:       ${booking.totalAmount || booking.total_amount || 150.00} EGP`);
    console.log(`Showtime ID:        ${showtime.id}`);
    console.log(`Movie:              ${movie.title}`);
    console.log(`Seat:               Row ${chosenSeat.row || chosenSeat.rowNumber || 'A'}, Seat ${chosenSeat.number || chosenSeat.seatNumber || '1'} (${chosenSeat.id})\n`);

    console.log('🚀 --- POSTMAN MANUAL TEST INSTRUCTIONS ---');
    console.log(`Endpoint:  POST http://localhost:3000/api/v1/payments/initiate`);
    console.log(`Headers:   Authorization: Bearer ${customerToken}`);
    console.log(`           Content-Type: application/json`);
    console.log(`Body (JSON):`);
    console.log(
      JSON.stringify(
        {
          bookingId: booking.id,
          amount: Number(booking.totalAmount || booking.total_amount || 150.00),
          currency: 'EGP',
          method: 'CARD',
          billingData: {
            first_name: 'Moaz',
            last_name: 'Saadawy',
            email: customerEmail,
            phone_number: customerPhone,
            city: 'Cairo',
            country: 'EG',
          },
        },
        null,
        2,
      ),
    );
    console.log('\n=================================================================================\n');
  } catch (err) {
    console.error('❌ Setup Error:', err.response?.data || err.message);
  } finally {
    await userPg.end();
    await redis.quit();
  }
}

setupManualBooking();
