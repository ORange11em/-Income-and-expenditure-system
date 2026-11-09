/*
 * ระบบรายรับ-รายจ่าย แผนก IT โรงพยาบาลอากาศอำนวย
 * รุ่นปรับปรุง: เก็บข้อมูลใน localStorage ของเบราว์เซอร์เครื่องนี้
 * หมายเหตุ: ไม่ใช่ฐานข้อมูลส่วนกลางหรือระบบบัญชีที่มี audit log
 */
'use strict';

const STORAGE_KEY = 'akat_amnuai_it_ledger_v3';
const LEGACY_STORAGE_KEY = 'akat_amnuai_it_simple_ledger_v2';

const EXPENSE_CATEGORIES = [
  'ระบบ HOSxP / HIS / Software',
  'คอมพิวเตอร์ / เครื่องพิมพ์จุดบริการ',
  'ระบบเครือข่าย / Server / อินเทอร์เน็ต',
  'ค่าบำรุงรักษา (MA) / ซ่อมแซม',
  'วัสดุสิ้นเปลือง IT (หมึก/สายแลน/อะไหล่)'
];

const INCOME_CATEGORIES = [
  'งบประจำปีจาก รพ.อากาศอำนวย',
  'งบลงทุนครุภัณฑ์คอมพิวเตอร์ (CAPEX)',
  'งบสำรองฉุกเฉิน / บำรุงรักษาเร่งด่วน',
  'รายรับอื่นๆ ของแผนก IT'
];

let items = loadItems();
let chartInstance = null;

function isValidItem(item) {
  return item && typeof item === 'object' &&
    typeof item.id === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    (item.type === 'INCOME' || item.type === 'EXPENSE') &&
    typeof item.title === 'string' &&
    typeof item.category === 'string' &&
    Number.isFinite(Number(item.amount)) && Number(item.amount) > 0;
}

function loadItems() {
  // อ่านจาก localStorage ของ browser นี้ก่อน; ถ้าพบคีย์รุ่นก่อนให้ย้ายมา v3
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isValidItem) : [];
    }

    // นำเข้าข้อมูลจากรุ่นเดิมถ้ามี โดยไม่สร้างรายการตัวอย่างขึ้นมาเอง
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      const parsedLegacy = JSON.parse(legacy);
      const migrated = Array.isArray(parsedLegacy) ? parsedLegacy.filter(isValidItem) : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    window.setTimeout(() => showToast('อ่านข้อมูลไม่ได้ กรุณาตรวจสอบการตั้งค่า/พื้นที่จัดเก็บของเบราว์เซอร์'), 0);
  }
  return [];
}

function saveItems() {
  // บันทึกเฉพาะใน browser เครื่องนี้ จึงไม่เหมาะใช้เป็นฐานข้อมูลร่วมของหน่วยงาน
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (error) {
    showToast('บันทึกไม่สำเร็จ พื้นที่จัดเก็บอาจเต็มหรือถูกปิด กรุณาส่งออกข้อมูลสำรอง');
    return false;
  }
}

