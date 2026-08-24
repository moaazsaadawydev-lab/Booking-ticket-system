const bcrypt = require('bcryptjs');
const axios = require('axios');
const { Client } = require('pg');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

async function seedManualAdmins() {
  const pgClient = new Client({
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

  // 1. Upsert Super Admin
  const superCheck = await pgClient.query(
    'SELECT id FROM users WHERE email = $1',
    [superAdminEmail],
  );

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
      [
        'Super Admin',
        superAdminEmail,
        passwordHash,
        'super_admin',
        'ACTIVE',
        'Egypt',
        'male',
      ],
    );
    superAdminId = res.rows[0].id;
  }

  // 2. Upsert Cinema Admin
  const cinemaCheck = await pgClient.query(
    'SELECT id FROM users WHERE email = $1',
    [cinemaAdminEmail],
  );

  let cinemaAdminId;
  if (cinemaCheck.rows.length > 0) {
    const res = await pgClient.query(
      `UPDATE users 
       SET name = $1, password = $2, role = $3, status = $4, "mustChangePassword" = false 
       WHERE email = $5 
       RETURNING id`,
      [
        'Cinema Admin',
        passwordHash,
        'cinema_admin',
        'ACTIVE',
        cinemaAdminEmail,
      ],
    );
    cinemaAdminId = res.rows[0].id;
  } else {
    const res = await pgClient.query(
      `INSERT INTO users (name, email, password, role, status, country, gender, "mustChangePassword")
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING id`,
      [
        'Cinema Admin',
        cinemaAdminEmail,
        passwordHash,
        'cinema_admin',
        'ACTIVE',
        'Egypt',
        'male',
      ],
    );
    cinemaAdminId = res.rows[0].id;
  }

  await pgClient.end();

  // 3. Authenticate via Gateway to get valid JWT Access Tokens
  let superAdminToken = '';
  let cinemaAdminToken = '';

  try {
    const superLoginRes = await axios.post(`${GATEWAY_URL}/users/auth/login`, {
      email: superAdminEmail,
      password: rawPassword,
    });
    superAdminToken =
      superLoginRes.data?.data?.accessToken ||
      superLoginRes.data?.data?.access_token ||
      superLoginRes.data?.accessToken;
  } catch (err) {
    console.error(
      'Failed to log in Super Admin:',
      err.response?.data || err.message,
    );
  }

  try {
    const cinemaLoginRes = await axios.post(`${GATEWAY_URL}/users/auth/login`, {
      email: cinemaAdminEmail,
      password: rawPassword,
    });
    cinemaAdminToken =
      cinemaLoginRes.data?.data?.accessToken ||
      cinemaLoginRes.data?.data?.access_token ||
      cinemaLoginRes.data?.accessToken;
  } catch (err) {
    console.error(
      'Failed to log in Cinema Admin:',
      err.response?.data || err.message,
    );
  }

  // 4. Output exact requested format
  console.log('================ MANUAL TESTING CREDENTIALS ================');
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
  console.log('============================================================');
}

seedManualAdmins().catch((err) => {
  console.error('Error running admin seeding script:', err);
  process.exit(1);
});
