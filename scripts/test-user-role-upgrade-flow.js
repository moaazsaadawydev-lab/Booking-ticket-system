const axios = require('axios');
const Redis = require('ioredis');
const { Client: PgClient } = require('pg');
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const dotenv = require('dotenv');
const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `libs/env/.env.${nodeEnv}`) });

const API_BASE = 'http://localhost:3000/api/v1';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

const createPgClient = (database) =>
  new PgClient({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database,
  });

const userPg = createPgClient('Booking-Users');
const bookingPg = createPgClient('Booking-Bookings');

const testMatrix = [];
function recordTest(step, name, status, details = {}) {
  testMatrix.push({ step, name, status, details });
  const icon = status === 'PASS' ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} Step ${step}: ${name}`);
  if (Object.keys(details).length > 0) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runRoleUpgradeFlowTest() {
  console.log('=================================================================================');
  console.log('🛡️ User Role Upgrade & Cinema Staff Assignment Management Test');
  console.log('=================================================================================\n');

  await userPg.connect();
  await bookingPg.connect();

  const timestamp = Date.now();
  const password = 'Password123!';
  const superEmail = `super.role.${timestamp}@test.com`;
  const adminEmail = `admin.role.${timestamp}@test.com`;
  const user1Email = `user1.role.${timestamp}@test.com`;
  const user2Email = `user2.role.${timestamp}@test.com`;
  const customerEmail = `customer.role.${timestamp}@test.com`;

  try {
    // -------------------------------------------------------------
    // Step 1: User Provisioning
    // -------------------------------------------------------------
    console.log('--- Step 1: User Provisioning ---');

    // 1.1 Super Admin
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

    // 1.2 Admin
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Branch Operations Admin',
      email: adminEmail,
      password,
      country: 'Egypt',
      gender: 'female',
    });
    const adminOtp = await getRedisOtp(adminEmail);
    if (adminOtp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: adminEmail,
        code: adminOtp,
      });
    }
    await userPg.query(
      `UPDATE users SET role = 'admin', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [adminEmail],
    );
    const adminLogin = await axios.post(`${API_BASE}/users/auth/login`, {
      email: adminEmail,
      password,
    });
    const adminToken = adminLogin.data?.data?.accessToken || adminLogin.data?.accessToken;

    // 1.3 User 1 (to be promoted to Cinema Admin)
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Candidate Cinema Manager',
      email: user1Email,
      password,
      country: 'Egypt',
      gender: 'male',
    });
    const u1Otp = await getRedisOtp(user1Email);
    if (u1Otp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: user1Email,
        code: u1Otp,
      });
    }
    await userPg.query(
      `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [user1Email],
    );
    const u1Db = await userPg.query(`SELECT id FROM users WHERE email = $1`, [user1Email]);
    const user1Id = u1Db.rows[0].id;

    // 1.4 User 2 (to be promoted to Gate Checker)
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Candidate Gate Staff',
      email: user2Email,
      password,
      country: 'Egypt',
      gender: 'male',
    });
    const u2Otp = await getRedisOtp(user2Email);
    if (u2Otp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: user2Email,
        code: u2Otp,
      });
    }
    await userPg.query(
      `UPDATE users SET status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [user2Email],
    );
    const u2Db = await userPg.query(`SELECT id FROM users WHERE email = $1`, [user2Email]);
    const user2Id = u2Db.rows[0].id;

    // 1.5 Regular Customer
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Regular Customer',
      email: customerEmail,
      password,
      country: 'Egypt',
      gender: 'female',
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

    recordTest('1.0', 'User Provisioning (Super Admin, Admin, Users, Customer)', 'PASS', {
      superEmail,
      adminEmail,
      user1Id,
      user2Id,
    });

    // -------------------------------------------------------------
    // Step 2: Catalog Cinema Setup
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Cinema Setup ---');
    const cinemaRes = await axios.post(
      `${API_BASE}/cinemas`,
      {
        name: `Mall of Arabia Megaplex - ${timestamp}`,
        city: 'Giza',
        address: '6th of October City',
        country: 'EG',
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const cinema = cinemaRes.data?.data || cinemaRes.data;

    recordTest('2.0', 'Cinema Branch Provisioned', 'PASS', {
      cinemaId: cinema.id,
      name: cinema.name,
    });

    // -------------------------------------------------------------
    // Step 3: Super Admin promoting User 1 -> CINEMA_ADMIN
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Super Admin Promotes User -> CINEMA_ADMIN ---');
    const promote1Res = await axios.patch(
      `${API_BASE}/users/${user1Id}/role`,
      {
        role: 'cinema_admin',
        cinemaId: cinema.id,
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const promote1Data = promote1Res.data?.data || promote1Res.data;

    const u1DbCheck = await userPg.query(`SELECT id, role, "cinemaId" FROM users WHERE id = $1`, [user1Id]);
    const u1Updated = u1DbCheck.rows[0];

    if (
      promote1Res.status === 200 &&
      u1Updated.role === 'cinema_admin' &&
      u1Updated.cinemaId === cinema.id
    ) {
      recordTest('3.0', 'Super Admin Promoted User to CINEMA_ADMIN with Cinema ID', 'PASS', {
        userId: user1Id,
        newRole: u1Updated.role,
        cinemaId: u1Updated.cinemaId,
        apiMessage: promote1Data.message,
      });
    } else {
      recordTest('3.0', 'Super Admin Promoted User to CINEMA_ADMIN with Cinema ID', 'FAIL', {
        apiData: promote1Data,
        dbRecord: u1Updated,
      });
    }

    // -------------------------------------------------------------
    // Step 4: Admin promoting User 2 -> GATE_CHECKER
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Admin Promotes User -> GATE_CHECKER ---');
    const promote2Res = await axios.patch(
      `${API_BASE}/users/${user2Id}/role`,
      {
        role: 'gate_checker',
        cinemaId: cinema.id,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const promote2Data = promote2Res.data?.data || promote2Res.data;

    const u2DbCheck = await userPg.query(`SELECT id, role, "cinemaId" FROM users WHERE id = $1`, [user2Id]);
    const u2Updated = u2DbCheck.rows[0];

    if (
      promote2Res.status === 200 &&
      u2Updated.role === 'gate_checker' &&
      u2Updated.cinemaId === cinema.id
    ) {
      recordTest('4.0', 'Admin Promoted User to GATE_CHECKER with Cinema ID', 'PASS', {
        userId: user2Id,
        newRole: u2Updated.role,
        cinemaId: u2Updated.cinemaId,
        apiMessage: promote2Data.message,
      });
    } else {
      recordTest('4.0', 'Admin Promoted User to GATE_CHECKER with Cinema ID', 'FAIL', {
        apiData: promote2Data,
        dbRecord: u2Updated,
      });
    }

    // -------------------------------------------------------------
    // Step 5: RBAC Guard Check (Regular Customer Unauthorized)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Regular Customer Blocked by RolesGuard ---');
    try {
      await axios.patch(
        `${API_BASE}/users/${user2Id}/role`,
        {
          role: 'admin',
        },
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      recordTest('5.0', 'Regular Customer Calling Role Endpoint (403 Forbidden)', 'FAIL', {
        reason: 'Customer was allowed to upgrade role',
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 403) {
        recordTest('5.0', 'Regular Customer Calling Role Endpoint (403 Forbidden)', 'PASS', {
          httpStatus: status,
          errorMessage: message,
        });
      } else {
        recordTest('5.0', 'Regular Customer Calling Role Endpoint (403 Forbidden)', 'FAIL', {
          httpStatus: status,
          errorMessage: message,
        });
      }
    }

    // -------------------------------------------------------------
    // Step 6: Hierarchical Privilege Check (Admin cannot elevate to SUPER_ADMIN)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Admin Elevation to SUPER_ADMIN Blocked ---');
    try {
      await axios.patch(
        `${API_BASE}/users/${user2Id}/role`,
        {
          role: 'super_admin',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      recordTest('6.0', 'Admin Elevating User to SUPER_ADMIN (403 Forbidden)', 'FAIL', {
        reason: 'Admin was allowed to create Super Admin',
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 403 && message.toLowerCase().includes('cannot elevate')) {
        recordTest('6.0', 'Admin Elevating User to SUPER_ADMIN (403 Forbidden)', 'PASS', {
          httpStatus: status,
          errorMessage: message,
        });
      } else {
        recordTest('6.0', 'Admin Elevating User to SUPER_ADMIN (403 Forbidden)', 'FAIL', {
          httpStatus: status,
          errorMessage: message,
        });
      }
    }

    // -------------------------------------------------------------
    // Step 7: Branch Staff Validation (Missing cinemaId for branch role)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Missing Cinema ID on Branch Role Blocked ---');
    try {
      await axios.patch(
        `${API_BASE}/users/${user2Id}/role`,
        {
          role: 'staff',
        },
        { headers: { Authorization: `Bearer ${superToken}` } },
      );
      recordTest('7.0', 'Missing cinemaId on Branch Role (400 Bad Request)', 'FAIL', {
        reason: 'Staff role accepted without cinemaId',
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 400 && message.toLowerCase().includes('cinemaid is required')) {
        recordTest('7.0', 'Missing cinemaId on Branch Role (400 Bad Request)', 'PASS', {
          httpStatus: status,
          errorMessage: message,
        });
      } else {
        recordTest('7.0', 'Missing cinemaId on Branch Role (400 Bad Request)', 'FAIL', {
          httpStatus: status,
          errorMessage: message,
        });
      }
    }

    // -------------------------------------------------------------
    // Step 8: Promoted User Authenticates & Accesses Gate Scanner
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Promoted User Authenticates & Uses Gate Scanner ---');
    const promotedLogin = await axios.post(`${API_BASE}/users/auth/login`, {
      email: user2Email,
      password,
    });
    const promotedToken =
      promotedLogin.data?.data?.accessToken || promotedLogin.data?.accessToken;

    const decodedToken = jwt.decode(promotedToken);

    // Create a mock signed ticket JWT to test gate scanner with promoted user
    const ticketId = '11111111-2222-3333-4444-555555555555';
    const jwtSecret =
      process.env.TICKET_JWT_SECRET ||
      process.env.JWT_SECRET ||
      'ticket-jwt-secret-key-12345';

    // Insert a valid ticket in DB for scanning
    const bookingRes = await bookingPg.query(
      `INSERT INTO bookings (id, booking_reference, user_id, showtime_id, cinema_id, auditorium_id, total_amount, currency, status, hold_expires_at)
       VALUES ('11111111-1111-1111-1111-111111111111', 'BK-STAFF-01', $1, '22222222-2222-2222-2222-222222222222', $2, '33333333-3333-3333-3333-333333333333', 150, 'EGP', 'CONFIRMED', NOW() + interval '1 day')
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [user2Id, cinema.id],
    );

    const testTokenPayload = {
      sub: ticketId,
      bookingId: '11111111-1111-1111-1111-111111111111',
      showtimeId: '22222222-2222-2222-2222-222222222222',
      cinemaId: cinema.id,
      auditoriumId: '33333333-3333-3333-3333-333333333333',
      seatNumber: 'B-4',
      type: 'TICKET_QR',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const testQrToken = jwt.sign(testTokenPayload, jwtSecret);

    await bookingPg.query(
      `INSERT INTO tickets (id, booking_id, seat_id, ticket_number, qr_code_token, status)
       VALUES ($1, '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'TKT-2026-STAFF01', $2, 'ISSUED')
       ON CONFLICT (id) DO UPDATE SET status = 'ISSUED', used_at = NULL, scanned_by_user_id = NULL`,
      [ticketId, testQrToken],
    );

    const gateScanRes = await axios.post(
      `${API_BASE}/tickets/validate`,
      {
        qrToken: testQrToken,
        gateCinemaId: cinema.id,
      },
      { headers: { Authorization: `Bearer ${promotedToken}` } },
    );
    const gateScanData = gateScanRes.data?.data || gateScanRes.data;

    if (
      gateScanRes.status === 200 &&
      gateScanData.valid === true &&
      decodedToken.role === 'gate_checker' &&
      decodedToken.cinemaId === cinema.id
    ) {
      recordTest('8.0', 'Promoted Gate Checker Authenticates & Executes Valid Ticket Scan', 'PASS', {
        promotedUser: user2Email,
        jwtRoleClaim: decodedToken.role,
        jwtCinemaIdClaim: decodedToken.cinemaId,
        scanStatus: gateScanData.status,
        scannedBy: gateScanData.scannedBy,
      });
    } else {
      recordTest('8.0', 'Promoted Gate Checker Authenticates & Executes Valid Ticket Scan', 'FAIL', {
        decodedToken,
        gateScanData,
      });
    }
  } catch (err) {
    console.error('❌ Test execution error:', err.response?.data || err.message);
    recordTest('ERR', 'Test Execution Failure', 'FAIL', {
      error: err.response?.data || err.message,
    });
  } finally {
    await userPg.end();
    await bookingPg.end();
    await redis.quit();
  }

  // -------------------------------------------------------------
  // Summary Matrix
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 USER ROLE UPGRADE & STAFF ASSIGNMENT MATRIX');
  console.log('=================================================================================');
  console.table(
    testMatrix.map((t) => ({
      Step: t.step,
      Name: t.name,
      Status: t.status,
    })),
  );

  const passed = testMatrix.filter((t) => t.status === 'PASS').length;
  const failed = testMatrix.filter((t) => t.status === 'FAIL').length;
  console.log(`\nTOTAL: ${testMatrix.length} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed === 0) {
    console.log('🎉 ALL USER ROLE UPGRADE & STAFF ASSIGNMENT TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runRoleUpgradeFlowTest();
