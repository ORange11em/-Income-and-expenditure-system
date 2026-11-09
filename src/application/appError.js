'use strict';

// Error ที่ use case ต้องการส่งกลับไปยังชั้น HTTP พร้อมรหัสสถานะ
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

module.exports = { AppError };
