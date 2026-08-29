import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffManagementColumnsToUsers1787400000000
  implements MigrationInterface
{
  name = 'AddStaffManagementColumnsToUsers1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."users_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';
    `);

    await queryRunner.query(`
      ALTER TABLE "public"."users" 
      ADD COLUMN IF NOT EXISTS "phoneNumber" character varying(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "createdBy" uuid DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "invitationTokenHash" character varying(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "invitationExpiresAt" TIMESTAMP DEFAULT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_invitationTokenHash" ON "public"."users" ("invitationTokenHash");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_users_invitationTokenHash";
    `);
    await queryRunner.query(`
      ALTER TABLE "public"."users" 
      DROP COLUMN IF EXISTS "phoneNumber",
      DROP COLUMN IF EXISTS "createdBy",
      DROP COLUMN IF EXISTS "invitationTokenHash",
      DROP COLUMN IF EXISTS "invitationExpiresAt";
    `);
  }
}
