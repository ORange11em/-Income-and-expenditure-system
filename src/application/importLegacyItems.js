'use strict';

const { AppError } = require('./appError');
const { isValidLegacyEntry } = require('../domain/ledger/entry');

// ย้ายรายการจาก JSON รุ่น browser-only โดยป้องกันการนำ source ID เดิมเข้าซ้ำ
function createLegacyImportService({ userRepository, ledgerRepository, auditRepository, unitOfWork }) {
  return {
    async importItems(items) {
      if (!Array.isArray(items) || items.length > 100000 || !items.every(isValidLegacyEntry)) {
        throw new AppError(400, 'ไฟล์ JSON ไม่ถูกต้อง หรือมีรายการเกิน 100,000 รายการ');
      }
      const adminId = await userRepository.findActiveAdminId();
      if (!adminId) throw new AppError(400, 'ต้องสร้างบัญชี ADMIN ก่อนนำเข้าข้อมูล');

      return unitOfWork.run(async client => {
        let imported = 0;
        for (const source of items) {
          const item = await ledgerRepository.importLegacy(client, source, adminId);
          if (!item) continue;
          await auditRepository.record(client, {
            actorId: adminId, action: 'IMPORT', entityType: 'transaction', entityId: item.id,
            newValue: { source_id: source.id, date: source.date, type: source.type,
              title: source.title, category: source.category, amount: source.amount },
            reason: 'ย้ายข้อมูลจากระบบเดิมผ่านไฟล์สำรอง JSON'
          });
          imported += 1;
        }
        return { imported, skipped: items.length - imported };
      });
    }
  };
}

module.exports = { createLegacyImportService };
