ALTER TABLE "order" ADD COLUMN "payment_status" TEXT NOT NULL DEFAULT 'unpaid' CHECK ("payment_status" IN ('unpaid', 'partial', 'paid'));
ALTER TABLE "order" ADD COLUMN "paid_amount" REAL NOT NULL DEFAULT 0;
