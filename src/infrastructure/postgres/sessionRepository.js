'use strict';

// Repository สำหรับ session ฝั่งเซิร์ฟเวอร์ รวมทั้งลบ session เมื่อปิดบัญชี/เปลี่ยนรหัสผ่าน
class PostgresSessionRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(idHash, csrfToken, userId, sessionDays) {
    await this.pool.query(
      `INSERT INTO sessions (id_hash,csrf_token,user_id,expires_at)
       VALUES ($1,$2,$3,now()+($4 * interval '1 day'))`, [idHash, csrfToken, userId, sessionDays]
    );
  }

  async findByIdHash(idHash) {
    const result = await this.pool.query(
      `SELECT s.id_hash,s.csrf_token,s.expires_at,u.id AS user_id,u.username,u.role,u.active
       FROM sessions s LEFT JOIN app_users u ON u.id=s.user_id
       WHERE s.id_hash=$1 AND s.expires_at>now()`, [idHash]
    );
    return result.rows[0] || null;
  }

  async deleteByIdHash(idHash) {
    await this.pool.query('DELETE FROM sessions WHERE id_hash=$1', [idHash]);
  }

  async deleteByUserId(client, userId) {
    await client.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
  }

  async cleanExpired() {
    await this.pool.query('DELETE FROM sessions WHERE expires_at<=now()');
  }
}

module.exports = { PostgresSessionRepository };
