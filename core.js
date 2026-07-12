// ===========================================================================
// core.js — config, globals, constants, utils, API proxy
// ===========================================================================

const LIFF_ID = "2010662195-iJjI0NIA";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyXuXg-BFvN2lNuT7DP6DB5GdAo2ZGl0nBNem4thHiJOCCCuuBZnIX7-1Gw2ewhOXTUqQ/exec";
const SCHOOL_LOGO_URL = 'https://img2.pic.in.th/logo-ht.png';

// ---- Global state ----
let currentUser = null;
let currentLineProfile = null;
let leaveTypes = [];
let _holidays = [];
let calendarState = { year: new Date().getFullYear(), month: new Date().getMonth() };
let hrFilters = { dateFrom: '', dateTo: '', dept: 'all', type: 'all' };
let hrSort = { field: 'start_date', dir: 'desc' };

// ---- Constants ----
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const AVATAR_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#059669', '#d97706', '#4f46e5', '#0d9488'];
const PREFIXES = ['นาย', 'นาง', 'นางสาว', 'ว่าที่ร้อยตรี', 'ว่าที่ร้อยตรีหญิง', 'ดร.'];
const MALE_PREFIXES = ['นาย', 'ว่าที่ร้อยตรี'];
const FEMALE_PREFIXES = ['นาง', 'นางสาว', 'ว่าที่ร้อยตรีหญิง'];
const isMalePrefix = (p) => MALE_PREFIXES.includes(p);
const isFemalePrefix = (p) => FEMALE_PREFIXES.includes(p);

function availableTypesFor(prefix) {
  return leaveTypes.filter(lt => {
    if (lt.gender === 'female' && isMalePrefix(prefix)) return false;
    if (lt.gender === 'male' && isFemalePrefix(prefix)) return false;
    return true;
  });
}
const ROLE_META = {
  Teacher: { label: 'ครู', bg: '#eff6ff', color: '#1d4ed8' },
  HR: { label: 'ฝ่ายบุคคล', bg: '#fdf4ff', color: '#a21caf' },
  Director: { label: 'ผู้อำนวยการ', bg: '#fff7ed', color: '#c2410c' },
  Admin: { label: 'ผู้ดูแลระบบ', bg: '#f0fdf4', color: '#15803d' },
};

// ---- Date / util helpers ----
const normDate = (v) => (v == null ? '' : String(v).substring(0, 10));
function parseISO(s) { const [y, m, d] = normDate(s).split('-').map(Number); return new Date(y, m - 1, d); }
function fmtThai(iso) { const d = parseISO(iso); return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }
function fmtShort(iso) { const d = parseISO(iso); return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`; }
function daysBetween(from, to) { return Math.round((parseISO(to) - parseISO(from)) / 86400000) + 1; }
function dateInRange(dateStr, from, to) { const d = parseISO(dateStr).getTime(); return d >= parseISO(from).getTime() && d <= parseISO(to).getTime(); }
function toISO(y, m, d) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function todayISO() { const d = new Date(); return toISO(d.getFullYear(), d.getMonth(), d.getDate()); }
function initials(name) { return String(name || '?').replace(/^(นาง|นางสาว|นาย|ผอ\.)/, '').trim().slice(0, 1) || '?'; }
function avatarColor(seed) { let n = 0; for (const c of String(seed)) n += c.charCodeAt(0); return AVATAR_COLORS[n % AVATAR_COLORS.length]; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function statusMeta(status) {
  if (status === 'Approved')         return { label: 'อนุมัติแล้ว',    bg: '#f0fdf4', color: '#15803d' };
  if (status === 'Rejected')         return { label: 'ไม่อนุมัติ',     bg: '#fef2f2', color: '#b91c1c' };
  if (status === 'Cancelled')        return { label: 'ยกเลิกแล้ว',    bg: '#f1f5f9', color: '#64748b' };
  if (status === 'Pending_Director') return { label: 'รออนุมัติ ผอ.', bg: '#fff7ed', color: '#c2410c' };
  return { label: 'รออนุมัติ', bg: '#fffbeb', color: '#b45309' };
}
const isPending = (s) => String(s).indexOf('Pending') === 0 || s === 'Pending';
const isActive = (s) => s !== 'Rejected' && s !== 'Cancelled';
function typeColor(id) { const t = leaveTypes.find(x => x.id == id); return t ? t.color_code : '#64748b'; }
function typeName(id) { const t = leaveTypes.find(x => x.id == id); return t ? t.name : id; }

// ---- UI utils ----
const showLoader = (show = true) => { document.getElementById('loader').style.display = show ? 'flex' : 'none'; };
function toast(text) {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:12px 22px;border-radius:999px;font-size:13px;font-weight:600;z-index:2000;box-shadow:0 10px 30px rgba(0,0,0,.25)">${esc(text)}</div>`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { root.innerHTML = ''; }, 2400);
}
const swalError = (msg) => Swal.fire('เกิดข้อผิดพลาด!', msg, 'error');

// ---- Inline SVG icons ----
const ICONS = {
  chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronUp: '<polyline points="18 15 12 9 6 15"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
};
function svg(name, size = 16, width = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none">${ICONS[name] || ''}</svg>`;
}

