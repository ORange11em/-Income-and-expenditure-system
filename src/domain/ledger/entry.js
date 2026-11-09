'use strict';

// กฎตรวจสอบรายการบัญชีที่ไม่ขึ้นกับเว็บเซิร์ฟเวอร์หรือฐานข้อมูล
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateEntry(input) {
  const type = input?.type;
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const category = typeof input?.category === 'string' ? input.category.trim() : '';
  const amount = String(input?.amount ?? '');
  const amountPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

  if (!['INCOME', 'EXPENSE'].includes(type)) return 'ประเภทข้อมูลไม่ถูกต้อง';
  if (!title || title.length > 500) return 'กรุณาระบุรายละเอียดไม่เกิน 500 ตัวอักษร';
  if (!category || category.length > 160) return 'กรุณาระบุหมวดหมู่ไม่เกิน 160 ตัวอักษร';
  if (!amountPattern.test(amount) || Number(amount) <= 0) return 'จำนวนเงินต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง';
  if (!isValidDate(input?.date)) return 'วันที่ไม่ถูกต้อง';
  return null;
}

function isValidLegacyEntry(item) {
  return Boolean(item && typeof item === 'object' && typeof item.id === 'string' &&
    item.id.length > 0 && item.id.length <= 160 &&
    !validateEntry({ ...item, amount: String(item.amount) }));
}

module.exports = { isValidDate, validateEntry, isValidLegacyEntry };
