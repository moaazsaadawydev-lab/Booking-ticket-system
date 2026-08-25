const axios = require('axios');
const pg = require('pg');
const Redis = require('ioredis');

const DB_HOST = process.env.DATABASE_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DATABASE_PORT || '5433', 10);
const DB_USER = process.env.DATABASE_USER || 'postgres';
const DB_PASS = process.env.DATABASE_PASSWORD || '624562';
const USERS_DB = process.env.USERS_DATABASE_NAME || 'Booking-Users';

const API_BASE = 'http://localhost:3000/api/v1';
const DASHBOARD_BASE = 'http://localhost:3002';

const testMatrix = [];
function recordTest(step, name, status, details = {}) {
  testMatrix.push({ step, name, status, details });
  const icon = status === 'PASS' ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} Step ${step}: ${name}`);
  if (Object.keys(details).length > 0) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function runAdminDashboardTests() {
  console.log('=================================================================================');
  console.log('🖥️ Admin Dashboard (Phase 1: Foundation & RBAC Portal) E2E Test Suite');
  console.log('=================================================================================\n');

  const pool = new pg.Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: USERS_DB,
  });

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  });

  try {
    // -------------------------------------------------------------
    // Step 1: Provision Super Admin, Admin & Regular User in DB
    // -------------------------------------------------------------
    console.log('--- Step 1: Provision Test Accounts ---');
    const timestamp = Date.now();
    const superEmail = `super.dashboard.${timestamp}@test.com`;
    const adminEmail = `admin.dashboard.${timestamp}@test.com`;
    const customerEmail = `customer.dashboard.${timestamp}@test.com`;
    const plainPassword = 'Password123!';

    // Register via API Gateway
    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Super Dashboard Admin',
      email: superEmail,
      password: plainPassword,
      phone: '+201000000001',
    });

    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Cinema Admin User',
      email: adminEmail,
      password: plainPassword,
      phone: '+201000000002',
    });

    await axios.post(`${API_BASE}/users/auth/register`, {
      name: 'Standard Customer',
      email: customerEmail,
      password: plainPassword,
      phone: '+201000000003',
    });

    // Elevate in DB and mark ACTIVE
    await pool.query(
      `UPDATE users SET role = 'super_admin', status = 'ACTIVE' WHERE email = $1`,
      [superEmail],
    );
    await pool.query(
      `UPDATE users SET role = 'admin', status = 'ACTIVE' WHERE email = $1`,
      [adminEmail],
    );
    await pool.query(
      `UPDATE users SET role = 'user', status = 'ACTIVE' WHERE email = $1`,
      [customerEmail],
    );

    recordTest('1.0', 'Provision Super Admin, Admin, and Customer Accounts', 'PASS', {
      superEmail,
      adminEmail,
      customerEmail,
    });

    // -------------------------------------------------------------
    // Step 2: Public Login Page Renders (200 OK)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Test Public /login Route ---');
    const loginPageRes = await axios.get(`${DASHBOARD_BASE}/login`, {
      timeout: 5000,
    });
    if (
      loginPageRes.status === 200 &&
      loginPageRes.data.includes('Aflamak Admin OS') &&
      loginPageRes.data.includes('ADMIN_PORTAL')
    ) {
      recordTest('2.0', 'Public Login Page Serves HTML with Scope Pill', 'PASS', {
        status: loginPageRes.status,
        length: loginPageRes.data.length,
      });
    } else {
      recordTest('2.0', 'Public Login Page Serves HTML with Scope Pill', 'FAIL', {
        status: loginPageRes.status,
      });
    }

    // -------------------------------------------------------------
    // Step 3: Middleware Protects Unauthenticated /dashboard
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Test Middleware Route Guarding ---');
    const unauthRes = await axios.get(`${DASHBOARD_BASE}/dashboard`, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (
      unauthRes.status === 307 &&
      unauthRes.headers.location?.includes('/login?redirect=%2Fdashboard')
    ) {
      recordTest('3.0', 'Middleware Intercepts Unauthenticated /dashboard (307 Redirect)', 'PASS', {
        statusCode: unauthRes.status,
        redirectLocation: unauthRes.headers.location,
      });
    } else {
      recordTest('3.0', 'Middleware Intercepts Unauthenticated /dashboard (307 Redirect)', 'FAIL', {
        statusCode: unauthRes.status,
        redirectLocation: unauthRes.headers.location,
      });
    }

    // -------------------------------------------------------------
    // Step 4: Customer Blocked from ADMIN_PORTAL
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Test Customer Rejected from Admin Scope ---');
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: customerEmail,
        password: plainPassword,
        clientScope: 'ADMIN_PORTAL',
      });
      recordTest('4.0', 'Customer Login to ADMIN_PORTAL Blocked with 403', 'FAIL');
    } catch (err) {
      if (err.response?.status === 403) {
        recordTest('4.0', 'Customer Login to ADMIN_PORTAL Blocked with 403', 'PASS', {
          status: 403,
          message: err.response.data?.message,
        });
      } else {
        recordTest('4.0', 'Customer Login to ADMIN_PORTAL Blocked with 403', 'FAIL', {
          status: err.response?.status,
          data: err.response?.data,
        });
      }
    }

    // -------------------------------------------------------------
    // Step 5: Super Admin Logs In via ADMIN_PORTAL
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Super Admin Login via ADMIN_PORTAL ---');
    const superLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: superEmail,
      password: plainPassword,
      clientScope: 'ADMIN_PORTAL',
    });

    const superAuthData = superLoginRes.data?.data || superLoginRes.data;
    const superToken = superAuthData.accessToken;
    const superRole = superAuthData.role;

    if (superLoginRes.status === 200 && superToken && superRole === 'super_admin') {
      recordTest('5.0', 'Super Admin Login Succeeds with Scoped Claims', 'PASS', {
        status: 200,
        role: superRole,
        scope: superAuthData.scope,
        hasToken: !!superToken,
      });
    } else {
      recordTest('5.0', 'Super Admin Login Succeeds with Scoped Claims', 'FAIL', {
        superAuthData,
      });
    }

    // -------------------------------------------------------------
    // Step 6: Authenticated Access to /dashboard with Cookie
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Test Authenticated Access to /dashboard ---');
    const authHeaders = {
      Cookie: `admin_access_token=${superToken}; admin_user_role=super_admin`,
    };

    const dashboardRes = await axios.get(`${DASHBOARD_BASE}/dashboard`, {
      headers: authHeaders,
      timeout: 5000,
    });

    if (dashboardRes.status === 200 && dashboardRes.data.includes('Aflamak')) {
      recordTest('6.0', 'Authenticated Access to /dashboard Serves Shell', 'PASS', {
        status: 200,
        contentLength: dashboardRes.data.length,
      });
    } else {
      recordTest('6.0', 'Authenticated Access to /dashboard Serves Shell', 'FAIL', {
        status: dashboardRes.status,
      });
    }

    // -------------------------------------------------------------
    // Step 7: Authenticated Access to /dashboard/movies
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Test /dashboard/movies Route ---');
    const moviesRes = await axios.get(`${DASHBOARD_BASE}/dashboard/movies`, {
      headers: authHeaders,
      timeout: 5000,
    });
    if (moviesRes.status === 200 && moviesRes.data.includes('Movies Catalog')) {
      recordTest('7.0', 'Authenticated Access to /dashboard/movies Renders Catalog', 'PASS', {
        status: 200,
        contentLength: moviesRes.data.length,
      });
    } else {
      recordTest('7.0', 'Authenticated Access to /dashboard/movies Renders Catalog', 'FAIL', {
        status: moviesRes.status,
      });
    }

    // -------------------------------------------------------------
    // Step 8: Authenticated Access to /dashboard/cinemas
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Test /dashboard/cinemas Route ---');
    const cinemasRes = await axios.get(`${DASHBOARD_BASE}/dashboard/cinemas`, {
      headers: authHeaders,
      timeout: 5000,
    });
    if (
      cinemasRes.status === 200 &&
      (cinemasRes.data.includes('Cinemas') || cinemasRes.data.includes('Branches'))
    ) {
      recordTest('8.0', 'Authenticated Access to /dashboard/cinemas Renders Branches', 'PASS', {
        status: 200,
        contentLength: cinemasRes.data.length,
      });
    } else {
      recordTest('8.0', 'Authenticated Access to /dashboard/cinemas Renders Branches', 'FAIL', {
        status: cinemasRes.status,
      });
    }

    // -------------------------------------------------------------
    // Step 9: Authenticated Access to /dashboard/auditoriums
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Test /dashboard/auditoriums Route ---');
    const audsRes = await axios.get(`${DASHBOARD_BASE}/dashboard/auditoriums`, {
      headers: authHeaders,
      timeout: 5000,
    });
    if (
      audsRes.status === 200 &&
      (audsRes.data.includes('Auditoriums') || audsRes.data.includes('Halls'))
    ) {
      recordTest('9.0', 'Authenticated Access to /dashboard/auditoriums Renders Halls', 'PASS', {
        status: 200,
        contentLength: audsRes.data.length,
      });
    } else {
      recordTest('9.0', 'Authenticated Access to /dashboard/auditoriums Renders Halls', 'FAIL', {
        status: audsRes.status,
      });
    }

    // -------------------------------------------------------------
    // Step 10: Authenticated Access to /dashboard/showtimes
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Test /dashboard/showtimes Route ---');
    const showtimesRes = await axios.get(`${DASHBOARD_BASE}/dashboard/showtimes`, {
      headers: authHeaders,
      timeout: 5000,
    });
    if (showtimesRes.status === 200 && showtimesRes.data.includes('Showtimes Scheduler')) {
      recordTest('10.0', 'Authenticated Access to /dashboard/showtimes Renders Scheduler', 'PASS', {
        status: 200,
        contentLength: showtimesRes.data.length,
      });
    } else {
      recordTest('10.0', 'Authenticated Access to /dashboard/showtimes Renders Scheduler', 'FAIL', {
        status: showtimesRes.status,
      });
    }

    // -------------------------------------------------------------
    // Step 11: Authenticated Access to /dashboard/users (Super Admin)
    // -------------------------------------------------------------
    console.log('\n--- Step 11: Test /dashboard/users Route ---');
    const usersRes = await axios.get(`${DASHBOARD_BASE}/dashboard/users`, {
      headers: authHeaders,
      timeout: 5000,
    });
    if (
      usersRes.status === 200 &&
      (usersRes.data.includes('User') || usersRes.data.includes('Staff'))
    ) {
      recordTest('11.0', 'Authenticated Super Admin Access to /dashboard/users Renders RBAC', 'PASS', {
        status: 200,
        contentLength: usersRes.data.length,
      });
    } else {
      recordTest('11.0', 'Authenticated Super Admin Access to /dashboard/users Renders RBAC', 'FAIL', {
        status: usersRes.status,
      });
    }
  } catch (err) {
    console.error('❌ Test suite fatal error:', err.response?.data || err.message);
    recordTest('ERR', 'Admin Dashboard Test Suite Failure', 'FAIL', {
      error: err.response?.data || err.message,
    });
  } finally {
    await pool.end();
    await redis.quit();
  }

  // -------------------------------------------------------------
  // Summary Matrix
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 ADMIN DASHBOARD (PHASE 1) VERIFICATION MATRIX');
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
    console.log('🎉 ALL ADMIN DASHBOARD (PHASE 1) TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runAdminDashboardTests();
