'use strict';

// สร้าง schema แบบเรียกซ้ำได้โดยไม่สร้างตารางเดิมซ้ำ
async function initializeDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE CHECK (username ~ '^[A-Za-z0-9._-]{3,64}$'),
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN','EDITOR','VIEWER')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id_hash CHAR(64) PRIMARY KEY,
      csrf_token TEXT NOT NULL,
      user_id BIGINT REFERENCES app_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id BIGSERIAL PRIMARY KEY,
      entry_date DATE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('INCOME','EXPENSE')),
      title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
      category TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 160),
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','VOID')),
      created_by BIGINT NOT NULL REFERENCES app_users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      voided_by BIGINT REFERENCES app_users(id),
      voided_at TIMESTAMPTZ,
      void_reason TEXT
    );
    ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS legacy_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS ledger_legacy_id_idx ON ledger_transactions(legacy_id);
    CREATE INDEX IF NOT EXISTS ledger_date_idx ON ledger_transactions(entry_date DESC, id DESC);
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id BIGINT REFERENCES app_users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id BIGINT,
      old_value JSONB,
      new_value JSONB,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log(created_at DESC);
  `);
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
}

module.exports = { initializeDatabase };
