'use strict';

// หมวดแนะนำในแบบฟอร์ม ผู้ใช้ยังพิมพ์หมวดที่โรงพยาบาลกำหนดเองได้
const categories = [
  'งบประจำปีจาก รพ.อากาศอำนวย', 'งบลงทุนครุภัณฑ์คอมพิวเตอร์ (CAPEX)',
  'งบสำรองฉุกเฉิน / บำรุงรักษาเร่งด่วน', 'รายรับอื่นๆ ของแผนก IT',
  'ระบบ HOSxP / HIS / Software', 'คอมพิวเตอร์ / เครื่องพิมพ์จุดบริการ',
  'ระบบเครือข่าย / Server / อินเทอร์เน็ต', 'ค่าบำรุงรักษา (MA) / ซ่อมแซม',
  'วัสดุสิ้นเปลือง IT (หมึก/สายแลน/อะไหล่)'
];
let csrfToken = '';
let currentUser = null;
let entries = [];
let toastTimer;

const $ = selector => document.querySelector(selector);
const money = value => '฿' + Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function api(path, options = {}) {
  // แนบ CSRF token กับคำขอที่เปลี่ยนข้อมูล; เบราว์เซอร์ส่ง session cookie ให้อัตโนมัติ
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) showLoggedOut();
    throw new Error(data.error || 'คำขอไม่สำเร็จ');
  }
  return data;
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function showLoggedOut() {
  currentUser = null;
  $('#user-label').textContent = '';
  $('#logout-button').classList.add('hidden');
  $('#app-panel').classList.add('hidden');
  $('#login-panel').classList.remove('hidden');
}

function showLoggedIn(user) {
  currentUser = user;
  $('#user-label').textContent = `${user.username} · ${user.role}`;
  $('#logout-button').classList.remove('hidden');
  $('#login-panel').classList.add('hidden');
  $('#app-panel').classList.remove('hidden');
  $('#entry-panel').classList.toggle('hidden', user.role === 'VIEWER');
  $('#audit-button').classList.toggle('hidden', user.role !== 'ADMIN');
}

