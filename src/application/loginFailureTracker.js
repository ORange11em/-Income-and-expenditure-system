'use strict';

// นับการเข้าสู่ระบบที่ล้มเหลวในหน่วยความจำของ process ตามช่วงเวลา
class LoginFailureTracker {
  constructor() {
    this.attempts = new Map();
  }

  get(key) { return this.attempts.get(key); }
  set(key, value) { this.attempts.set(key, value); }
  clear(key) { this.attempts.delete(key); }
}

module.exports = { LoginFailureTracker };
