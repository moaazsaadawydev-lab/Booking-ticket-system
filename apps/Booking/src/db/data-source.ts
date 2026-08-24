import { DataSource, DataSourceOptions } from 'typeorm';
import {
  Booking,
  BookingSeat,
  Ticket,
  BookingOutbox,
} from '@booking-ticket-system/Entities';
import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.resolve(process.cwd(), `libs/env/.env.${nodeEnv}`);
dotenv.config({ path: envPath });

export const BookingDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.BOOKING_DATABASE_NAME || 'Booking-Bookings',
  entities: [
    Booking,
    BookingSeat,
    Ticket,
    BookingOutbox,
  ],
  migrations: ['apps/Booking/src/db/migrations/*.ts'],
  synchronize: false,
};

const dataSource = new DataSource(BookingDataSourceOptions);
export default dataSource;
