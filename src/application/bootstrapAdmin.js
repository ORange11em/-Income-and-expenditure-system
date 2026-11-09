'use strict';

// สร้างบัญชี ADMIN ครั้งแรกจาก environment โดยไม่รีเซ็ตรหัสผ่านบัญชีเดิม
async function bootstrapAdmin({ userRepository, passwordHasher, username, password }) {
  if (!username || !password || await userRepository.findByUsername(username)) return false;
  if (password.length < 16 || password.includes('CHANGE_ME')) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be a unique password of at least 16 characters');
  }
  await userRepository.create(null, username, await passwordHasher.hash(password), 'ADMIN');
  console.log(`Created initial administrator: ${username}`);
  return true;
}

module.exports = { bootstrapAdmin };
