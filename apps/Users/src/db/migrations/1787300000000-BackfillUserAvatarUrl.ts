import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillUserAvatarUrl1787300000000 implements MigrationInterface {
  name = 'BackfillUserAvatarUrl1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.users 
      SET "avatarUrl" = CONCAT('http://localhost:3000/api/v1/media/', "avatarKey") 
      WHERE "avatarKey" IS NOT NULL AND ("avatarUrl" IS NULL OR "avatarUrl" = '');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversible no-op
  }
}