// ---- Thai date picker ----
function thaiDate(id, value = '', cb = '') {
  const d = value ? parseISO(value) : null;
  const day = d ? d.getDate() : '';
  const mon = d ? d.getMonth() : '';
  const yr = d ? d.getFullYear() : '';
  const now = new Date().getFullYear();
  const years = [];
  for (let y = now - 5; y <= now + 3; y++) years.push(y);
  if (yr && !years.includes(yr)) { years.push(yr); years.sort((a, b) => a - b); }
  const sel = 'padding:8px 6px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;color:#0f172a;background:#fff';
  const dayOpts = ['<option value="">วัน</option>', ...Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${day == i + 1 ? 'selected' : ''}>${i + 1}</option>`)].join('');
  const monOpts = ['<option value="">เดือน</option>', ...THAI_MONTHS_FULL.map((m, i) => `<option value="${i}" ${mon === i ? 'selected' : ''}>${m}</option>`)].join('');
  const yrOpts = ['<option value="">ปี พ.ศ.</option>', ...years.map(y => `<option value="${y}" ${yr == y ? 'selected' : ''}>${y + 543}</option>`)].join('');
  return `<span class="thai-date" style="display:inline-flex;gap:6px;align-items:center">
    <select id="${id}-d" onchange="syncThaiDate('${id}')" style="${sel}">${dayOpts}</select>
    <select id="${id}-m" onchange="syncThaiDate('${id}')" style="${sel}">${monOpts}</select>
    <select id="${id}-y" onchange="syncThaiDate('${id}')" style="${sel}">${yrOpts}</select>
    <input type="hidden" id="${id}" value="${value}" data-cb="${esc(cb)}"/>
  </span>`;
}
window.syncThaiDate = function (id) {
  const d = document.getElementById(id + '-d').value;
  const m = document.getElementById(id + '-m').value;
  const y = document.getElementById(id + '-y').value;
  const hid = document.getElementById(id);
  hid.value = (d && m !== '' && y) ? toISO(Number(y), Number(m), Number(d)) : '';
  const cb = hid.dataset.cb;
  if (cb) new Function(cb)();
};

// ---- Range calendar ----
const _range = {};
function rangeCalendar(id, opts) {
  opts = opts || {};
  const now = new Date();
  _range[id] = { start: '', end: '', year: now.getFullYear(), month: now.getMonth(), onchange: opts.onchange || '' };
  return `<div id="${id}-cal">${renderRangeCal(id)}</div>
    <input type="hidden" id="${id}-from"/><input type="hidden" id="${id}-to"/>`;
}
function renderRangeCal(id) {
  const st = _range[id];
  const { year, month, start, end } = st;
  const first = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const today = todayISO();
  const wd = WEEKDAYS.map(w => `<div style="text-align:center;font-size:10px;color:#94a3b8;font-weight:700;padding:2px 0">${w}</div>`).join('');
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div></div>';
  for (let d = 1; d <= dim; d++) {
    const iso = toISO(year, month, d);
    const isEnd = iso === start || iso === end;
    const inRange = start && end && iso > start && iso < end;
    let bg = 'transparent', color = '#0f172a';
    if (isEnd) { bg = '#2563eb'; color = '#fff'; }
    else if (inRange) { bg = '#dbeafe'; color = '#1d4ed8'; }
    const border = (iso === today && !isEnd) ? 'border:1px solid #2563eb;' : '';
    cells += `<div onclick="pickRangeDay('${id}','${iso}')" class="dc-hover" style="cursor:pointer;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:12.5px;border-radius:8px;background:${bg};color:${color};${border}">${d}</div>`;
  }
  const summary = start ? (end ? `${fmtThai(start)} — ${fmtThai(end)}` : `${fmtThai(start)} · แตะเลือกวันสิ้นสุด`) : 'แตะเลือกวันเริ่มลา';
  return `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div onclick="rangeMove('${id}',-1)" class="dc-hover" style="cursor:pointer;width:28px;height:28px;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#334155">${svg('chevronLeft', 15)}</div>
        <div style="font-size:13px;font-weight:700">${THAI_MONTHS_FULL[month]} ${year + 543}</div>
        <div onclick="rangeMove('${id}',1)" class="dc-hover" style="cursor:pointer;width:28px;height:28px;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#334155">${svg('chevronRight', 15)}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:3px">${wd}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${cells}</div>
      <div style="margin-top:10px;font-size:12px;font-weight:600;color:${start ? '#2563eb' : '#94a3b8'};text-align:center">${esc(summary)}</div>
    </div>`;
}
window.rangeMove = (id, delta) => {
  const st = _range[id];
  let m = st.month + delta, y = st.year;
  if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
  st.month = m; st.year = y;
  document.getElementById(id + '-cal').innerHTML = renderRangeCal(id);
};
window.pickRangeDay = (id, iso) => {
  const st = _range[id];
  if (!st.start || st.end) { st.start = iso; st.end = ''; }
  else if (parseISO(iso) < parseISO(st.start)) { st.start = iso; st.end = ''; }
  else { st.end = iso; }
  document.getElementById(id + '-from').value = st.start;
  document.getElementById(id + '-to').value = st.end || '';
  document.getElementById(id + '-cal').innerHTML = renderRangeCal(id);
  if (st.onchange) new Function(st.onchange)();
};

// ---- API proxy (POST text/plain to avoid GAS CORS preflight) ----
const api = new Proxy({}, {
  get: (_t, funcName) => async (...args) => {
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: funcName, args })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
});
