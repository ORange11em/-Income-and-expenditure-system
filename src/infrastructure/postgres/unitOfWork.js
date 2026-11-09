'use strict';

// ดูแล BEGIN/COMMIT/ROLLBACK เพื่อให้ use case ไม่ต้องรู้รายละเอียด connection ของ PostgreSQL
class PostgresUnitOfWork {
  constructor(pool) {
    this.pool = pool;
  }

  async run(work) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { PostgresUnitOfWork };
