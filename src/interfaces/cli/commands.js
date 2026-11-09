'use strict';

const fs = require('node:fs');
const { promptSecret } = require('./promptSecret');

// CLI เป็นช่องทางรับคำสั่งดูแลผู้ใช้และนำเข้าข้อมูลบนเซิร์ฟเวอร์
async function runCli({ argv, userAdministration, legacyImport }) {
  const command = argv[2];
  const username = argv[3];
  if (command === 'create-user') {
    const role = argv[4] || 'EDITOR';
    const password = await confirmedPassword();
    const user = await userAdministration.create(username, role, password);
    console.log(`Created ${user.role} user ${user.username}`);
    return true;
  }
  if (command === 'disable-user') {
    const user = await userAdministration.disable(username);
    console.log(`Disabled user ${username}`);
    return true;
  }
  if (command === 'reset-password') {
    await userAdministration.resetPassword(username, await confirmedPassword());
    console.log(`Password reset for ${username}`);
    return true;
  }
  if (command === 'import-json') {
    const file = username;
    if (!file || !fs.existsSync(file)) throw new Error('ระบุ path ของไฟล์ JSON ที่ต้องการนำเข้า');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const items = Array.isArray(parsed) ? parsed : parsed.items;
    console.log(`พบ ${Array.isArray(items) ? items.length : 0} รายการในไฟล์ ${file}`);
    if (await promptSecret('พิมพ์คำว่า IMPORT เพื่อยืนยัน (หรือกด Ctrl+C): ') !== 'IMPORT') {
      throw new Error('ยกเลิกการนำเข้าข้อมูล');
    }
    const result = await legacyImport.importItems(items);
    console.log(`นำเข้า ${result.imported} รายการ; ข้ามรายการที่เคยนำเข้าแล้ว ${result.skipped} รายการ`);
    return true;
  }
  return false;
}

async function confirmedPassword() {
  const password = await promptSecret('รหัสผ่านใหม่ (อย่างน้อย 16 ตัวอักษร): ');
  const confirmation = await promptSecret('ยืนยันรหัสผ่าน: ');
  if (password.length < 16 || password.length > 1024 || password !== confirmation) {
    throw new Error('รหัสผ่านไม่ตรงกัน หรือยาวไม่อยู่ในช่วง 16–1024 ตัวอักษร');
  }
  return password;
}

module.exports = { runCli };
