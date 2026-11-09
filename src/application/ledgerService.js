'use strict';

const { AppError } = require('./appError');
const { validateEntry } = require('../domain/ledger/entry');

// Use cases ของบัญชีรายการ: รวมกฎสิทธิ์ การตรวจข้อมูล ธุรกรรม และ audit
function createLedgerService({ ledgerRepository, auditRepository, unitOfWork }) {
  function requireWriter(user) {
    if (!user || !['ADMIN', 'EDITOR'].includes(user.role)) throw new AppError(403, 'บัญชีนี้ไม่มีสิทธิ์ทำรายการ');
  }

  return {
    async list() {
      const [items, summary] = await Promise.all([ledgerRepository.list(), ledgerRepository.summary()]);
      return { items, summary };
    },

    async create(user, input) {
      requireWriter(user);
      const validationError = validateEntry(input);
      if (validationError) throw new AppError(400, validationError);
      return unitOfWork.run(async client => {
        const item = await ledgerRepository.create(client, input, user.id);
        await auditRepository.record(client, {
          actorId: user.id, action: 'CREATE', entityId: item.id,
          newValue: item, entityType: 'transaction'
        });
        return item;
      });
    },

    async void(user, id, reason) {
      requireWriter(user);
      const cleanReason = typeof reason === 'string' ? reason.trim() : '';
      if (cleanReason.length < 3 || cleanReason.length > 500) {
        throw new AppError(400, 'กรุณาระบุเหตุผลการยกเลิก 3–500 ตัวอักษร');
      }
      return unitOfWork.run(async client => {
        const before = await ledgerRepository.findByIdForUpdate(client, id);
        if (!before) throw new AppError(404, 'ไม่พบรายการ');
        if (before.status === 'VOID') return { ok: true };
        const after = await ledgerRepository.void(client, id, user.id, cleanReason);
        await auditRepository.record(client, {
          actorId: user.id, action: 'VOID', entityId: Number(id),
          oldValue: before, newValue: after, reason: cleanReason, entityType: 'transaction'
        });
        return { ok: true };
      });
    },

    async audit(user, limit = 1000) {
      if (user?.role !== 'ADMIN') throw new AppError(403, 'เฉพาะผู้ดูแลระบบเท่านั้น');
      return auditRepository.listRecent(limit);
    }
  };
}

module.exports = { createLedgerService };
