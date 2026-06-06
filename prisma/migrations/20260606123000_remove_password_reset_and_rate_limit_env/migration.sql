-- Remove self-service password reset storage.
DROP TABLE IF EXISTS "password_reset_tokens";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "tokenVersion";
