import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1787573021333 implements MigrationInterface {
    name = 'InitialMigration1787573021333'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."bookings_status_enum" AS ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_reference" character varying(12) NOT NULL, "user_id" uuid NOT NULL, "showtime_id" uuid NOT NULL, "cinema_id" uuid NOT NULL, "auditorium_id" uuid NOT NULL, "total_amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'EGP', "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "payment_id" uuid, "hold_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "confirmed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_5ba137683172608bf22d69538a0" UNIQUE ("booking_reference"), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5ba137683172608bf22d69538a" ON "bookings"  ("booking_reference") `);
        await queryRunner.query(`CREATE INDEX "IDX_64cd97487c5c42806458ab5520" ON "bookings"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_311925ef3f94966ea9482de9df" ON "bookings"  ("showtime_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_48b267d894e32a25ebde4b207a" ON "bookings"  ("status") `);
        await queryRunner.query(`CREATE TYPE "public"."booking_seats_seat_type_enum" AS ENUM('REGULAR', 'VIP', 'PREMIUM', 'COUPLE', 'WHEELCHAIR', 'EMPTY_SPACE')`);
        await queryRunner.query(`CREATE TABLE "booking_seats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "seat_id" uuid NOT NULL, "seat_identifier" character varying(10) NOT NULL, "seat_type" "public"."booking_seats_seat_type_enum" NOT NULL, "unit_price" numeric(10,2) NOT NULL, CONSTRAINT "PK_a4d929dea33a0153ba9bc253db1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_25c8b5c1e010af1cd2f699c592" ON "booking_seats"  ("booking_id") `);
        await queryRunner.query(`CREATE TYPE "public"."tickets_status_enum" AS ENUM('ISSUED', 'USED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "seat_id" uuid NOT NULL, "ticket_number" character varying(30) NOT NULL, "qr_code_token" character varying(255) NOT NULL, "status" "public"."tickets_status_enum" NOT NULL DEFAULT 'ISSUED', "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8d7b9a157280caf57aa0282e72c" UNIQUE ("ticket_number"), CONSTRAINT "UQ_4fa68fd245c509e84e65b507c74" UNIQUE ("qr_code_token"), CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8d7b9a157280caf57aa0282e72" ON "tickets"  ("ticket_number") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4fa68fd245c509e84e65b507c7" ON "tickets"  ("qr_code_token") `);
        await queryRunner.query(`CREATE INDEX "IDX_12b901b34113688b4786368510" ON "tickets"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc20985f14524969dddd128efd" ON "tickets"  ("booking_id") `);
        await queryRunner.query(`CREATE TYPE "public"."booking_outbox_status_enum" AS ENUM('PENDING', 'PUBLISHED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "booking_outbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_type" character varying(100) NOT NULL, "payload" jsonb NOT NULL, "status" "public"."booking_outbox_status_enum" NOT NULL DEFAULT 'PENDING', "retry_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_799cfd9bed58a628581b6fdf764" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0828e6c14c9d2e2b7d7a30631e" ON "booking_outbox"  ("status") `);
        await queryRunner.query(`ALTER TABLE "booking_seats" ADD CONSTRAINT "FK_25c8b5c1e010af1cd2f699c5926" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_cc20985f14524969dddd128efd5" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_cc20985f14524969dddd128efd5"`);
        await queryRunner.query(`ALTER TABLE "booking_seats" DROP CONSTRAINT "FK_25c8b5c1e010af1cd2f699c5926"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0828e6c14c9d2e2b7d7a30631e"`);
        await queryRunner.query(`DROP TABLE "booking_outbox"`);
        await queryRunner.query(`DROP TYPE "public"."booking_outbox_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc20985f14524969dddd128efd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12b901b34113688b4786368510"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4fa68fd245c509e84e65b507c7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d7b9a157280caf57aa0282e72"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_25c8b5c1e010af1cd2f699c592"`);
        await queryRunner.query(`DROP TABLE "booking_seats"`);
        await queryRunner.query(`DROP TYPE "public"."booking_seats_seat_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48b267d894e32a25ebde4b207a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_311925ef3f94966ea9482de9df"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_64cd97487c5c42806458ab5520"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ba137683172608bf22d69538a"`);
        await queryRunner.query(`DROP TABLE "bookings"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    }

}
