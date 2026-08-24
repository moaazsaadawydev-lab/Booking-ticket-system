const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'postgres',
  });

  await client.connect();

  const check = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'Booking-Bookings'",
  );
  if (check.rows.length === 0) {
    await client.query('CREATE DATABASE "Booking-Bookings"');
    console.log('Database "Booking-Bookings" created.');
  } else {
    console.log('Database "Booking-Bookings" already exists.');
  }

  await client.end();

  // Connect to Booking-Bookings to ensure uuid extension
  const bookingClient = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: process.env.DATABASE_PASSWORD || '624562',
    database: 'Booking-Bookings',
  });

  await bookingClient.connect();
  await bookingClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  console.log('Extension "uuid-ossp" verified on "Booking-Bookings".');
  await bookingClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
