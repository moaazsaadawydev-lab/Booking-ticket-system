const bcrypt = require('bcryptjs');
const axios = require('axios');
const { Pool } = require('pg');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000/api/v1';

async function seedAdmins() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'Booking-Users',
  });

  const accounts = [
    {
      name: 'System Super Admin',
      email: 'superadmin@aflamak.com',
      rawPassword: 'SuperAdmin123!',
      role: 'super_admin',
    },
    {
      name: 'Operations Admin',
      email: 'admin@aflamak.com',
      rawPassword: 'Admin123!',
      role: 'admin',
    },
  ];

  console.log('================ SEEDED ADMIN ACCOUNTS ================');

  for (const item of accounts) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(item.rawPassword, salt);

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
        password: item.rawPassword,
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
    console.log(`ID:       ${userId}`);
    console.log(`Name:     ${item.name}`);
    console.log(`Email:    ${item.email}`);
    console.log(`Password: ${item.rawPassword}`);
    if (token) console.log(`Token:    ${token}`);
    console.log('');
  }

  console.log('=======================================================');
  await pool.end();
}

seedAdmins().catch((err) => {
  console.error('Error running admin seeding script:', err);
  process.exit(1);
});