function notify(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.style.background = error ? '#8f2929' : '#153b45';
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function setSummary(summary) {
  $('#summary-income').textContent = money(summary.income);
  $('#summary-expense').textContent = money(summary.expense);
  $('#summary-balance').textContent = money(summary.balance);
}

function renderTable() {
  // แสดงค่าด้วย textContent เพื่อไม่ให้รายละเอียดถูกตีความเป็น HTML
  const body = $('#ledger-body');
  const term = $('#search-input').value.trim().toLocaleLowerCase('th');
  const type = $('#type-filter').value;
  const status = $('#status-filter').value;
  const shown = entries.filter(item =>
    (type === 'ALL' || item.type === type) &&
    (status === 'ALL' || item.status === status) &&
    (!term || `${item.title} ${item.category}`.toLocaleLowerCase('th').includes(term))
  );
  body.replaceChildren();
  if (!shown.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = 'ไม่พบรายการ';
    row.append(cell);
    body.append(row);
    return;
  }
  for (const item of shown) {
    const row = document.createElement('tr');
    if (item.status === 'VOID') row.classList.add('void-row');
    const values = [item.date, item.type === 'INCOME' ? 'รายรับ' : 'รายจ่าย', item.title, item.category];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    for (const kind of ['INCOME', 'EXPENSE']) {
      const cell = document.createElement('td');
      cell.className = 'numeric';
      cell.textContent = item.type === kind ? money(item.amount) : '—';
      row.append(cell);
    }
    const actionCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `status${item.status === 'VOID' ? ' void' : ''}`;
    badge.textContent = item.status === 'VOID' ? 'ยกเลิก' : 'ใช้งาน';
    actionCell.append(badge);
    if (item.status === 'VOID' && item.void_reason) {
      const reason = document.createElement('div');
      reason.className = 'muted';
      reason.textContent = `เหตุผล: ${item.void_reason}`;
      actionCell.append(reason);
    }
    if (item.status === 'ACTIVE' && currentUser && ['ADMIN', 'EDITOR'].includes(currentUser.role)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'row-action';
      button.dataset.voidId = item.id;
      button.textContent = 'ยกเลิก';
      actionCell.append(document.createTextNode(' '), button);
    }
    row.append(actionCell);
    body.append(row);
  }
}

async function refresh() {
  const data = await api('/api/transactions');
  entries = data.items;
  setSummary(data.summary);
  renderTable();
}

function exportCsv() {
  // ใส่ BOM สำหรับภาษาไทย และป้องกันข้อความที่ spreadsheet อาจตีความเป็นสูตร
  const quote = value => {
    const raw = String(value ?? '');
    const guarded = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
    return `"${guarded.replace(/"/g, '""')}"`;
  };
  const rows = [
    ['วันที่', 'ประเภท', 'รายการ', 'หมวดหมู่', 'จำนวนเงิน', 'สถานะ', 'เหตุผลยกเลิก'],
    ...entries.map(item => [item.date, item.type === 'INCOME' ? 'รายรับ' : 'รายจ่าย', item.title, item.category, item.amount, item.status, item.void_reason || ''])
  ];
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `ทะเบียนรายรับรายจ่าย_IT_${localDate()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function start() {
  // ขอ session และ CSRF token ก่อนแสดงแบบฟอร์มหรืออ่านบัญชีรายการ
  if (window.location.protocol === 'file:') {
    showLoggedOut();
    $('#login-form').querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    $('#login-error').textContent = 'กำลังเปิดไฟล์ตัวอย่างโดยตรง ระบบจริงต้องเปิดผ่าน URL HTTPS ของเซิร์ฟเวอร์ก่อน จึงจะเข้าสู่ระบบและบันทึกข้อมูลได้';
    return;
  }
  const session = await api('/api/session');
  csrfToken = session.csrfToken;
  if (session.user) {
    showLoggedIn(session.user);
    await refresh();
  } else showLoggedOut();
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#login-error').textContent = '';
  const form = new FormData(event.currentTarget);
  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
    });
    csrfToken = result.csrfToken;
    event.currentTarget.reset();
    showLoggedIn(result.user);
    await refresh();
  } catch (error) { $('#login-error').textContent = error.message; }
});

$('#logout-button').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST', body: '{}' }); }
  finally { await start(); }
});

$('#entry-form').addEventListener('submit', async event => {
  // ส่งรายการใหม่ไปบันทึกที่ server; ข้อมูลจริงไม่ได้เก็บใน browser storage
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const entry = Object.fromEntries(form.entries());
  try {
    await api('/api/transactions', { method: 'POST', body: JSON.stringify(entry) });
    event.currentTarget.reset();
    event.currentTarget.elements.date.value = localDate();
    $('#entry-message').textContent = 'บันทึกรายการแล้ว';
    await refresh();
  } catch (error) { $('#entry-message').textContent = error.message; }
});

$('#ledger-body').addEventListener('click', async event => {
  // การแก้รายการย้อนหลังทำผ่านการยกเลิกพร้อมเหตุผล ไม่ลบหลักฐานเดิม
  const button = event.target.closest('button[data-void-id]');
  if (!button) return;
  const reason = window.prompt('ระบุเหตุผลที่ยกเลิกรายการ (อย่างน้อย 3 ตัวอักษร)');
  if (reason === null) return;
  try {
    await api(`/api/transactions/${button.dataset.voidId}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
    await refresh();
    notify('ยกเลิกรายการแล้ว และเก็บประวัติไว้');
  } catch (error) { notify(error.message, true); }
});

for (const selector of ['#search-input', '#type-filter', '#status-filter']) {
  $(selector).addEventListener(selector === '#search-input' ? 'input' : 'change', renderTable);
}
$('#csv-button').addEventListener('click', exportCsv);
$('#audit-button').addEventListener('click', async () => {
  // API ตรวจ ADMIN role ที่ server ก่อนส่งประวัติการเปลี่ยนแปลง
  try {
    const result = await api('/api/audit');
    const body = $('#audit-body');
    body.replaceChildren();
    for (const item of result.items) {
      const row = document.createElement('tr');
      const details = item.reason || item.new_value?.title || item.old_value?.title || item.new_value?.username || JSON.stringify(item.new_value || item.old_value || {});
      for (const value of [new Date(item.created_at).toLocaleString('th-TH'), item.actor || '—', item.action, item.entity_id || '—', details]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    $('#audit-panel').classList.remove('hidden');
    $('#audit-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { notify(error.message, true); }
});
$('#audit-close').addEventListener('click', () => $('#audit-panel').classList.add('hidden'));
$('#entry-form').elements.type.addEventListener('change', event => {
  const options = event.target.value === 'INCOME' ? categories.slice(0, 4) : categories.slice(4);
  const list = $('#category-options');
  list.replaceChildren(...options.map(value => {
    const option = document.createElement('option');
    option.value = value;
    return option;
  }));
});
$('#entry-form').elements.date.value = localDate();
$('#entry-form').elements.type.dispatchEvent(new Event('change'));
start().catch(error => {
  showLoggedOut();
  $('#login-error').textContent = `เชื่อมต่อระบบไม่ได้: ${error.message}`;
});
