-- Migration 0002: keyset pagination index for transaction list
-- Supports TransactionRepositoryImpl.findPage:
-- WHERE user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?))
-- ORDER BY created_at DESC, id DESC LIMIT ?
CREATE INDEX IF NOT EXISTS "transaction_user_id_created_at_id_idx"
ON "transaction" ("user_id","created_at","id");
