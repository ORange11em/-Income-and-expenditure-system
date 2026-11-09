'use strict';

// รับรหัสผ่านจาก terminal แบบไม่แสดงตัวอักษร ป้องกันรหัสผ่านค้างใน shell history
function promptSecret(label) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      return reject(new Error('ต้องเรียกคำสั่งนี้ใน terminal แบบ interactive'));
    }
    let value = '';
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
    };
    const onData = chunk => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') { cleanup(); reject(new Error('ยกเลิก')); return; }
        if (char === '\r' || char === '\n') { cleanup(); resolve(value); return; }
        if (char === '\u007f' || char === '\b') { value = value.slice(0, -1); process.stdout.write('\b \b'); continue; }
        if (char >= ' ' && char !== '\u007f') { value += char; process.stdout.write('*'); }
      }
    };
    process.stdout.write(label);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

module.exports = { promptSecret };
