'use strict';

// Repository สำหรับบัญชีผู้ใช้; รับ client จาก Unit of Work เมื่ออยู่ใน transaction
class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByUsername(username) {
    const result = await this.pool.query(
      'SELECT id,username,password_hash,role,active FROM app_users WHERE username=$1', [username]
    );
    return result.rows[0] || null;
  }

  async findActiveAdminId() {
    const result = await this.pool.query("SELECT id FROM app_users WHERE role='ADMIN' AND active=true ORDER BY id LIMIT 1");
    return result.rows[0]?.id || null;
  }

  async countActiveAdmins(client = this.pool) {
    const result = await client.query("SELECT count(*)::int AS count FROM app_users WHERE role='ADMIN' AND active=true");
    return result.rows[0].count;
  }

  async create(client, username, passwordHash, role) {
    client = client || this.pool;
    const result = await client.query(
      'INSERT INTO app_users (username,password_hash,role) VALUES ($1,$2,$3) RETURNING id,username,role,active',
      [username, passwordHash, role]
    );
    return result.rows[0];
  }

  async disable(client, username) {
    const result = await client.query(
      'SELECT id,role,active FROM app_users WHERE username=$1 FOR UPDATE', [username]
    );
    const user = result.rows[0];
    if (!user) return null;
    await client.query('UPDATE app_users SET active=false WHERE id=$1', [user.id]);
    return user;
  }

  async updatePassword(client, username, passwordHash) {
    const result = await client.query(
      'UPDATE app_users SET password_hash=$2 WHERE username=$1 RETURNING id,username', [username, passwordHash]
    );
    return result.rows[0] || null;
  }
}

module.exports = { PostgresUserRepository };
