'use strict';

// บันทึกและอ่านประวัติการเปลี่ยนแปลง โดยรับ client เดียวกับ transaction ของ use case
class PostgresAuditRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async record(client, event) {
    await client.query(
      `INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,old_value,new_value,reason)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
      [event.actorId || null, event.action, event.entityType || 'transaction', event.entityId || null,
        event.oldValue ? JSON.stringify(event.oldValue) : null,
        event.newValue ? JSON.stringify(event.newValue) : null, event.reason || null]
    );
  }

  async listRecent(limit = 1000) {
    const result = await this.pool.query(
      `SELECT a.id,a.action,a.entity_type,a.entity_id,a.old_value,a.new_value,a.reason,a.created_at,
              u.username AS actor
       FROM audit_log a LEFT JOIN app_users u ON u.id=a.actor_user_id
       ORDER BY a.created_at DESC LIMIT $1`, [limit]
    );
    return result.rows;
  }
}

module.exports = { PostgresAuditRepository };
