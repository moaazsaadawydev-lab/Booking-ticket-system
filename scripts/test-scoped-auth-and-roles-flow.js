const axios = require('axios');
const Redis = require('ioredis');
const { Client: PgClient } = require('pg');
const jwt = require('jsonwebtoken');
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

async function runScopedAuthAndRolesTest() {
  console.log('=================================================================================');
  console.log('🛡️ User Role Promotion & Scoped Authentication (clientScope) Test');
  console.log('=================================================================================\n');

  await userPg.connect();

  const timestamp = Date.now();
  const password = 'Password123!';
  const superEmail = `super.scope.${timestamp}@test.com`;
  const adminEmail = `admin.scope.${timestamp}@test.com`;
  const customerEmail = `customer.scope.${timestamp}@test.com`;
  const candidateEmail = `candidate.scope.${timestamp}@test.com`;

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
    const superLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: superEmail,
      password,
      clientScope: 'ADMIN_PORTAL',
    });
    const superToken =
      superLogin.data?.data?.accessToken || superLogin.data?.accessToken;

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
    const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: adminEmail,
      password,
      clientScope: 'ADMIN_PORTAL',
    });
    const adminToken =
      adminLogin.data?.data?.accessToken || adminLogin.data?.accessToken;

    // 1.3 Regular Customer
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Standard Customer',
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
      `UPDATE users SET role = 'user', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [customerEmail],
    );

    // 1.4 Candidate User (to be promoted to Cinema Admin)
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Candidate Branch Manager',
      email: candidateEmail,
      password,
      country: 'Egypt',
      gender: 'male',
    });
    const candOtp = await getRedisOtp(candidateEmail);
    if (candOtp) {
      await axios.post(`${API_BASE}/users/auth/verify-email`, {
        email: candidateEmail,
        code: candOtp,
      });
    }
    await userPg.query(
      `UPDATE users SET role = 'user', status = 'ACTIVE', "mustChangePassword" = false WHERE email = $1`,
      [candidateEmail],
    );
    const candDb = await userPg.query(
      `SELECT id FROM users WHERE email = $1`,
      [candidateEmail],
    );
    const candidateUserId = candDb.rows[0].id;

    recordTest(
      '1.0',
      'User Provisioning (Super Admin, Admin, Customer, Candidate)',
      'PASS',
      {
        superEmail,
        adminEmail,
        customerEmail,
        candidateEmail,
        candidateUserId,
      },
    );

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
    // Step 3: Standard USER Login with clientScope: ADMIN_PORTAL (Rejected)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Customer Blocked from ADMIN_PORTAL ---');
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: customerEmail,
        password,
        clientScope: 'ADMIN_PORTAL',
      });
      recordTest(
        '3.0',
        'Standard Customer Login to ADMIN_PORTAL (403 Forbidden)',
        'FAIL',
        {
          reason: 'Customer was allowed to log in to ADMIN_PORTAL',
        },
      );
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (
        status === 403 &&
        message.toLowerCase().includes('staff or admin role required')
      ) {
        recordTest(
          '3.0',
          'Standard Customer Login to ADMIN_PORTAL (403 Forbidden)',
          'PASS',
          {
            httpStatus: status,
            errorMessage: message,
          },
        );
      } else {
        recordTest(
          '3.0',
          'Standard Customer Login to ADMIN_PORTAL (403 Forbidden)',
          'FAIL',
          {
            httpStatus: status,
            errorMessage: message,
          },
        );
      }
    }

    // -------------------------------------------------------------
    // Step 4: Standard USER Login with clientScope: CLIENT_WEB (Success)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Customer Login with CLIENT_WEB ---');
    const webLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: customerEmail,
      password,
      clientScope: 'CLIENT_WEB',
    });
    const webLoginData = webLoginRes.data?.data || webLoginRes.data;
    const webDecoded = jwt.decode(webLoginData.accessToken);

    if (
      webLoginRes.status === 200 &&
      webDecoded.role === 'user' &&
      webDecoded.scope === 'CLIENT_WEB'
    ) {
      recordTest('4.0', 'Standard Customer Login to CLIENT_WEB (200 OK)', 'PASS', {
        userRole: webDecoded.role,
        tokenScope: webDecoded.scope,
        hasAccessToken: !!webLoginData.accessToken,
      });
    } else {
      recordTest('4.0', 'Standard Customer Login to CLIENT_WEB (200 OK)', 'FAIL', {
        webLoginData,
        webDecoded,
      });
    }

    // -------------------------------------------------------------
    // Step 5: Super Admin Promotes Candidate -> CINEMA_ADMIN
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Super Admin Promotes Candidate -> CINEMA_ADMIN ---');
    const promoteRes = await axios.patch(
      `${API_BASE}/users/${candidateUserId}/role`,
      {
        role: 'cinema_admin',
        cinemaId: cinema.id,
      },
      { headers: { Authorization: `Bearer ${superToken}` } },
    );
    const promoteData = promoteRes.data?.data || promoteRes.data;

    const candDbCheck = await userPg.query(
      `SELECT id, role, "cinemaId" FROM users WHERE id = $1`,
      [candidateUserId],
    );
    const candUpdated = candDbCheck.rows[0];

    if (
      promoteRes.status === 200 &&
      candUpdated.role === 'cinema_admin' &&
      candUpdated.cinemaId === cinema.id
    ) {
      recordTest('5.0', 'Super Admin Promoted User to CINEMA_ADMIN with Cinema ID', 'PASS', {
        userId: candidateUserId,
        role: candUpdated.role,
        cinemaId: candUpdated.cinemaId,
        message: promoteData.message,
      });
    } else {
      recordTest('5.0', 'Super Admin Promoted User to CINEMA_ADMIN with Cinema ID', 'FAIL', {
        promoteData,
        candUpdated,
      });
    }

    // -------------------------------------------------------------
    // Step 6: Promoted CINEMA_ADMIN Login with clientScope: ADMIN_PORTAL (Success)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Promoted CINEMA_ADMIN Login with ADMIN_PORTAL ---');
    const adminPortalLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: candidateEmail,
      password,
      clientScope: 'ADMIN_PORTAL',
    });
    const adminPortalData =
      adminPortalLogin.data?.data || adminPortalLogin.data;
    const adminPortalDecoded = jwt.decode(adminPortalData.accessToken);

    if (
      adminPortalLogin.status === 200 &&
      adminPortalDecoded.role === 'cinema_admin' &&
      adminPortalDecoded.cinemaId === cinema.id &&
      adminPortalDecoded.scope === 'ADMIN_PORTAL'
    ) {
      recordTest(
        '6.0',
        'Promoted CINEMA_ADMIN Logs In to ADMIN_PORTAL with Scoped Claims',
        'PASS',
        {
          tokenRoleClaim: adminPortalDecoded.role,
          tokenCinemaIdClaim: adminPortalDecoded.cinemaId,
          tokenScopeClaim: adminPortalDecoded.scope,
          responseScope: adminPortalData.scope,
        },
      );
    } else {
      recordTest(
        '6.0',
        'Promoted CINEMA_ADMIN Logs In to ADMIN_PORTAL with Scoped Claims',
        'FAIL',
        {
          adminPortalData,
          adminPortalDecoded,
        },
      );
    }

    // -------------------------------------------------------------
    // Step 7: Regular Admin Elevating User to SUPER_ADMIN (403 Forbidden)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Admin Elevating User to SUPER_ADMIN Blocked ---');
    try {
      await axios.patch(
        `${API_BASE}/users/${candidateUserId}/role`,
        {
          role: 'super_admin',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      recordTest(
        '7.0',
        'Admin Elevating User to SUPER_ADMIN (403 Forbidden)',
        'FAIL',
        {
          reason: 'Admin was allowed to create Super Admin',
        },
      );
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 403 && message.toLowerCase().includes('cannot elevate')) {
        recordTest(
          '7.0',
          'Admin Elevating User to SUPER_ADMIN (403 Forbidden)',
          'PASS',
          {
            httpStatus: status,
            errorMessage: message,
          },
        );
      } else {
        recordTest(
          '7.0',
          'Admin Elevating User to SUPER_ADMIN (403 Forbidden)',
          'FAIL',
          {
            httpStatus: status,
            errorMessage: message,
          },
        );
      }
    }
  } catch (err) {
    console.error('❌ Test execution error:', err.response?.data || err.message);
    recordTest('ERR', 'Test Execution Failure', 'FAIL', {
      error: err.response?.data || err.message,
    });
  } finally {
    await userPg.end();
    await redis.quit();
  }

  // -------------------------------------------------------------
  // Summary Matrix
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 USER ROLE PROMOTION & SCOPED AUTHENTICATION (clientScope) MATRIX');
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
    console.log('🎉 ALL SCOPED AUTHENTICATION & ROLE PROMOTION TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runScopedAuthAndRolesTest();
