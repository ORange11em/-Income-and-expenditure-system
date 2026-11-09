'use strict';

// Repository นี้เป็นตัวแปลงคำสั่งของบัญชีรายการให้เป็น SQL/PostgreSQL
class PostgresLedgerRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async list() {
    const result = await this.pool.query(
      `SELECT id, entry_date AS date, type, title, category, amount::text AS amount,
              status, created_at, created_by, void_reason, voided_at, voided_by
       FROM ledger_transactions ORDER BY entry_date DESC, created_at DESC`
    );
    return result.rows;
  }

  async summary() {
    const result = await this.pool.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE type='INCOME' AND status='ACTIVE'),0)::text AS income,
              COALESCE(SUM(amount) FILTER (WHERE type='EXPENSE' AND status='ACTIVE'),0)::text AS expense
       FROM ledger_transactions`
    );
    const income = Number(result.rows[0].income);
    const expense = Number(result.rows[0].expense);
    return { income, expense, balance: income - expense };
  }

  async create(client, input, userId) {
    const result = await client.query(
      `INSERT INTO ledger_transactions (entry_date,type,title,category,amount,created_by)
       VALUES ($1,$2,$3,$4,$5::numeric(14,2),$6)
       RETURNING id, entry_date AS date, type, title, category, amount::text AS amount, status, created_at, created_by`,
      [input.date, input.type, input.title.trim(), input.category.trim(), String(input.amount), userId]
    );
    return result.rows[0];
  }

  async importLegacy(client, input, userId) {
    const result = await client.query(
      `INSERT INTO ledger_transactions (entry_date,type,title,category,amount,created_by,legacy_id)
       VALUES ($1,$2,$3,$4,$5::numeric(14,2),$6,$7)
       ON CONFLICT (legacy_id) DO NOTHING RETURNING id`,
      [input.date, input.type, input.title.trim(), input.category.trim(), String(input.amount), userId, input.id]
    );
    return result.rows[0] || null;
  }

  async findByIdForUpdate(client, id) {
    const result = await client.query('SELECT * FROM ledger_transactions WHERE id=$1 FOR UPDATE', [id]);
    return result.rows[0] || null;
  }

  async void(client, id, userId, reason) {
    const result = await client.query(
      `UPDATE ledger_transactions SET status='VOID',voided_by=$2,voided_at=now(),void_reason=$3
       WHERE id=$1 RETURNING *`, [id, userId, reason]
    );
    return result.rows[0] || null;
  }
}

module.exports = { PostgresLedgerRepository };
