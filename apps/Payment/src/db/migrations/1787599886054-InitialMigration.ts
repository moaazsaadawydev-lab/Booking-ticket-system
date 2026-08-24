import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1787599886054 implements MigrationInterface {
    name = 'InitialMigration1787599886054'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payments_method_enum" AS ENUM('CARD', 'WALLET')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "user_id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'EGP', "provider" character varying(50) NOT NULL DEFAULT 'PAYMOB', "method" "public"."payments_method_enum" NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "provider_order_id" character varying(100), "provider_transaction_id" character varying(100), "payment_token" text, "failure_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c11a1cb3a986f509e44e221921f" UNIQUE ("provider_transaction_id"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e86edf76dc2424f123b9023a2b" ON "payments"  ("booking_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_427785468fb7d2733f59e7d7d3" ON "payments"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_32b41cdb985a296213e9a928b5" ON "payments"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_241b3e4b04442d6ea0fd56b203" ON "payments"  ("provider_order_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c11a1cb3a986f509e44e221921" ON "payments"  ("provider_transaction_id") `);
        await queryRunner.query(`CREATE TABLE "payment_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" uuid, "event_type" character varying(100) NOT NULL, "provider_transaction_id" character varying(100), "raw_payload" jsonb NOT NULL, "signature" character varying(255), "is_valid_signature" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b5bda25324e539ea41bc09697f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6508afaa58d3f3e97c347631c0" ON "payment_logs"  ("payment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bed8eba341bfcc3802f23a8ef8" ON "payment_logs"  ("event_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_773bd10caea8e00d6c9e8b0fba" ON "payment_logs"  ("provider_transaction_id") `);
        await queryRunner.query(`CREATE TYPE "public"."payment_outbox_status_enum" AS ENUM('PENDING', 'PUBLISHED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "payment_outbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_type" character varying(100) NOT NULL, "routing_key" character varying(100), "payload" jsonb NOT NULL, "status" "public"."payment_outbox_status_enum" NOT NULL DEFAULT 'PENDING', "retry_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_70f409ce53496b180a03281be84" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_95af4d45565fdb39fcd1ee2a12" ON "payment_outbox"  ("event_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_fcc082ee350ee3f3a9ca600dd8" ON "payment_outbox"  ("status") `);
        await queryRunner.query(`ALTER TABLE "payment_logs" ADD CONSTRAINT "FK_6508afaa58d3f3e97c347631c0c" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_logs" DROP CONSTRAINT "FK_6508afaa58d3f3e97c347631c0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fcc082ee350ee3f3a9ca600dd8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95af4d45565fdb39fcd1ee2a12"`);
        await queryRunner.query(`DROP TABLE "payment_outbox"`);
        await queryRunner.query(`DROP TYPE "public"."payment_outbox_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_773bd10caea8e00d6c9e8b0fba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bed8eba341bfcc3802f23a8ef8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6508afaa58d3f3e97c347631c0"`);
        await queryRunner.query(`DROP TABLE "payment_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c11a1cb3a986f509e44e221921"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_241b3e4b04442d6ea0fd56b203"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32b41cdb985a296213e9a928b5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_427785468fb7d2733f59e7d7d3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e86edf76dc2424f123b9023a2b"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
    }

}
