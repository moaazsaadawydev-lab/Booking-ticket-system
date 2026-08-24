const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: '624562',
    database: 'postgres',
  });

  await client.connect();

  const check = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = 'Booking-Payments'`,
  );

  if (check.rows.length === 0) {
    await client.query('CREATE DATABASE "Booking-Payments";');
    console.log('✅ Database "Booking-Payments" created successfully!');
  } else {
    console.log('ℹ️ Database "Booking-Payments" already exists.');
  }

  await client.end();
}

main().catch((err) => {
  console.error('Error creating database:', err.message);
  process.exit(1);
});
