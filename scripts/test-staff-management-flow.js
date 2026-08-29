const axios = require('axios');
const { Client } = require('pg');
const Redis = require('ioredis');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

async function runTestSuite() {
  console.log('====================================================');
  console.log('🚀 STARTING STAFF MANAGEMENT PIPELINE TEST SUITE');
  console.log('====================================================\n');

  // Postgres Client for test setup & assertions
  const pgClient = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:624562@localhost:5433/Booking-Users',
  });
  await pgClient.connect();

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    // 0. Setup Test Admin & Super Admin users
    console.log('📦 Setting up test users in database...');

    const superAdminPassword = 'SuperAdminPass123!';
    const adminPassword = 'AdminPass123!';
    const bcrypt = require('bcryptjs');
    const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
    const adminHash = await bcrypt.hash(adminPassword, 10);

    const superAdminId = '11111111-1111-1111-1111-111111111111';
    const adminId = '22222222-2222-2222-2222-222222222222';
    const testCinemaId = '33333333-3333-3333-3333-333333333333';

    // Clean up any previous test runs
    await pgClient.query(`
      DELETE FROM users WHERE email LIKE '%@test-staff.com' 
      OR email IN ('superadmin@test.com', 'standardadmin@test.com');
    `);

    // Insert Super Admin
    await pgClient.query(`
      INSERT INTO users (id, name, email, password, role, status, "createdAt", "updatedAt")
      VALUES ('${superAdminId}', 'Super Admin Test', 'superadmin@test.com', '${superAdminHash}', 'super_admin', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET password = '${superAdminHash}', role = 'super_admin', status = 'ACTIVE';
    `);

    // Insert Standard Admin
    await pgClient.query(`
      INSERT INTO users (id, name, email, password, role, status, "createdAt", "updatedAt")
      VALUES ('${adminId}', 'Standard Admin Test', 'standardadmin@test.com', '${adminHash}', 'admin', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET password = '${adminHash}', role = 'admin', status = 'ACTIVE';
    `);

    // Clear Redis rate limits for clean run
    await redis.del(`rate:sudo:staff-create:${superAdminId}`);
    await redis.del(`rate:sudo:staff-create:${adminId}`);

    // Login Super Admin
    const superLoginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'superadmin@test.com',
      password: superAdminPassword,
      clientScope: 'ADMIN_PORTAL',
    });
    const superAdminToken = superLoginRes.data?.data?.accessToken;
    console.log('✅ Super Admin authenticated.');

    // Login Standard Admin
    const adminLoginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'standardadmin@test.com',
      password: adminPassword,
      clientScope: 'ADMIN_PORTAL',
    });
    const standardAdminToken = adminLoginRes.data?.data?.accessToken;
    console.log('✅ Standard Admin authenticated.\n');

    // ----------------------------------------------------------------
    // CASE 1: Sudo Fail (Incorrect admin password -> 401)
    // ----------------------------------------------------------------
    console.log('🧪 CASE 1: Sudo Password Failure Verification');
    try {
      await axios.post(
        `${API_BASE_URL}/users/staff`,
        {
          fullName: 'Cinema Manager 1',
          email: 'cinema.manager1@test-staff.com',
          role: 'cinema_admin',
          cinemaId: testCinemaId,
          adminPassword: 'WrongPassword123!',
        },
        { headers: { Authorization: `Bearer ${superAdminToken}` } },
      );
      throw new Error('Expected 401 Unauthorized but request succeeded.');
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('✅ [PASSED] Received expected 401 Unauthorized on bad sudo password.');
      } else {
        throw new Error(
          `Expected status 401, received ${err.response?.status}: ${JSON.stringify(
            err.response?.data,
          )}`,
        );
      }
    }

    // ----------------------------------------------------------------
    // CASE 2: Rate Limit Trigger (5 failed sudo attempts -> 429)
    // ----------------------------------------------------------------
    console.log('\n🧪 CASE 2: Redis Sudo Rate Limiting (5 Attempts -> 429)');
    // 1 attempt was already made in Case 1. Make 4 more to hit limit.
    for (let i = 2; i <= 5; i++) {
      try {
        await axios.post(
          `${API_BASE_URL}/users/staff`,
          {
            fullName: 'Cinema Manager 1',
            email: 'cinema.manager1@test-staff.com',
            role: 'cinema_admin',
            cinemaId: testCinemaId,
            adminPassword: 'WrongPassword123!',
          },
          { headers: { Authorization: `Bearer ${superAdminToken}` } },
        );
      } catch (err) {
        // Expected 401 during warmup
      }
    }

    // 6th attempt must trigger 429 Too Many Requests
    try {
      await axios.post(
        `${API_BASE_URL}/users/staff`,
        {
          fullName: 'Cinema Manager 1',
          email: 'cinema.manager1@test-staff.com',
          role: 'cinema_admin',
          cinemaId: testCinemaId,
          adminPassword: superAdminPassword, // Even with correct password, blocked by rate limit
        },
        { headers: { Authorization: `Bearer ${superAdminToken}` } },
      );
      throw new Error('Expected 429 Too Many Requests but request succeeded.');
    } catch (err) {
      if (err.response?.status === 429) {
        console.log('✅ [PASSED] Received expected 429 Too Many Requests after 5 failed attempts.');
      } else {
        throw new Error(
          `Expected status 429, received ${err.response?.status}: ${JSON.stringify(
            err.response?.data,
          )}`,
        );
      }
    }

    // Reset rate limit key for subsequent test cases
    await redis.del(`rate:sudo:staff-create:${superAdminId}`);
    console.log('🧹 Cleared rate limit counter for next test cases.');

    // ----------------------------------------------------------------
    // CASE 3: RBAC Enforcement (Standard Admin inviting Super Admin -> 403)
    // ----------------------------------------------------------------
    console.log('\n🧪 CASE 3: RBAC Hierarchy Enforcement (Admin -> Super Admin => 403)');
    try {
      await axios.post(
        `${API_BASE_URL}/users/staff`,
        {
          fullName: 'Another Super Admin',
          email: 'new.super@test-staff.com',
          role: 'super_admin',
          adminPassword: adminPassword,
        },
        { headers: { Authorization: `Bearer ${standardAdminToken}` } },
      );
      throw new Error('Expected 403 Forbidden but request succeeded.');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ [PASSED] Received expected 403 Forbidden when Admin tries to invite Super Admin.');
      } else {
        throw new Error(
          `Expected status 403, received ${err.response?.status}: ${JSON.stringify(
            err.response?.data,
          )}`,
        );
      }
    }

    // ----------------------------------------------------------------
    // CASE 4: Cinema Constraint (Gate Checker without cinemaId -> 400)
    // ----------------------------------------------------------------
    console.log('\n🧪 CASE 4: Cinema Assignment Constraint (Gate Checker without cinemaId => 400)');
    try {
      await axios.post(
        `${API_BASE_URL}/users/staff`,
        {
          fullName: 'Gate Scanner Person',
          email: 'gate.scanner@test-staff.com',
          role: 'gate_checker',
          // cinemaId missing
          adminPassword: superAdminPassword,
        },
        { headers: { Authorization: `Bearer ${superAdminToken}` } },
      );
      throw new Error('Expected 400 Bad Request but request succeeded.');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('✅ [PASSED] Received expected 400 Bad Request when cinemaId is omitted for branch staff.');
      } else {
        throw new Error(
          `Expected status 400, received ${err.response?.status}: ${JSON.stringify(
            err.response?.data,
          )}`,
        );
      }
    }

    // ----------------------------------------------------------------
    // CASE 5: Happy Path (Super Admin invites Cinema Admin with valid cinemaId)
    // ----------------------------------------------------------------
    console.log('\n🧪 CASE 5: Happy Path Staff Invitation');
    const invitedEmail = 'invited.manager@test-staff.com';
    const inviteRes = await axios.post(
      `${API_BASE_URL}/users/staff`,
      {
        fullName: 'Mall of Arabia Manager',
        email: invitedEmail,
        phoneNumber: '+201001234567',
        birthDate: '1992-05-15',
        role: 'cinema_admin',
        cinemaId: testCinemaId,
        adminPassword: superAdminPassword,
      },
      { headers: { Authorization: `Bearer ${superAdminToken}` } },
    );

    if (inviteRes.status === 201) {
      console.log('✅ [PASSED] Received 201 Created from POST /api/v1/users/staff.');
    } else {
      throw new Error(`Expected status 201, received ${inviteRes.status}`);
    }

    const rawInviteData = inviteRes.data?.data || inviteRes.data;
    const inviteData = rawInviteData?.user || rawInviteData;
    console.log('Invite Response Payload (Sanitized):', inviteData);
    const createdUserId =
      inviteData.userId ||
      inviteData.user_id ||
      inviteData.id;

    if (!createdUserId)
      throw new Error(
        `Missing created user ID in response: ${JSON.stringify(inviteData)}`,
      );

    if (inviteData.invitationToken || inviteData.invitation_token) {
      throw new Error('SECURITY VIOLATION: Raw invitationToken leaked in HTTP response body!');
    }
    console.log('✅ [PASSED] Confirmed raw invitationToken is sanitized and NOT present in HTTP response payload.');

    // Verify in database
    const dbUserRes = await pgClient.query(
      `SELECT id, email, role, "cinemaId", status, "createdBy", "invitationTokenHash", "invitationExpiresAt" FROM users WHERE id = '${createdUserId}'`,
    );
    const dbUser = dbUserRes.rows[0];

    if (!dbUser) throw new Error('Created user not found in Postgres');
    if (dbUser.status !== 'PENDING_ACTIVATION') {
      throw new Error(`Expected status PENDING_ACTIVATION, got ${dbUser.status}`);
    }
    if (dbUser.createdBy !== superAdminId) {
      throw new Error(`Expected createdBy ${superAdminId}, got ${dbUser.createdBy}`);
    }
    if (dbUser.cinemaId !== testCinemaId) {
      throw new Error(`Expected cinemaId ${testCinemaId}, got ${dbUser.cinemaId}`);
    }
    if (!dbUser.invitationTokenHash) {
      throw new Error('Expected invitationTokenHash to be populated in DB');
    }
    console.log('✅ [PASSED] Database record verified with PENDING_ACTIVATION status, createdBy, cinemaId, and token hash.');

    // Verify Outbox Event & Extract Token for Email Dispatch
    const outboxRes = await pgClient.query(
      `SELECT id, "eventType", payload, status FROM outbox_messages WHERE "eventType" = 'staff.invitation.created' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    const outboxMsg = outboxRes.rows[0];
    if (!outboxMsg) throw new Error('Outbox event staff.invitation.created not found');

    const outboxPayload = typeof outboxMsg.payload === 'string' ? JSON.parse(outboxMsg.payload) : outboxMsg.payload;
    const invitationToken = outboxPayload.invitationToken;

    if (!invitationToken) {
      throw new Error('Missing invitationToken in Outbox event payload');
    }
    console.log('✅ [PASSED] Outbox message persisted containing raw invitationToken strictly for email dispatching.');

    // ----------------------------------------------------------------
    // CASE 6: Password Setup & Activation Pipeline
    // ----------------------------------------------------------------
    console.log('\n🧪 CASE 6: Setup Password & Subsequent Login');
    const newStaffPassword = 'NewStaffSecurePassword123!';

    const setupRes = await axios.post(`${API_BASE_URL}/auth/setup-password`, {
      token: invitationToken,
      password: newStaffPassword,
    });

    if (setupRes.status === 200) {
      console.log('✅ [PASSED] Setup password returned 200 OK.');
    } else {
      throw new Error(`Expected status 200, received ${setupRes.status}`);
    }

    // Verify in database that status changed to ACTIVE and tokens cleared
    const activatedUserRes = await pgClient.query(
      `SELECT id, email, status, "invitationTokenHash", "invitationExpiresAt" FROM users WHERE id = '${createdUserId}'`,
    );
    const activatedUser = activatedUserRes.rows[0];
    if (activatedUser.status !== 'ACTIVE') {
      throw new Error(`Expected user status ACTIVE, got ${activatedUser.status}`);
    }
    if (activatedUser.invitationTokenHash !== null) {
      throw new Error('Expected invitationTokenHash to be null after activation');
    }
    console.log('✅ [PASSED] Database confirms user transitioned to ACTIVE with invalidated invitation token.');

    // Verify newly activated user can log in
    const staffLoginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: invitedEmail,
      password: newStaffPassword,
      clientScope: 'ADMIN_PORTAL',
    });

    if (staffLoginRes.status === 200 && staffLoginRes.data?.data?.accessToken) {
      console.log('✅ [PASSED] Newly activated staff user logged in successfully via POST /auth/login.');
      console.log(`🎉 Staff Role: ${staffLoginRes.data?.data?.role}, Cinema ID: ${staffLoginRes.data?.data?.cinemaId}`);
    } else {
      throw new Error(`Login failed for activated user: ${JSON.stringify(staffLoginRes.data)}`);
    }

    console.log('\n====================================================');
    console.log('🏆 ALL 6 TEST CASES PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } finally {
    await pgClient.end();
    await redis.quit();
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err.message);
  if (err.response?.data) {
    console.error('Response Data:', err.response.data);
  }
  process.exit(1);
});
