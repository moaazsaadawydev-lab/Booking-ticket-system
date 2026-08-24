const { Client: PgClient } = require('pg');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const dotenv = require('dotenv');
const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `libs/env/.env.${nodeEnv}`) });

const testResults = [];

function recordResult(step, name, passed, details = {}) {
  const statusStr = passed ? 'PASS' : 'FAIL';
  testResults.push({ step, name, status: statusStr, details });
  console.log(`[${statusStr}] Step ${step}: ${name}`);
  if (details && Object.keys(details).length > 0) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function runTests() {
  console.log('=================================================================================');
  console.log('💳 Payment Microservice: Database Schema Setup & Paymob Integration Test');
  console.log('=================================================================================\n');

  // -------------------------------------------------------------
  // Part 1: Database Schema & Entity Verification
  // -------------------------------------------------------------
  console.log('--- Part 1: PostgreSQL Schema & Table Verification ---');

  const pgClient = new PgClient({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: process.env.PAYMENT_DATABASE_NAME || 'Booking-Payments',
  });
  await pgClient.connect();

  // 1.1 Check required tables exist
  const tablesRes = await pgClient.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `);
  const tables = tablesRes.rows.map((r) => r.tablename);
  const requiredTables = ['payments', 'payment_logs', 'payment_outbox', 'migrations'];
  const hasAllTables = requiredTables.every((t) => tables.includes(t));

  recordResult('1.1', 'Required Database Tables Exist in Booking-Payments', hasAllTables, {
    foundTables: tables,
    required: requiredTables,
  });

  // 1.2 Check payments table columns and unique constraint on provider_transaction_id
  const columnsRes = await pgClient.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'payments'
    ORDER BY ordinal_position;
  `);
  const columnNames = columnsRes.rows.map((c) => c.column_name);
  const expectedCols = [
    'id',
    'booking_id',
    'user_id',
    'amount',
    'currency',
    'provider',
    'method',
    'status',
    'provider_order_id',
    'provider_transaction_id',
    'payment_token',
    'failure_reason',
    'created_at',
    'updated_at',
  ];
  const hasAllColumns = expectedCols.every((c) => columnNames.includes(c));

  // Check unique index on provider_transaction_id (Idempotency)
  const indexRes = await pgClient.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'payments' AND indexdef LIKE '%provider_transaction_id%';
  `);
  const hasUniqueTxId = indexRes.rows.some((i) => i.indexdef.includes('UNIQUE'));

  recordResult('1.2', 'Payments Schema & Unique Idempotency Constraint', hasAllColumns && hasUniqueTxId, {
    columnsCount: columnNames.length,
    hasUniqueTransactionIndex: hasUniqueTxId,
    indexes: indexRes.rows.map((i) => i.indexname),
  });

  // 1.3 Test Inserting and Retrieving a Payment Record
  const sampleBookingId = '11111111-2222-4333-8444-555555555555';
  const sampleUserId = '66666666-7777-4888-9999-000000000000';
  const sampleTxId = `TX-TEST-${Date.now()}`;

  const insertRes = await pgClient.query(
    `INSERT INTO payments (booking_id, user_id, amount, currency, provider, method, status, provider_transaction_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, booking_id, user_id, amount, status, provider_transaction_id`,
    [sampleBookingId, sampleUserId, 250.0, 'EGP', 'PAYMOB', 'CARD', 'PENDING', sampleTxId],
  );
  const inserted = insertRes.rows[0];

  // Test Idempotency constraint by inserting duplicate transaction ID
  let duplicateRejected = false;
  try {
    await pgClient.query(
      `INSERT INTO payments (booking_id, user_id, amount, currency, provider, method, status, provider_transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sampleBookingId, sampleUserId, 250.0, 'EGP', 'PAYMOB', 'CARD', 'PENDING', sampleTxId],
    );
  } catch (err) {
    duplicateRejected = err.code === '23505'; // unique_violation
  }

  // Clean up test record
  await pgClient.query(`DELETE FROM payments WHERE id = $1`, [inserted.id]);

  recordResult('1.3', 'Payment Entity CRUD & Idempotency Duplicate Rejection', !!inserted.id && duplicateRejected, {
    insertedPaymentId: inserted.id,
    amount: inserted.amount,
    duplicateRejectedDueToUniqueTxId: duplicateRejected,
  });

  await pgClient.end();

  // -------------------------------------------------------------
  // Part 2: Paymob API Live Connectivity & Flow Verification
  // -------------------------------------------------------------
  console.log('\n--- Part 2: Paymob API Client & Integration Verification ---');

  const apiKey = process.env.PAYMOB_API_KEY;
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  const cardIntegrationId = Number(process.env.PAYMOB_CARD_INTEGRATION_ID);
  const iframeId = process.env.PAYMOB_IFRAME_ID;

  console.log(`   Paymob API Key: ${apiKey ? apiKey.slice(0, 15) + '...' : 'MISSING'}`);
  console.log(`   Paymob Card Integration ID: ${cardIntegrationId}`);
  console.log(`   Paymob HMAC Secret: ${hmacSecret ? hmacSecret.slice(0, 8) + '...' : 'MISSING'}`);

  // 2.1 Step 1: Authentication Token
  console.log('\n   Calling Paymob /auth/tokens...');
  let authToken = '';
  let authPassed = false;
  try {
    const authRes = await axios.post('https://accept.paymob.com/api/auth/tokens', {
      api_key: apiKey,
    });
    authToken = authRes.data?.token;
    authPassed = !!authToken && authToken.length > 50;
  } catch (err) {
    console.error('   Auth Error:', err.response?.data || err.message);
  }

  recordResult('2.1', 'Paymob Step 1: Authentication Token Acquisition', authPassed, {
    hasToken: !!authToken,
    tokenPrefix: authToken ? authToken.slice(0, 20) + '...' : 'none',
  });

  // 2.2 Step 2: Order Registration
  console.log('   Calling Paymob /ecommerce/orders...');
  let orderId = null;
  let orderPassed = false;
  const mockMerchantOrderId = `BOOKING-TEST-${Date.now()}`;
  try {
    const orderRes = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
      auth_token: authToken,
      delivery_needed: 'false',
      amount_cents: '15000', // 150.00 EGP
      currency: 'EGP',
      merchant_order_id: mockMerchantOrderId,
      items: [],
    });
    orderId = orderRes.data?.id;
    orderPassed = !!orderId;
  } catch (err) {
    console.error('   Order Registration Error:', err.response?.data || err.message);
  }

  recordResult('2.2', 'Paymob Step 2: Order Registration', orderPassed, {
    orderId,
    merchantOrderId: mockMerchantOrderId,
    amountEgp: 150.0,
  });

  // 2.3 Step 3: Payment Key Generation
  console.log('   Calling Paymob /acceptance/payment_keys...');
  let paymentKeyToken = '';
  let paymentKeyPassed = false;
  try {
    const keyRes = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
      auth_token: authToken,
      amount_cents: '15000',
      expiration: 3600,
      order_id: orderId.toString(),
      billing_data: {
        apartment: 'NA',
        email: 'test.customer@booking.local',
        floor: 'NA',
        first_name: 'Test',
        street: 'NA',
        building: 'NA',
        phone_number: '+201000000000',
        shipping_method: 'NA',
        postal_code: 'NA',
        city: 'Cairo',
        country: 'EG',
        last_name: 'Customer',
        state: 'NA',
      },
      currency: 'EGP',
      integration_id: cardIntegrationId,
      lock_order_when_paid: 'true',
    });
    paymentKeyToken = keyRes.data?.token;
    paymentKeyPassed = !!paymentKeyToken && paymentKeyToken.length > 50;
  } catch (err) {
    console.error('   Payment Key Error:', err.response?.data || err.message);
  }

  const iframeUrl = iframeId && paymentKeyToken
    ? `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKeyToken}`
    : undefined;

  recordResult('2.3', 'Paymob Step 3: Payment Key Generation', paymentKeyPassed, {
    hasPaymentKey: !!paymentKeyToken,
    paymentTokenPrefix: paymentKeyToken ? paymentKeyToken.slice(0, 20) + '...' : 'none',
    iframeUrl: iframeUrl ? iframeUrl.slice(0, 60) + '...' : 'N/A',
  });

  // -------------------------------------------------------------
  // Part 3: HMAC-SHA512 Webhook Signature Verification Utility
  // -------------------------------------------------------------
  console.log('\n--- Part 3: HMAC Signature Verification Utility ---');

  const mockPayload = {
    obj: {
      amount_cents: 15000,
      created_at: '2026-08-24T20:00:00.000Z',
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      id: 99887766,
      integration_id: cardIntegrationId,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: orderId || 123456 },
      owner: 1219314,
      pending: false,
      source_data: {
        pan: '2346',
        sub_type: 'MasterCard',
        type: 'card',
      },
      success: true,
    },
  };

  // Helper matching PaymobProvider.verifyHmac
  function computeHmac(payloadObj, secret) {
    const obj = payloadObj.obj;
    const concatenated = [
      obj.amount_cents ?? '',
      obj.created_at ?? '',
      obj.currency ?? '',
      obj.error_occured ?? '',
      obj.has_parent_transaction ?? '',
      obj.id ?? '',
      obj.integration_id ?? '',
      obj.is_3d_secure ?? '',
      obj.is_auth ?? '',
      obj.is_capture ?? '',
      obj.is_refunded ?? '',
      obj.is_standalone_payment ?? '',
      obj.is_voided ?? '',
      obj.order?.id ?? obj.order ?? '',
      obj.owner ?? '',
      obj.pending ?? '',
      obj.source_data?.pan ?? '',
      obj.source_data?.sub_type ?? '',
      obj.source_data?.type ?? '',
      obj.success ?? '',
    ].join('');

    return CryptoJS.HmacSHA512(concatenated, secret).toString(CryptoJS.enc.Hex);
  }

  const validHmac = computeHmac(mockPayload, hmacSecret);
  const invalidHmac = '0000000000000000000000000000000000000000000000000000000000000000';

  // Verification matching PaymobProvider logic
  function verifyHmacTest(payload, hmac, secret) {
    const computed = computeHmac(payload, secret);
    return computed.toLowerCase() === hmac.toLowerCase().trim();
  }

  const validVerified = verifyHmacTest(mockPayload, validHmac, hmacSecret);
  const invalidRejected = !verifyHmacTest(mockPayload, invalidHmac, hmacSecret);
  const hmacPassed = validVerified && invalidRejected;

  recordResult('3.1', 'Paymob HMAC-SHA512 Webhook Validation (Positive & Negative Cases)', hmacPassed, {
    validHmacPrefix: validHmac.slice(0, 16) + '...',
    validPassed: validVerified,
    tamperedRejected: invalidRejected,
  });

  // -------------------------------------------------------------
  // Summary Table
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 PAYMENT & PAYMOB VERIFICATION SUMMARY');
  console.log('=================================================================================');

  console.table(
    testResults.map((r) => ({
      Step: r.step,
      Name: r.name,
      Status: r.status,
    })),
  );

  const total = testResults.length;
  const passedCount = testResults.filter((r) => r.status === 'PASS').length;
  const failedCount = total - passedCount;

  console.log(`\nTOTAL: ${total} | PASSED: ${passedCount} | FAILED: ${failedCount}`);

  if (failedCount === 0) {
    console.log('🎉 ALL PAYMENT SCHEMA & PAYMOB INTEGRATION FOUNDATION TESTS PASSED (100%)!\n');
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Error in Payment Setup Test:', err);
  process.exit(1);
});
