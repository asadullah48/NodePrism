/*
  Warnings:

  - Changed the type of `type` on the `UptimeCheck` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('http', 'tcp');

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_checkId_fkey";

-- AlterTable
ALTER TABLE "UptimeCheck" DROP COLUMN "type",
ADD COLUMN     "type" "CheckType" NOT NULL;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "UptimeCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
