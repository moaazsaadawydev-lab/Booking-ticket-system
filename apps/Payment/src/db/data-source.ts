import { DataSource, DataSourceOptions } from 'typeorm';
import {
  Payment,
  PaymentLog,
  PaymentOutbox,
} from '@booking-ticket-system/Entities';
import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.resolve(process.cwd(), `libs/env/.env.${nodeEnv}`);
dotenv.config({ path: envPath });

export const PaymentDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.PAYMENT_DATABASE_NAME || 'Booking-Payments',
  entities: [Payment, PaymentLog, PaymentOutbox],
  migrations: ['apps/Payment/src/db/migrations/*.ts'],
  synchronize: false,
};

const dataSource = new DataSource(PaymentDataSourceOptions);
export default dataSource;
