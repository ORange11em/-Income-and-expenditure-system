'use strict';

const { AppError } = require('./appError');

// Use cases สำหรับจัดการบัญชีผู้ใช้ผ่าน terminal ของเซิร์ฟเวอร์
function createUserAdministrationService({ userRepository, sessionRepository, auditRepository, passwordHasher, unitOfWork }) {
  function validateAccount(username, role) {
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(username || '')) throw new AppError(400, 'ชื่อผู้ใช้ต้องยาว 3–64 ตัว ใช้ A-Z, 0-9, จุด, _ หรือ -');
    if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) throw new AppError(400, 'role ต้องเป็น ADMIN, EDITOR หรือ VIEWER');
  }

  return {
    async create(username, role, password) {
      validateAccount(username, role);
      if (password.length < 16 || password.length > 1024) throw new AppError(400, 'รหัสผ่านต้องยาว 16–1024 ตัวอักษร');
      const passwordHash = await passwordHasher.hash(password);
      return unitOfWork.run(async client => {
        const user = await userRepository.create(client, username, passwordHash, role);
        await auditRepository.record(client, {
          actorId: null, action: 'USER_CREATED', entityType: 'user', entityId: user.id,
          newValue: { username: user.username, role: user.role }, reason: 'สร้างบัญชีผ่านคำสั่งผู้ดูแลเซิร์ฟเวอร์'
        });
        return user;
      });
    },

    async disable(username) {
      return unitOfWork.run(async client => {
        const user = await userRepository.disable(client, username);
        if (!user) throw new AppError(404, 'ไม่พบผู้ใช้');
        if (user.active && user.role === 'ADMIN' && await userRepository.countActiveAdmins(client) < 1) {
          throw new AppError(400, 'ปิดบัญชี ADMIN คนสุดท้ายไม่ได้');
        }
        await sessionRepository.deleteByUserId(client, user.id);
        await auditRepository.record(client, {
          actorId: null, action: 'USER_DISABLED', entityType: 'user', entityId: user.id,
          newValue: { username }, reason: 'ปิดบัญชีผ่านคำสั่งผู้ดูแลเซิร์ฟเวอร์'
        });
        return user;
      });
    },

    async resetPassword(username, password) {
      if (password.length < 16 || password.length > 1024) throw new AppError(400, 'รหัสผ่านต้องยาว 16–1024 ตัวอักษร');
      const passwordHash = await passwordHasher.hash(password);
      return unitOfWork.run(async client => {
        const user = await userRepository.updatePassword(client, username, passwordHash);
        if (!user) throw new AppError(404, 'ไม่พบผู้ใช้');
        await sessionRepository.deleteByUserId(client, user.id);
        await auditRepository.record(client, {
          actorId: null, action: 'USER_PASSWORD_RESET', entityType: 'user', entityId: user.id,
          newValue: { username }, reason: 'รีเซ็ตรหัสผ่านผ่านคำสั่งผู้ดูแลเซิร์ฟเวอร์'
        });
        return user;
      });
    }
  };
}

module.exports = { createUserAdministrationService };
