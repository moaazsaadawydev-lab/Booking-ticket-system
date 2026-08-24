const axios = require('axios');

const testMatrix = [];
function recordTest(step, name, status, details = {}) {
  testMatrix.push({ step, name, status, details });
  const icon = status === 'PASS' ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} Step ${step}: ${name}`);
  if (Object.keys(details).length > 0) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function runFrontendContainerTests() {
  console.log('=================================================================================');
  console.log('🐳 Frontend Applications Containerization & Health Verification Test');
  console.log('=================================================================================\n');

  try {
    // -------------------------------------------------------------
    // Step 1: Cinema Web Home Page (Port 3001)
    // -------------------------------------------------------------
    console.log('--- Step 1: Verify Cinema Web (Port 3001) ---');
    const cinemaRes = await axios.get('http://localhost:3001', {
      timeout: 5000,
    });
    if (
      cinemaRes.status === 200 &&
      cinemaRes.data.includes('<html') &&
      cinemaRes.data.includes('cinema-web')
    ) {
      recordTest('1.0', 'Cinema Web App Serves Home Page (Port 3001)', 'PASS', {
        status: cinemaRes.status,
        contentLength: cinemaRes.data.length,
        contentType: cinemaRes.headers['content-type'],
      });
    } else {
      recordTest('1.0', 'Cinema Web App Serves Home Page (Port 3001)', 'FAIL', {
        status: cinemaRes.status,
        length: cinemaRes.data?.length,
      });
    }

    // -------------------------------------------------------------
    // Step 2: Cinema Web API Hello Route
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Verify Cinema Web API Route ---');
    const cinemaApiRes = await axios.get('http://localhost:3001/api/hello', {
      timeout: 5000,
    });
    if (cinemaApiRes.status === 200 && cinemaApiRes.data.includes('Hello, from API!')) {
      recordTest('2.0', 'Cinema Web API Route /api/hello Responds Correctly', 'PASS', {
        status: cinemaApiRes.status,
        body: cinemaApiRes.data,
      });
    } else {
      recordTest('2.0', 'Cinema Web API Route /api/hello Responds Correctly', 'FAIL', {
        status: cinemaApiRes.status,
        body: cinemaApiRes.data,
      });
    }

    // -------------------------------------------------------------
    // Step 3: Admin Dashboard Home Page (Port 3002)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Verify Admin Dashboard (Port 3002) ---');
    const adminRes = await axios.get('http://localhost:3002', {
      timeout: 5000,
    });
    if (
      adminRes.status === 200 &&
      adminRes.data.includes('<html') &&
      adminRes.data.includes('admin-dashboard')
    ) {
      recordTest('3.0', 'Admin Dashboard App Serves Home Page (Port 3002)', 'PASS', {
        status: adminRes.status,
        contentLength: adminRes.data.length,
        contentType: adminRes.headers['content-type'],
      });
    } else {
      recordTest('3.0', 'Admin Dashboard App Serves Home Page (Port 3002)', 'FAIL', {
        status: adminRes.status,
        length: adminRes.data?.length,
      });
    }

    // -------------------------------------------------------------
    // Step 4: Admin Dashboard API Hello Route
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Verify Admin Dashboard API Route ---');
    const adminApiRes = await axios.get('http://localhost:3002/api/hello', {
      timeout: 5000,
    });
    if (adminApiRes.status === 200 && adminApiRes.data.includes('Hello, from API!')) {
      recordTest('4.0', 'Admin Dashboard API Route /api/hello Responds Correctly', 'PASS', {
        status: adminApiRes.status,
        body: adminApiRes.data,
      });
    } else {
      recordTest('4.0', 'Admin Dashboard API Route /api/hello Responds Correctly', 'FAIL', {
        status: adminApiRes.status,
        body: adminApiRes.data,
      });
    }
  } catch (err) {
    console.error('❌ Test execution error:', err.response?.data || err.message);
    recordTest('ERR', 'Frontend Test Execution Failure', 'FAIL', {
      error: err.response?.data || err.message,
    });
  }

  // -------------------------------------------------------------
  // Summary Matrix
  // -------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log('📊 FRONTEND CONTAINERIZATION & HEALTH MATRIX');
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
    console.log('🎉 ALL FRONTEND CONTAINER TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runFrontendContainerTests();
