const bcrypt = require('bcryptjs');
const axios = require('axios');
const { Pool } = require('pg');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

async function seedManualAdmins() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'Booking-Users',
  });

  const rawPassword = '624562';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(rawPassword, salt);

  const usersToSeed = [
    {
      name: 'Super Admin',
      email: 'superadmin@booking.local',
      role: 'super_admin',
    },
    {
      name: 'Platform Admin',
      email: 'admin@booking.local',
      role: 'admin',
    },
    {
      name: 'Cinema Admin',
      email: 'cinemaadmin@booking.local',
      role: 'cinema_admin',
    },
  ];

  console.log('================ MANUAL TESTING CREDENTIALS ================');

  for (const item of usersToSeed) {
    const check = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [item.email],
    );

    let userId;
    if (check.rows.length > 0) {
      const res = await pool.query(
        `UPDATE users 
         SET name = $1, password = $2, role = $3, status = $4, "mustChangePassword" = false 
         WHERE email = $5 
         RETURNING id`,
        [item.name, passwordHash, item.role, 'ACTIVE', item.email],
      );
      userId = res.rows[0].id;
    } else {
      const res = await pool.query(
        `INSERT INTO users (name, email, password, role, status, country, gender, "mustChangePassword")
         VALUES ($1, $2, $3, $4, $5, 'Egypt', 'male', false)
         RETURNING id`,
        [item.name, item.email, passwordHash, item.role, 'ACTIVE'],
      );
      userId = res.rows[0].id;
    }

    let token = '';
    try {
      const loginRes = await axios.post(`${GATEWAY_URL}/auth/login`, {
        email: item.email,
        password: rawPassword,
        clientScope: 'ADMIN_PORTAL',
      });
      token =
        loginRes.data?.data?.accessToken ||
        loginRes.data?.data?.access_token ||
        loginRes.data?.accessToken ||
        '';
    } catch (err) {
      // ignore
    }

    console.log(`[${item.role.toUpperCase()}]`);
    console.log(`ID: ${userId}`);
    console.log(`Email: ${item.email}`);
    console.log(`Password: ${rawPassword}`);
    if (token) console.log(`Bearer Token: ${token}`);
    console.log('');
  }

  console.log('============================================================');
  await pool.end();
}

seedManualAdmins().catch((err) => {
  console.error('Error running admin seeding script:', err);
  process.exit(1);
});