function formatMoney(value) {
  return '฿' + Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function newId() {
  return window.crypto && typeof window.crypto.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `TX-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  const box = document.getElementById('toast-container');
  document.getElementById('toast-message').textContent = message;
  box.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => box.classList.add('hidden'), 3500);
}

function setEntryMode(mode) {
  document.getElementById('entry-type').value = mode;
  const expenseButton = document.getElementById('btn-type-expense');
  const incomeButton = document.getElementById('btn-type-income');
  const categorySelect = document.getElementById('entry-category');
  const submitButton = document.getElementById('btn-submit-entry');
  const titleInput = document.getElementById('entry-title');
  const isExpense = mode === 'EXPENSE';

  expenseButton.className = isExpense
    ? 'py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 border-rose-600 bg-rose-600 text-white shadow-sm flex items-center justify-center gap-2 transition'
    : 'py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 border-slate-200 bg-slate-50 text-slate-600 hover:bg-rose-50 hover:border-rose-300 flex items-center justify-center gap-2 transition';
  incomeButton.className = !isExpense
    ? 'py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 border-emerald-600 bg-emerald-600 text-white shadow-sm flex items-center justify-center gap-2 transition'
    : 'py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 border-slate-200 bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center gap-2 transition';
  categorySelect.replaceChildren(...(isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    return option;
  }));
  submitButton.className = `w-full py-3 px-4 ${isExpense ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold text-sm rounded-xl shadow-sm transition`;
  submitButton.textContent = isExpense
    ? 'บันทึกรายจ่าย (นำไปหักออกจากรายรับ)'
    : '+ บันทึกรายรับ (เพิ่มงบเข้าแผนก IT)';
  titleInput.placeholder = isExpense
    ? 'เช่น ซื้อคอมพิวเตอร์จุดตรวจ OPD, ซื้อหมึกพิมพ์ห้องยา'
    : 'เช่น รับงบประมาณ IT ประจำปีจาก รพ.อากาศอำนวย';
}

function renderSummary() {
  // รวมรายรับและรายจ่ายเพื่อแสดงยอดคงเหลือบนการ์ดสรุป
  const incomes = items.filter(item => item.type === 'INCOME');
  const expenses = items.filter(item => item.type === 'EXPENSE');
  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalExpense = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const netBalance = totalIncome - totalExpense;
  const spentPct = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  const remainPct = totalIncome > 0 ? Math.max(0, 100 - spentPct) : 0;

  document.getElementById('kpi-total-income').textContent = formatMoney(totalIncome);
  document.getElementById('kpi-income-count').textContent = `รวม ${incomes.length} รายการรายรับ`;
  document.getElementById('kpi-total-expense').textContent = formatMoney(totalExpense);
  document.getElementById('kpi-expense-count').textContent = `รวม ${expenses.length} รายการ (ใช้ไป ${spentPct.toFixed(1)}%)`;
  document.getElementById('kpi-net-balance').textContent = formatMoney(netBalance);
  document.getElementById('kpi-remain-pct').textContent = totalIncome > 0
    ? `คงเหลือ ${remainPct.toFixed(1)}% ของรายรับทั้งหมด`
    : 'ยังไม่มีรายการรายรับตั้งต้น';
  document.getElementById('bar-spent-pct').textContent = `${spentPct.toFixed(1)}%`;
  document.getElementById('bar-remain-pct').textContent = `${remainPct.toFixed(1)}%`;
  document.getElementById('bar-spent').style.width = `${Math.min(100, spentPct)}%`;
  document.getElementById('bar-remain').style.width = `${remainPct}%`;
}

function renderChartAndCategoryList() {
  const expenses = items.filter(item => item.type === 'EXPENSE');
  const totals = EXPENSE_CATEGORIES.map(category => expenses
    .filter(item => item.category === category)
    .reduce((sum, item) => sum + Number(item.amount), 0));
  const context = document.getElementById('summaryChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(context, {
    type: 'doughnut',
    data: {
      labels: EXPENSE_CATEGORIES,
      datasets: [{
        data: totals,
        backgroundColor: ['#0d9488', '#0284c7', '#6366f1', '#f59e0b', '#ec4899'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { family: "'Sarabun', sans-serif", size: 11 } } } }
    }
  });

  document.getElementById('category-breakdown-list').innerHTML = EXPENSE_CATEGORIES.map((category, index) => `
    <div class="flex items-center justify-between text-slate-600">
      <span class="truncate pr-2">${escapeHtml(category)}</span>
      <span class="font-bold text-slate-900 shrink-0">${formatMoney(totals[index])}</span>
    </div>`).join('');
}

function renderTable() {
  // ค้นหา/กรองรายการก่อนวาดตาราง และคำนวณยอดท้ายตารางจากแถวที่แสดง
  const search = document.getElementById('search-input').value.trim().toLocaleLowerCase('th');
  const typeFilter = document.getElementById('filter-type').value;
  const filtered = items.filter(item => {
    const matchType = typeFilter === 'ALL' || item.type === typeFilter;
    const matchSearch = !search || item.title.toLocaleLowerCase('th').includes(search) || item.category.toLocaleLowerCase('th').includes(search);
    return matchType && matchSearch;
  }).sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  const tbody = document.getElementById('ledger-tbody');
  const tfoot = document.getElementById('ledger-tfoot');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400">ยังไม่มีรายการข้อมูล สามารถกรอกได้ที่ฟอร์มด้านบน</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  let sumIncome = 0;
  let sumExpense = 0;
  tbody.innerHTML = filtered.map(item => {
    const isIncome = item.type === 'INCOME';
    if (isIncome) sumIncome += Number(item.amount);
    else sumExpense += Number(item.amount);
    return `<tr class="hover:bg-slate-50 transition">
      <td class="py-3 px-4 whitespace-nowrap text-slate-500">${escapeHtml(item.date)}</td>
      <td class="py-3 px-4 whitespace-nowrap">${isIncome
        ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">+ รายรับ</span>'
        : '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">− รายจ่าย</span>'}</td>
      <td class="py-3 px-4 font-semibold text-slate-900">${escapeHtml(item.title)}</td>
      <td class="py-3 px-4 text-slate-600">${escapeHtml(item.category)}</td>
      <td class="py-3 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">${isIncome ? '+' + formatMoney(item.amount) : '-'}</td>
      <td class="py-3 px-4 text-right font-bold text-rose-600 whitespace-nowrap">${!isIncome ? '−' + formatMoney(item.amount) : '-'}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap"><button type="button" data-delete-id="${escapeHtml(item.id)}" class="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded hover:bg-rose-50 transition">ลบ</button></td>
    </tr>`;
  }).join('');

  tfoot.innerHTML = `<tr>
    <td colspan="4" class="py-3.5 px-4 text-slate-900">สรุปยอดรวม (รายรับ − รายจ่าย = คงเหลือสุทธิ)</td>
    <td class="py-3.5 px-4 text-right text-emerald-700">+${formatMoney(sumIncome)}</td>
    <td class="py-3.5 px-4 text-right text-rose-600">−${formatMoney(sumExpense)}</td>
    <td class="py-3.5 px-4 text-right text-teal-800 text-base whitespace-nowrap">= ${formatMoney(sumIncome - sumExpense)}</td>
  </tr>`;
}

function renderAll() {
  renderSummary();
  renderChartAndCategoryList();
  renderTable();
}

function csvCell(value) {
  // ป้องกันสูตรใน CSV เมื่อเปิดด้วยโปรแกรมตารางคำนวณ
  const safe = /^[\s]*[=+@\-]/.test(String(value ?? '')) ? `'${value}` : String(value ?? '');
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCSV() {
  const totalIncome = items.filter(item => item.type === 'INCOME').reduce((sum, item) => sum + Number(item.amount), 0);
  const totalExpense = items.filter(item => item.type === 'EXPENSE').reduce((sum, item) => sum + Number(item.amount), 0);
  const rows = [
    ['สรุปรายรับ-รายจ่าย แผนก IT โรงพยาบาลอากาศอำนวย'],
    ['รายรับรวมทั้งหมด (บาท)', totalIncome],
    ['รายจ่ายรวมทั้งหมด (บาท)', totalExpense],
    ['คงเหลือสุทธิ (บาท)', totalIncome - totalExpense],
    [], ['วันที่', 'ประเภท', 'รายการ', 'หมวดหมู่', 'รายรับ (+)', 'รายจ่าย (-)']
  ];
  items.forEach(item => rows.push([
    item.date, item.type === 'INCOME' ? 'รายรับ' : 'รายจ่าย', item.title, item.category,
    item.type === 'INCOME' ? item.amount : '', item.type === 'EXPENSE' ? item.amount : ''
  ]));
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  downloadFile('รายรับรายจ่าย_IT_รพ_อากาศอำนวย.csv', csv, 'text/csv;charset=utf-8;');
  showToast('ดาวน์โหลด CSV แล้ว');
}

function exportBackup() {
  // ไฟล์ JSON ใช้เป็นข้อมูลสำรองหรือย้ายรายการไปยังระบบส่วนกลาง
  const backup = { app: 'akat-amnuai-it-ledger', version: 3, exportedAt: new Date().toISOString(), items };
  downloadFile('สำรองข้อมูลรายรับรายจ่าย_IT.json', JSON.stringify(backup, null, 2), 'application/json;charset=utf-8;');
  showToast('ดาวน์โหลดไฟล์สำรอง JSON แล้ว');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(imported) || !imported.every(isValidItem)) throw new Error('invalid backup');
      if (!window.confirm(`นำเข้าข้อมูล ${imported.length} รายการ และแทนที่ข้อมูลปัจจุบันหรือไม่?`)) return;
      const previous = items;
      items = imported;
      if (!saveItems()) { items = previous; return; }
      renderAll();
      showToast('นำเข้าข้อมูลสำรองเรียบร้อยแล้ว');
    } catch (error) {
      showToast('ไฟล์สำรองไม่ถูกต้องหรืออ่านไม่ได้');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

window.addEventListener('DOMContentLoaded', () => {
  // ผูกปุ่มและแบบฟอร์มหลัง HTML โหลดเสร็จ
  const today = localDateString();
  document.getElementById('entry-date').value = today;
  setEntryMode('EXPENSE');
  renderAll();

  document.getElementById('btn-type-expense').addEventListener('click', () => setEntryMode('EXPENSE'));
  document.getElementById('btn-type-income').addEventListener('click', () => setEntryMode('INCOME'));
  document.getElementById('single-entry-form').addEventListener('submit', event => {
    event.preventDefault();
    const type = document.getElementById('entry-type').value;
    const title = document.getElementById('entry-title').value.trim();
    const amount = Number(document.getElementById('entry-amount').value);
    const category = document.getElementById('entry-category').value;
    const date = document.getElementById('entry-date').value;
    if (!title || !Number.isFinite(amount) || amount <= 0 || !date) {
      showToast('กรุณาตรวจสอบรายการ จำนวนเงิน และวันที่');
      return;
    }
    const entry = { id: newId(), date, type, title, category, amount: Math.round(amount * 100) / 100 };
    items.unshift(entry);
    if (!saveItems()) { items.shift(); return; }
    document.getElementById('entry-title').value = '';
    document.getElementById('entry-amount').value = '';
    renderAll();
    showToast(type === 'INCOME' ? 'บันทึกรายรับเรียบร้อยแล้ว' : 'บันทึกรายจ่ายเรียบร้อยแล้ว');
  });

  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('filter-type').addEventListener('change', renderTable);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-json').addEventListener('click', exportBackup);
  document.getElementById('input-import-json').addEventListener('change', event => {
    if (event.target.files[0]) importBackup(event.target.files[0]);
    event.target.value = '';
  });

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (!window.confirm('ยืนยันลบรายการทั้งหมดหรือไม่? แนะนำให้ดาวน์โหลดไฟล์สำรองก่อน')) return;
    const previous = items;
    items = [];
    if (!saveItems()) { items = previous; return; }
    renderAll();
    showToast('ล้างรายการทั้งหมดแล้ว');
  });

  // ปุ่มเดิมถูกเปลี่ยนเป็นนำเข้าข้อมูลสำรอง เพื่อไม่เติมข้อมูลตัวอย่างทับข้อมูลจริง
  const demoButton = document.getElementById('btn-reset-demo');
  if (demoButton) demoButton.addEventListener('click', () => document.getElementById('input-import-json').click());

  document.body.addEventListener('click', event => {
    const deleteButton = event.target.closest('button[data-delete-id]');
    if (!deleteButton) return;
    const item = items.find(entry => entry.id === deleteButton.dataset.deleteId);
    if (!item || !window.confirm(`ยืนยันลบรายการ “${item.title}” หรือไม่?`)) return;
    const previous = items;
    items = items.filter(entry => entry.id !== item.id);
    if (!saveItems()) { items = previous; return; }
    renderAll();
    showToast('ลบรายการเรียบร้อยแล้ว');
  });
});
