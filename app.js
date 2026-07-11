// ===========================================================================
// ระบบจัดการการลาอิเล็กทรอนิกส์ · โรงเรียนบ้านห้วยตาด
// Frontend implementing "Leave Management System.dc.html" against the GAS backend.
// ===========================================================================

const LIFF_ID = "2010662195-iJjI0NIA";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxZGcWbC2qlVS8b9rh1EC-wtZBFp58xuS_0NdFuB2Uu6A1xmE8OpXtA46XZsFvZ0Pk3MA/exec";

// ---- Global state ----
let currentUser = null;
let currentLineProfile = null;
let leaveTypes = [];          // [{id, name, quota_days, color_code}]
let calendarState = { year: new Date().getFullYear(), month: new Date().getMonth() };
let hrFilters = { dateFrom: '', dateTo: '', dept: 'all', type: 'all' };
let hrSort = { field: 'start_date', dir: 'desc' };

// ---- Constants (from design) ----
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const AVATAR_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#059669', '#d97706', '#4f46e5', '#0d9488'];
const PREFIXES = ['นาย', 'นาง', 'นางสาว', 'ว่าที่ร้อยตรี', 'ว่าที่ร้อยตรีหญิง', 'ดร.'];
const MALE_PREFIXES = ['นาย', 'ว่าที่ร้อยตรี'];
const FEMALE_PREFIXES = ['นาง', 'นางสาว', 'ว่าที่ร้อยตรีหญิง'];
const isMalePrefix = (p) => MALE_PREFIXES.includes(p);
const isFemalePrefix = (p) => FEMALE_PREFIXES.includes(p);

// Leave types available to a user, filtered by the type's gender restriction.
// Unknown gender (e.g. ดร./อื่นๆ) sees all, to avoid wrongly hiding an entitlement.
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

// Map GAS status -> display group
function statusMeta(status) {
  if (status === 'Approved') return { label: 'อนุมัติแล้ว', bg: '#f0fdf4', color: '#15803d' };
  if (status === 'Rejected') return { label: 'ไม่อนุมัติ', bg: '#fef2f2', color: '#b91c1c' };
  if (status === 'Cancelled') return { label: 'ยกเลิกแล้ว', bg: '#f1f5f9', color: '#64748b' };
  return { label: 'รออนุมัติ', bg: '#fffbeb', color: '#b45309' }; // Pending_HR / Pending_Director / Pending
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

// ---- Inline SVG icons (feather-style, stroke=currentColor) ----
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

// ---- Thai date picker (วัน / เดือน / ปี พ.ศ.) -> hidden ISO input at #id ----
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

// ===========================================================================
// Boot / auth
// ===========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    showLoader(true);
    if (typeof liff !== 'undefined' && LIFF_ID && !LIFF_ID.includes('YOUR_')) {
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) { showView('landing'); showLoader(false); return; }
      currentLineProfile = await liff.getProfile();
      await authenticateUser(currentLineProfile.userId);
    } else {
      await authenticateUser('mock_line_user_id');
    }
  } catch (err) {
    swalError('ไม่สามารถเริ่มต้นระบบได้: ' + err.message);
    showLoader(false);
  }
});

function handleLogin() {
  document.getElementById('login-btn').style.display = 'none';
  document.getElementById('login-loading').style.display = 'flex';
  if (typeof liff !== 'undefined' && liff.login) liff.login();
}

async function authenticateUser(lineUserId) {
  try {
    const user = await api.getTeacherByLineId(lineUserId);
    if (user && user.status === 'Active') { currentUser = user; await routeByRole(); }
    else if (user && user.status === 'Pending') { showLoader(false); showStatusScreen('pending', user); }
    else if (user && user.status === 'Rejected') { showLoader(false); showStatusScreen('rejected', user); }
    else { showLoader(false); showView('onboarding'); mountRegDate(); }
  } catch (err) {
    swalError('Authentication error: ' + err.message);
    showLoader(false);
  }
}

function mountRegDate() {
  const m = document.getElementById('reg-prefix-mount');
  if (m && !m.innerHTML) m.innerHTML = prefixSelectHtml('reg', '');
}

// Prefix <select> with common values + "อื่นๆ" free-text fallback
function prefixSelectHtml(id, current) {
  const isOther = current && !PREFIXES.includes(current);
  const opts = [...PREFIXES, 'อื่นๆ'].map(p => {
    const sel = (p === 'อื่นๆ' ? isOther : current === p) ? 'selected' : '';
    return `<option value="${p}" ${sel}>${p}</option>`;
  }).join('');
  return `<select id="${id}-prefix" class="dc-input" onchange="togglePrefixOther('${id}')">${opts}</select>
    <input id="${id}-prefix-other" class="dc-input" placeholder="ระบุคำนำหน้า" style="margin-top:6px;display:${isOther ? 'block' : 'none'}" value="${isOther ? esc(current) : ''}"/>`;
}
window.togglePrefixOther = (id) => {
  const s = document.getElementById(id + '-prefix');
  document.getElementById(id + '-prefix-other').style.display = s.value === 'อื่นๆ' ? 'block' : 'none';
};
function getPrefix(id) {
  const s = document.getElementById(id + '-prefix');
  return s.value === 'อื่นๆ' ? document.getElementById(id + '-prefix-other').value.trim() : s.value;
}

// Blocked/waiting screen for non-Active accounts
function showStatusScreen(kind, user) {
  document.querySelectorAll('.view-section').forEach(el => { el.style.display = 'none'; });
  const root = document.getElementById('modal-root');
  const pending = kind === 'pending';
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 20px">
      <div style="width:100%;max-width:380px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 20px 50px rgba(15,23,42,.08);padding:36px 28px;text-align:center">
        <div style="width:56px;height:56px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;background:${pending ? '#fffbeb' : '#fef2f2'};color:${pending ? '#b45309' : '#b91c1c'}">${svg(pending ? 'checkCircle' : 'x', 28)}</div>
        <div style="font-size:18px;font-weight:800;margin-bottom:8px">${pending ? 'รอผู้ดูแลระบบอนุมัติ' : 'บัญชีถูกปฏิเสธ'}</div>
        <div style="font-size:13px;color:#64748b;line-height:1.7">${pending
      ? `บัญชี ${esc(user.name || '')} ลงทะเบียนแล้ว<br/>กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน`
      : 'บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งานระบบ<br/>ติดต่อผู้ดูแลระบบหากเข้าใจว่าเป็นข้อผิดพลาด'}</div>
        <div onclick="logout()" class="dc-hover" style="margin-top:22px;cursor:pointer;padding:11px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:700;color:#334155">ออกจากระบบ</div>
      </div>
    </div>`;
}

document.getElementById('form-bind-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoader(true);
  try {
    const payload = {
      prefix: getPrefix('reg'),
      name: document.getElementById('teacherName').value.trim(),
      surname: document.getElementById('teacherSurname').value.trim(),
      position: document.getElementById('teacherPosition').value.trim(),
      department: document.getElementById('teacherDept').value.trim(),
      phone: document.getElementById('teacherPhone').value.trim(),
      email: document.getElementById('teacherEmail').value.trim(),
      line_user_id: currentLineProfile ? currentLineProfile.userId : 'mock_line_user_id'
    };
    currentUser = await api.registerTeacher(payload);
    if (currentUser.status === 'Active') { toast('ลงทะเบียนสำเร็จ'); await routeByRole(); }
    else { showLoader(false); showStatusScreen('pending', currentUser); }
  } catch (err) { showLoader(false); swalError(err.message); }
});

window.logout = () => {
  Swal.fire({
    title: 'ออกจากระบบ?', text: 'คุณต้องการออกจากระบบใช่หรือไม่?', icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#2563eb', cancelButtonColor: '#dc2626',
    confirmButtonText: 'ออกจากระบบ', cancelButtonText: 'ยกเลิก'
  }).then((r) => {
    if (r.isConfirmed) {
      if (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn()) liff.logout();
      window.location.reload();
    }
  });
};

function showView(id) {
  document.querySelectorAll('.view-section').forEach(el => { el.style.display = 'none'; });
  const el = document.getElementById('view-' + id);
  if (el) el.style.display = (id === 'teacher' || id === 'landing' || id === 'onboarding') ? 'flex' : 'block';
}

async function routeByRole() {
  showLoader(true);
  try {
    leaveTypes = await api.getLeaveTypes();
    const role = currentUser.role || 'Teacher';
    if (role === 'HR') { showView('hr'); await loadHr(); }
    else if (role === 'Director') { showView('director'); await loadDirector(); }
    else if (role === 'Admin') { showView('admin'); await loadAdmin(); }
    else { showView('teacher'); await loadTeacher(); }
  } catch (err) { swalError(err.message); }
  finally { showLoader(false); }
}

// ===========================================================================
// VIEW 1: TEACHER PORTAL
// ===========================================================================
let _teacherData = { quotas: [], history: [], holidays: [] };
async function loadTeacher() {
  const [quotas, history, holidays] = await Promise.all([
    api.getLeaveQuotas(currentUser.id),
    api.getLeaveHistory(currentUser.id),
    api.getHolidays()
  ]);
  _teacherData = { quotas, history, holidays };
  renderTeacher(quotas, history);
}

function renderTeacher(quotas, history) {
  const u = currentUser;
  const fullName = `${u.prefix || ''}${u.name} ${u.surname || ''}`.trim();
  const ini = initials(u.name);
  const aColor = avatarColor(u.id);

  const quotaCards = (quotas || []).map(q => {
    const total = Number(q.total_quota) || 0;
    const used = Number(q.used_days) || 0;
    const pct = total > 0 ? Math.min(1, used / total) : 0;
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
        <div style="width:64px;height:64px;border-radius:50%;background:conic-gradient(${q.color_code} ${Math.round(pct * 360)}deg,#eef2f7 0deg);display:flex;align-items:center;justify-content:center">
          <div style="width:50px;height:50px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:14px;font-weight:800;color:#0f172a">${Number(q.remaining_days) || 0}</div>
            <div style="font-size:8px;color:#94a3b8">จาก ${total}</div>
          </div>
        </div>
        <div style="font-size:11px;font-weight:600;color:#475569;text-align:center">${esc(q.type_name)}</div>
      </div>`;
  }).join('') || '<div style="font-size:12px;color:#94a3b8;padding:8px">ไม่มีข้อมูลโควตา</div>';

  const sorted = (history || []).slice().sort((a, b) => normDate(b.start_date).localeCompare(normDate(a.start_date)));
  const recordCards = sorted.map(r => {
    const sm = statusMeta(r.status);
    const from = normDate(r.start_date), to = normDate(r.end_date);
    const range = from === to ? fmtThai(from) : `${fmtShort(from)} - ${fmtThai(to)}`;
    const remark = r.comments ? `<div style="margin-top:8px;padding:8px 10px;background:#f8fafc;border-radius:8px;font-size:11px;color:#64748b"><strong style="color:#0f172a">ความเห็นผู้อนุมัติ:</strong> ${esc(r.comments)}</div>` : '';
    const cancelBtn = isPending(r.status) ? `<div onclick="cancelRequest('${esc(r.id)}')" style="margin-top:8px;text-align:center;font-size:11px;font-weight:700;color:#b91c1c;cursor:pointer">ยกเลิกคำขอ</div>` : '';
    const printBtn = r.status === 'Approved' ? `<div onclick="printLeaveForm('${esc(r.id)}')" class="dc-hover" style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid #2563eb;border-radius:9px;font-size:12px;font-weight:700;color:#2563eb;cursor:pointer">${svg('download', 14)} ออกใบลา (พิมพ์/PDF)</div>` : '';
    return `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:8px;height:8px;border-radius:50%;background:${r.color_code || typeColor(r.leave_type_id)}"></div>
            <div style="font-size:13px;font-weight:700">${esc(r.type_name || typeName(r.leave_type_id))}</div>
          </div>
          <div style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:${sm.bg};color:${sm.color}">${sm.label}</div>
        </div>
        <div style="font-size:12px;color:#475569;margin-bottom:4px">${range} · ${r.total_days} วัน</div>
        <div style="font-size:12px;color:#94a3b8">${esc(r.reason)}</div>
        ${remark}${cancelBtn}${printBtn}
      </div>`;
  }).join('') || '<div style="font-size:12px;color:#94a3b8;padding:20px;text-align:center">ยังไม่มีประวัติการลา</div>';

  document.getElementById('view-teacher').innerHTML = `
    <div style="min-height:100vh;display:flex;justify-content:center;padding:0 0 100px">
      <div style="width:100%;max-width:430px;background:#f8fafc;min-height:100vh;box-shadow:0 0 60px rgba(15,23,42,.06);position:relative">
        <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:22px 20px 46px;color:#fff">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:44px;height:44px;border-radius:12px;background:${aColor};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;border:2px solid rgba(255,255,255,.5)">${ini}</div>
            <div style="flex:1">
              <div style="font-size:15px;font-weight:700">${esc(fullName)}</div>
              <div style="font-size:12px;opacity:.85">${esc(u.position || (ROLE_META[u.role] ? ROLE_META[u.role].label : u.role))} · ${esc(u.department || '-')}</div>
            </div>
            <div onclick="logout()" title="ออกจากระบบ" style="cursor:pointer;opacity:.9;display:inline-flex">${svg('logout', 20)}</div>
          </div>
        </div>

        <div style="margin:-30px 16px 0;background:#fff;border-radius:16px;box-shadow:0 12px 30px rgba(15,23,42,.1);padding:18px;position:relative;z-index:2">
          <div style="font-size:13px;font-weight:700;margin-bottom:14px">วันลาคงเหลือ</div>
          <div style="display:flex;gap:10px">${quotaCards}</div>
        </div>

        <div style="padding:20px 16px 0">
          <div style="display:flex;align-items:center;margin-bottom:10px">
            <div style="font-size:14px;font-weight:700;flex:1">ประวัติการลา</div>
            <div style="font-size:12px;color:#94a3b8">${sorted.length} รายการ</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">${recordCards}</div>
        </div>

        <div onclick="openLeaveForm()" class="dc-hover" style="position:fixed;bottom:28px;right:calc(50% - 199px);width:58px;height:58px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 28px rgba(37,99,235,.4);cursor:pointer;font-size:28px;z-index:50">+</div>
      </div>
    </div>`;
}

// ===========================================================================
// Sidebar (HR / Director / Admin)
// ===========================================================================
const NAV_BY_ROLE = {
  HR: [['chart', 'ภาพรวมประจำวัน'], ['list', 'รายงานการลาทั้งหมด'], ['users', 'บุคลากร']],
  Director: [['checkCircle', 'คำขอรออนุมัติ'], ['calendar', 'ปฏิทินโรงเรียน']],
  Admin: [['user', 'จัดการผู้ใช้งาน'], ['folder', 'ประเภทการลา/โควตา'], ['calendar', 'วันหยุดราชการ'], ['alert', 'พื้นที่อันตราย']],
};
function sidebar(role) {
  const items = (NAV_BY_ROLE[role] || []).map(([icon, label], i) => {
    const bg = i === 0 ? 'rgba(37,99,235,0.18)' : 'transparent';
    const color = i === 0 ? '#93c5fd' : '#cbd5e1';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;font-size:13px;font-weight:600;background:${bg};color:${color}"><span style="color:${color};display:inline-flex">${svg(icon, 17)}</span>${esc(label)}</div>`;
  }).join('');
  return `
    <div style="width:220px;flex:none;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;padding:22px 16px;position:sticky;top:0">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:26px;padding:0 4px">
        <div style="width:36px;height:36px;border-radius:9px;background:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff">รร</div>
        <div>
          <div style="font-size:12.5px;font-weight:700;color:#fff;line-height:1.2">รร.บ้านห้วยตาด</div>
          <div style="font-size:10px;color:#94a3b8">ระบบจัดการการลา</div>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase;padding:0 4px;margin-bottom:8px">${esc(ROLE_META[role] ? ROLE_META[role].label : role)}</div>
      <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:auto">${items}</div>
      <div style="border-top:1px solid #1e293b;margin-top:16px;padding-top:14px">
        <div style="font-size:11px;color:#94a3b8;padding:0 4px 6px">${esc(currentUser.name)}</div>
        <div onclick="logout()" style="cursor:pointer;font-size:12px;font-weight:600;color:#f87171;padding:0 4px;display:flex;align-items:center;gap:6px">${svg('logout', 15)} ออกจากระบบ</div>
      </div>
    </div>`;
}

// ===========================================================================
// VIEW 2: HR PORTAL
// ===========================================================================
let _hrData = { records: [], teachers: [], pending: [] };
async function loadHr() {
  const [records, teachers, pending] = await Promise.all([
    api.getAllLeaveReport(),
    api.getAllTeachers(),
    api.getPendingRequestsForApprover(currentUser.id, 'HR')
  ]);
  _hrData = { records, teachers, pending };
  renderHr();
}

function renderHr() {
  const s = _hrData;
  const today = todayISO();
  const active = s.records.filter(r => isActive(r.status));
  const onLeaveToday = active.filter(r => dateInRange(today, r.start_date, r.end_date));
  const pendingAll = s.records.filter(r => isPending(r.status));
  const approvedThisMonth = s.records.filter(r => r.status === 'Approved' && normDate(r.start_date).startsWith(today.substring(0, 7)));

  const cards = [
    { label: 'ลาวันนี้', value: onLeaveToday.length, color: '#2563eb' },
    { label: 'รออนุมัติทั้งหมด', value: pendingAll.length, color: '#b45309' },
    { label: 'อนุมัติแล้ว (เดือนนี้)', value: approvedThisMonth.length, color: '#15803d' },
    { label: 'บุคลากรทั้งหมด', value: s.teachers.length, color: '#334155' },
  ].map(c => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px">
      <div style="font-size:12px;color:#64748b;margin-bottom:6px">${c.label}</div>
      <div style="font-size:26px;font-weight:800;color:${c.color}">${c.value}</div>
    </div>`).join('');

  const pendingBlock = s.pending.length ? `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:18px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">คำขอรออนุมัติ (ระดับฝ่ายบุคคล) · ${s.pending.length} รายการ</div>
      <div style="display:flex;flex-direction:column;gap:12px">${s.pending.map(approvalCard).join('')}</div>
    </div>` : '';

  const onLeaveChips = onLeaveToday.length ? onLeaveToday.map(r => `
    <div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:6px 14px 6px 6px">
      <div style="width:26px;height:26px;border-radius:50%;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff">${initials(r.teacher_name)}</div>
      <div style="font-size:12px;font-weight:600">${esc(r.teacher_name)}</div>
      <div style="font-size:11px;color:#64748b">· ${esc(r.type_name)}</div>
    </div>`).join('') : '<div style="font-size:12px;color:#94a3b8">ไม่มีบุคลากรลาในวันนี้</div>';

  // Filters
  const depts = [...new Set(s.teachers.map(t => t.department).filter(Boolean))];
  const deptOpts = ['all', ...depts].map(d => `<option value="${esc(d)}" ${hrFilters.dept === d ? 'selected' : ''}>${d === 'all' ? 'ทุกกลุ่มสาระ/ฝ่าย' : esc(d)}</option>`).join('');
  const typeOpts = ['all', ...leaveTypes.map(t => t.id)].map(id => {
    const label = id === 'all' ? 'ทุกประเภทการลา' : typeName(id);
    return `<option value="${esc(id)}" ${hrFilters.type === id ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');

  // Filter + sort
  let rows = s.records.slice();
  if (hrFilters.dateFrom) rows = rows.filter(r => normDate(r.end_date) >= hrFilters.dateFrom);
  if (hrFilters.dateTo) rows = rows.filter(r => normDate(r.start_date) <= hrFilters.dateTo);
  if (hrFilters.dept !== 'all') rows = rows.filter(r => r.department === hrFilters.dept);
  if (hrFilters.type !== 'all') rows = rows.filter(r => r.leave_type_id == hrFilters.type);
  rows.sort((a, b) => {
    const dir = hrSort.dir === 'asc' ? 1 : -1;
    const va = hrSort.field === 'teacher_name' ? a.teacher_name : normDate(a.start_date);
    const vb = hrSort.field === 'teacher_name' ? b.teacher_name : normDate(b.start_date);
    return va > vb ? dir : va < vb ? -dir : 0;
  });

  const tableRows = rows.map(r => {
    const sm = statusMeta(r.status);
    const from = normDate(r.start_date), to = normDate(r.end_date);
    const range = from === to ? fmtShort(from) : `${fmtShort(from)} - ${fmtShort(to)}`;
    return `<tr class="dc-row">
      <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-weight:600">${esc(r.teacher_name)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#64748b">${esc(r.department)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9">${esc(r.type_name)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#64748b">${range}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9">${r.total_days} วัน</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9"><span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:${sm.bg};color:${sm.color}">${sm.label}</span>${r.status === 'Approved' ? `<span onclick="printLeaveFormHr('${esc(r.id)}')" title="ออกใบลา" class="dc-hover" style="cursor:pointer;color:#2563eb;margin-left:8px;display:inline-flex;vertical-align:middle">${svg('download', 15)}</span>` : ''}</td>
    </tr>`;
  }).join('');
  const arrowName = hrSort.field === 'teacher_name' ? svg(hrSort.dir === 'asc' ? 'chevronUp' : 'chevronDown', 12) : '';
  const arrowDate = hrSort.field === 'start_date' ? svg(hrSort.dir === 'asc' ? 'chevronUp' : 'chevronDown', 12) : '';
  const th = (label, onclick = '', arrow = '') => `<th ${onclick ? `onclick="${onclick}" style="cursor:pointer;` : 'style="'}text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #e2e8f0">${label} ${arrow}</th>`;

  document.getElementById('view-hr').innerHTML = `
    <div style="display:flex;min-height:100vh">
      ${sidebar('HR')}
      <div style="flex:1;padding:28px 32px;max-width:1400px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px">
          <div>
            <div style="font-size:22px;font-weight:800">ภาพรวมการลาประจำวัน</div>
            <div style="font-size:13px;color:#64748b">วันนี้ ${fmtThai(today)}</div>
          </div>
          <div onclick="openOnBehalf()" class="dc-hover" style="cursor:pointer;background:#2563eb;color:#fff;padding:11px 18px;border-radius:10px;font-size:13px;font-weight:700">+ สร้างใบลาแทนครู</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px">${cards}</div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:18px">
          <div style="font-size:13px;font-weight:700;margin-bottom:10px">ใครลาบ้างวันนี้</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px">${onLeaveChips}</div>
        </div>

        ${pendingBlock}

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
            <div style="font-size:14px;font-weight:700">รายงานการลาทั้งหมด</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              ${thaiDate('hf-from', hrFilters.dateFrom, "setHrFilter('dateFrom', document.getElementById('hf-from').value)")}
              <span style="font-size:12px;color:#94a3b8">ถึง</span>
              ${thaiDate('hf-to', hrFilters.dateTo, "setHrFilter('dateTo', document.getElementById('hf-to').value)")}
              <select onchange="setHrFilter('dept',this.value)" style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px">${deptOpts}</select>
              <select onchange="setHrFilter('type',this.value)" style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px">${typeOpts}</select>
              <div onclick="exportCsv()" class="dc-hover" style="cursor:pointer;border:1px solid #e2e8f0;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;color:#334155;display:flex;align-items:center;gap:6px">${svg('download', 14)} Export CSV</div>
            </div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr>
                ${th('ชื่อ-สกุล', 'sortHr(\'teacher_name\')', arrowName)}
                ${th('กลุ่มสาระ/ฝ่าย')}
                ${th('ประเภทการลา')}
                ${th('วันที่', 'sortHr(\'start_date\')', arrowDate)}
                ${th('จำนวนวัน')}
                ${th('สถานะ')}
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            ${rows.length === 0 ? '<div style="padding:30px;text-align:center;font-size:13px;color:#94a3b8">ไม่พบรายการที่ตรงกับตัวกรอง</div>' : ''}
          </div>
        </div>
      </div>
    </div>`;
}

window.setHrFilter = (k, v) => { hrFilters[k] = v; renderHr(); };
window.sortHr = (field) => {
  if (hrSort.field === field) hrSort.dir = hrSort.dir === 'asc' ? 'desc' : 'asc';
  else { hrSort.field = field; hrSort.dir = 'asc'; }
  renderHr();
};
window.exportCsv = () => {
  const rows = _hrData.records;
  const header = ['ชื่อ-สกุล', 'กลุ่มสาระ/ฝ่าย', 'ประเภทการลา', 'วันเริ่ม', 'วันสิ้นสุด', 'จำนวนวัน', 'สถานะ'];
  const body = rows.map(r => [r.teacher_name, r.department, r.type_name, normDate(r.start_date), normDate(r.end_date), r.total_days, statusMeta(r.status).label]);
  const csv = [header, ...body].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `leave_report_${todayISO()}.csv`;
  a.click();
  toast('ส่งออกไฟล์ CSV แล้ว');
};

// ===========================================================================
// VIEW 3: DIRECTOR PORTAL
// ===========================================================================
let _dirData = { pending: [], records: [], holidays: [] };
async function loadDirector() {
  const [pending, records, holidays] = await Promise.all([
    api.getPendingRequestsForApprover(currentUser.id, currentUser.role),
    api.getAllLeaveReport(),
    api.getHolidays()
  ]);
  _dirData = { pending, records, holidays };
  renderDirector();
}

// Shared approval card (used by Director + HR)
function approvalCard(r) {
  const from = normDate(r.start_date), to = normDate(r.end_date);
  const range = from === to ? fmtThai(from) : `${fmtShort(from)} - ${fmtThai(to)}`;
  const attach = r.attachment_url ? `<span style="color:#2563eb">· <a href="${esc(r.attachment_url)}" target="_blank" style="display:inline-flex;align-items:center;gap:3px">${svg('paperclip', 13)} มีเอกสารแนบ</a></span>` : '';
  return `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:38px;height:38px;border-radius:10px;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff">${initials(r.teacher_name)}</div>
          <div>
            <div style="font-size:14px;font-weight:700">${esc(r.teacher_name)}</div>
            <div style="font-size:11.5px;color:#64748b">${esc(ROLE_META[r.position] ? ROLE_META[r.position].label : (r.position || ''))} · ${esc(r.department)}</div>
          </div>
        </div>
        <div style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:${r.color_code}22;color:${r.color_code}">${esc(r.type_name)}</div>
      </div>
      <div style="font-size:12.5px;color:#334155;margin-bottom:4px"><strong>ช่วงวันลา:</strong> ${range} (${r.total_days} วัน)</div>
      <div style="font-size:12.5px;color:#334155;margin-bottom:10px"><strong>เหตุผล:</strong> ${esc(r.reason)} ${attach}</div>
      <textarea id="remark-${esc(r.id)}" placeholder="ความเห็น (ไม่บังคับ)" style="width:100%;min-height:44px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;resize:vertical;margin-bottom:10px"></textarea>
      <div style="display:flex;gap:8px">
        <div onclick="decideRequest('${esc(r.id)}','approve')" class="dc-hover" style="cursor:pointer;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#16a34a;color:#fff;padding:9px;border-radius:9px;font-size:13px;font-weight:700">${svg('check', 15)} อนุมัติ</div>
        <div onclick="decideRequest('${esc(r.id)}','reject')" class="dc-hover" style="cursor:pointer;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#fef2f2;color:#b91c1c;padding:9px;border-radius:9px;font-size:13px;font-weight:700;border:1px solid #fecaca">${svg('x', 15)} ไม่อนุมัติ</div>
      </div>
    </div>`;
}

function renderDirector() {
  const s = _dirData;
  const pendingCards = s.pending.length ? s.pending.map(approvalCard).join('')
    : '<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:14px;padding:40px;text-align:center;color:#94a3b8;font-size:13px">ไม่มีคำขอรออนุมัติในขณะนี้</div>';

  document.getElementById('view-director').innerHTML = `
    <div style="display:flex;min-height:100vh">
      ${sidebar('Director')}
      <div style="flex:1;padding:28px 32px;display:grid;grid-template-columns:1.15fr .85fr;gap:22px;align-items:start;max-width:1500px">
        <div>
          <div style="font-size:22px;font-weight:800;margin-bottom:2px">คำขอรออนุมัติ</div>
          <div style="font-size:13px;color:#64748b;margin-bottom:18px">${s.pending.length} รายการรอการพิจารณา</div>
          <div style="display:flex;flex-direction:column;gap:12px">${pendingCards}</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;position:sticky;top:20px">
          ${renderCalendar(s.records, s.holidays)}
        </div>
      </div>
    </div>`;
}

function renderCalendar(records, holidays) {
  const { year, month } = calendarState;
  const label = `${THAI_MONTHS_FULL[month]} ${year + 543}`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidayMap = Object.fromEntries((holidays || []).map(h => [normDate(h.date), h.name]));
  const active = (records || []).filter(r => isActive(r.status));
  const today = todayISO();

  const weekdayCells = WEEKDAYS.map(w => `<div style="text-align:center;font-size:10px;color:#94a3b8;font-weight:700;padding:2px 0">${w}</div>`).join('');
  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(year, month, d);
    const isHoliday = !!holidayMap[iso];
    const names = active.filter(r => dateInRange(iso, r.start_date, r.end_date)).map(r => r.teacher_name);
    const isToday = iso === today;
    let bg = '#f8fafc', color = '#334155', border = '1px solid transparent';
    if (isHoliday) { bg = '#fee2e2'; color = '#b91c1c'; }
    else if (names.length) { bg = '#fef3c7'; color = '#92400e'; }
    if (isToday) border = '1.5px solid #2563eb';
    const tip = isHoliday ? holidayMap[iso] : (names.length ? names.join(', ') : '');
    const badge = names.length ? `<div style="font-size:8px;font-weight:800;margin-top:1px;display:flex;align-items:center;gap:1px">${names.length}${svg('user', 8, 2.5)}</div>` : '';
    cells += `<div title="${esc(tip)}" style="aspect-ratio:1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;background:${bg};color:${color};border:${border}"><div style="font-weight:700">${d}</div>${badge}</div>`;
  }

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:14px;font-weight:700">ปฏิทินการลาโรงเรียน</div>
      <div style="display:flex;align-items:center;gap:6px">
        <div onclick="calMove(-1)" class="dc-hover" style="cursor:pointer;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;color:#334155">${svg('chevronLeft', 15)}</div>
        <div style="font-size:12.5px;font-weight:700;width:120px;text-align:center">${label}</div>
        <div onclick="calMove(1)" class="dc-hover" style="cursor:pointer;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;color:#334155">${svg('chevronRight', 15)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">${weekdayCells}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${cells}</div>
    <div style="display:flex;gap:14px;margin-top:12px;font-size:10.5px;color:#64748b">
      <div style="display:flex;align-items:center;gap:5px"><div style="width:9px;height:9px;border-radius:3px;background:#fef3c7"></div>มีผู้ลา</div>
      <div style="display:flex;align-items:center;gap:5px"><div style="width:9px;height:9px;border-radius:3px;background:#fee2e2"></div>วันหยุดราชการ</div>
    </div>`;
}

window.calMove = (delta) => {
  let { year, month } = calendarState;
  month += delta;
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  calendarState = { year, month };
  renderDirector();
};

window.decideRequest = async (reqId, action) => {
  const comment = (document.getElementById('remark-' + reqId) || {}).value || (action === 'approve' ? 'อนุมัติ' : 'ไม่อนุมัติ');
  showLoader(true);
  try {
    await api.updateLeaveStatusAPI(reqId, action, comment, currentUser.id, currentUser.role);
    toast(action === 'approve' ? 'อนุมัติคำขอลาแล้ว' : 'ปฏิเสธคำขอลาแล้ว');
    if (currentUser.role === 'HR') await loadHr(); else await loadDirector();
  } catch (err) { swalError(err.message); }
  finally { showLoader(false); }
};

// ===========================================================================
// VIEW 4: ADMIN DASHBOARD
// ===========================================================================
let _adminData = { teachers: [], holidays: [], records: [], pendingUsers: [] };
async function loadAdmin() {
  const [teachers, holidays, records, pendingUsers] = await Promise.all([
    api.getAllTeachers(), api.getHolidays(), api.getAllLeaveReport(), api.getPendingUsers()
  ]);
  _adminData = { teachers, holidays, records, pendingUsers };
  renderAdmin();
}

function renderAdmin() {
  const s = _adminData;
  const pendingCount = s.records.filter(r => isPending(r.status)).length;

  const metrics = [
    { label: 'ผู้ใช้งานทั้งหมด', value: s.teachers.length, sub: 'บัญชีที่ลงทะเบียน', dot: '#2563eb' },
    { label: 'สถานะ API', value: 'ปกติ', sub: 'GAS Web App เชื่อมต่อสำเร็จ', dot: '#16a34a' },
    { label: 'ประเภทการลา', value: leaveTypes.length, sub: 'ประเภทที่เปิดใช้งาน', dot: '#16a34a' },
    { label: 'คำขอรออนุมัติ', value: pendingCount, sub: 'รอผู้อนุมัติพิจารณา', dot: '#b45309' },
  ].map(m => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;color:#64748b">${m.label}</div>
        <div style="width:8px;height:8px;border-radius:50%;background:${m.dot}"></div>
      </div>
      <div style="font-size:22px;font-weight:800">${m.value}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">${m.sub}</div>
    </div>`).join('');

  const pendingRows = (s.pendingUsers || []).map(u => {
    const roleSel = `<select id="pend-role-${esc(u.id)}" style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px">
      <option value="Teacher">ครู (Teacher)</option><option value="HR">ฝ่ายบุคคล (HR)</option>
      <option value="Director">ผู้อำนวยการ (Director)</option><option value="Admin">ผู้ดูแลระบบ (Admin)</option></select>`;
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;flex-wrap:wrap">
      <div style="width:34px;height:34px;border-radius:9px;background:${avatarColor(u.id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff">${initials(u.name)}</div>
      <div style="flex:1;min-width:160px">
        <div style="font-size:13px;font-weight:700">${esc(u.prefix || '')}${esc(u.name)} ${esc(u.surname || '')}</div>
        <div style="font-size:11.5px;color:#64748b">${esc(u.position || '-')} · ${esc(u.department || '-')} · ${esc(u.phone || '-')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;color:#94a3b8">สิทธิ์</span>${roleSel}
        <div onclick="approvePendingUser('${esc(u.id)}')" class="dc-hover" style="cursor:pointer;background:#16a34a;color:#fff;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700">อนุมัติ</div>
        <div onclick="rejectPendingUser('${esc(u.id)}')" class="dc-hover" style="cursor:pointer;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700">ปฏิเสธ</div>
      </div>
    </div>`;
  }).join('');
  const pendingBlock = (s.pendingUsers || []).length ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:18px;margin-bottom:20px">
      <div style="font-size:14px;font-weight:700;color:#b45309;margin-bottom:8px">ผู้ใช้งานรออนุมัติ · ${s.pendingUsers.length} รายการ</div>
      ${pendingRows}
    </div>` : '';

  const userRows = s.teachers.map(u => {
    const rm = ROLE_META[u.role] || { label: u.role, bg: '#f1f5f9', color: '#64748b' };
    return `<tr class="dc-row">
      <td style="padding:9px 8px;border-bottom:1px solid #f1f5f9;font-weight:600">${esc(u.prefix || '')}${esc(u.name)} ${esc(u.surname || '')}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #f1f5f9;color:#64748b">${esc(u.position || '-')}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #f1f5f9;color:#64748b">${esc(u.department || '-')}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #f1f5f9"><span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:${rm.bg};color:${rm.color}">${rm.label}</span></td>
      <td style="padding:9px 8px;border-bottom:1px solid #f1f5f9;text-align:right">
        <span onclick="openUserModal('${esc(u.id)}')" style="cursor:pointer;color:#2563eb;font-weight:700;font-size:12px;margin-right:12px">แก้ไข</span>
        <span onclick="removeUser('${esc(u.id)}')" style="cursor:pointer;color:#94a3b8;font-weight:700;font-size:12px">ลบ</span>
      </td>
    </tr>`;
  }).join('');

  const typeConfig = leaveTypes.map(lt => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9">
      <div style="width:10px;height:10px;border-radius:3px;background:${lt.color_code}"></div>
      <div style="flex:1;font-size:13px;font-weight:600">${esc(lt.name)}</div>
      <input type="number" value="${lt.quota_days}" onchange="setTypeQuota('${esc(lt.id)}',this.value)" style="width:64px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:7px;font-size:12.5px;text-align:center"/>
      <div style="font-size:11px;color:#94a3b8">วัน/ปี</div>
    </div>`).join('');

  const holidayRows = s.holidays.slice().sort((a, b) => normDate(a.date).localeCompare(normDate(b.date))).map(h => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9">
      ${thaiDate('hd-' + h.id, normDate(h.date), `var v=document.getElementById('hd-${esc(h.id)}').value; if(v) saveHoliday('${esc(h.id)}','date',v)`)}
      <input type="text" value="${esc(h.name)}" onchange="saveHoliday('${esc(h.id)}','name',this.value)" style="flex:1;padding:5px 7px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px"/>
      <span onclick="deleteHolidayRow('${esc(h.id)}')" style="cursor:pointer;color:#cbd5e1;display:inline-flex">${svg('x', 14)}</span>
    </div>`).join('');

  document.getElementById('view-admin').innerHTML = `
    <div style="display:flex;min-height:100vh">
      ${sidebar('Admin')}
      <div style="flex:1;padding:28px 32px;max-width:1500px">
        <div style="font-size:22px;font-weight:800;margin-bottom:20px">แผงควบคุมผู้ดูแลระบบ</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:26px">${metrics}</div>

        ${pendingBlock}

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:14px;font-weight:700">จัดการผู้ใช้งานและสิทธิ์การเข้าถึง</div>
            <div onclick="openUserModal()" class="dc-hover" style="cursor:pointer;background:#2563eb;color:#fff;padding:8px 16px;border-radius:8px;font-size:12.5px;font-weight:700">+ เพิ่มผู้ใช้งาน</div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr>
                <th style="text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">ชื่อ-สกุล</th>
                <th style="text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">ตำแหน่ง</th>
                <th style="text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">กลุ่มสาระ/ฝ่าย</th>
                <th style="text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">สิทธิ์การใช้งาน</th>
                <th style="text-align:right;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">จัดการ</th>
              </tr></thead>
              <tbody>${userRows}</tbody>
            </table>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px">
            <div style="font-size:14px;font-weight:700;margin-bottom:12px">ตั้งค่าประเภทการลาและโควตา</div>
            ${typeConfig}
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div style="font-size:14px;font-weight:700">จัดการวันหยุดราชการ/วันหยุดโรงเรียน</div>
              <div onclick="addHoliday()" class="dc-hover" style="cursor:pointer;font-size:12px;font-weight:700;color:#2563eb;padding:5px 10px;border-radius:7px">+ เพิ่มวันหยุด</div>
            </div>
            <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">${holidayRows}</div>
          </div>
        </div>

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:14px;padding:18px">
          <div style="font-size:14px;font-weight:800;color:#b91c1c;margin-bottom:4px;display:flex;align-items:center;gap:6px">${svg('alert', 16)} พื้นที่อันตราย</div>
          <div style="font-size:12.5px;color:#7f1d1d;margin-bottom:12px">การยกยอดวันลาข้ามปีจะรีเซ็ตวันลาที่ใช้ไปของบุคลากรทุกคนกลับเป็นศูนย์ และไม่สามารถย้อนกลับได้</div>
          <div onclick="confirmYearlyReset()" class="dc-hover" style="cursor:pointer;display:inline-block;background:#dc2626;color:#fff;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:700">ยกยอดวันลาข้ามปี (Reset ประจำปี)</div>
        </div>
      </div>
    </div>`;
}

window.approvePendingUser = async (id) => {
  const role = (document.getElementById('pend-role-' + id) || {}).value || 'Teacher';
  showLoader(true);
  try { await api.approveUser(id, role); toast('อนุมัติผู้ใช้งานแล้ว'); await loadAdmin(); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};
window.rejectPendingUser = async (id) => {
  const c = await Swal.fire({ title: 'ปฏิเสธผู้ใช้งานนี้?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'ปฏิเสธ', cancelButtonText: 'ยกเลิก' });
  if (!c.isConfirmed) return;
  showLoader(true);
  try { await api.rejectUser(id); toast('ปฏิเสธผู้ใช้งานแล้ว'); await loadAdmin(); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};
window.setTypeQuota = async (id, val) => {
  try { await api.updateLeaveTypeQuota(id, val); const t = leaveTypes.find(x => x.id == id); if (t) t.quota_days = Number(val) || 0; toast('บันทึกโควตาแล้ว'); }
  catch (err) { swalError(err.message); }
};
window.addHoliday = async () => {
  showLoader(true);
  try { await api.saveHoliday({ date: todayISO(), name: 'วันหยุดใหม่' }); await loadAdmin(); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};
window.saveHoliday = async (id, field, val) => {
  try { await api.saveHoliday({ id, [field]: val }); const h = _adminData.holidays.find(x => x.id == id); if (h) h[field] = val; toast('บันทึกวันหยุดแล้ว'); }
  catch (err) { swalError(err.message); }
};
window.deleteHolidayRow = async (id) => {
  showLoader(true);
  try { await api.deleteHoliday(id); await loadAdmin(); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};
window.removeUser = async (id) => {
  const c = await Swal.fire({ title: 'ยืนยันการลบผู้ใช้งาน?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
  if (!c.isConfirmed) return;
  showLoader(true);
  try { await api.deleteTeacher(id); toast('ลบผู้ใช้งานแล้ว'); await loadAdmin(); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};
window.confirmYearlyReset = async () => {
  const c = await Swal.fire({
    title: 'ยืนยันการยกยอดวันลาข้ามปี', icon: 'warning',
    html: `การดำเนินการนี้จะรีเซ็ตวันลาที่ใช้ไปของบุคลากรทุกคน (${_adminData.teachers.length} คน) กลับเป็น 0 วัน`,
    showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'ยืนยันรีเซ็ต', cancelButtonText: 'ยกเลิก'
  });
  if (!c.isConfirmed) return;
  showLoader(true);
  try { await api.yearlyReset(); toast('ยกยอดวันลาข้ามปีเรียบร้อยแล้ว'); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};

// ===========================================================================
// MODALS
// ===========================================================================
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
window.closeModal = closeModal;
function overlay(inner, align = 'center') {
  const justify = align === 'end' ? 'flex-end' : 'center';
  return `<div onclick="closeModal()" style="position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:${justify};justify-content:center;z-index:1000;padding:${align === 'end' ? '0' : '20px'}">
    <div onclick="event.stopPropagation()">${inner}</div></div>`;
}

// ---- Teacher: leave form ----
window.openLeaveForm = () => {
  // Types filtered by gender restriction (คลอด=หญิง, ช่วยภริยาคลอด=ชาย)
  const avail = availableTypesFor(currentUser.prefix);
  const chips = avail.map((lt, i) => `<div onclick="pickLeaveType('${esc(lt.id)}')" data-lt="${esc(lt.id)}" class="lt-chip" style="cursor:pointer;padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:700;background:${i === 0 ? lt.color_code : '#f8fafc'};color:${i === 0 ? '#fff' : lt.color_code};border:1px solid ${lt.color_code}">${esc(lt.name)}</div>`).join('');
  const inner = `
    <div style="width:100vw;max-width:430px;background:#fff;border-radius:20px 20px 0 0;padding:22px 20px 28px;max-height:88vh;overflow-y:auto;animation:fadeUp .25s ease">
      <div style="width:36px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 16px"></div>
      <div style="font-size:17px;font-weight:800;margin-bottom:16px">ยื่นใบลา</div>
      <div style="margin-bottom:14px">
        <div class="dc-label">ประเภทการลา</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="lt-chips">${chips}</div>
        <input type="hidden" id="lf-type" value="${esc(avail[0] ? avail[0].id : '')}"/>
      </div>
      <div style="margin-bottom:12px"><div class="dc-label">วันที่เริ่มลา</div>${thaiDate('lf-from', '', 'calcLeaveDays()')}</div>
      <div style="margin-bottom:14px"><div class="dc-label">วันที่สิ้นสุด</div>${thaiDate('lf-to', '', 'calcLeaveDays()')}</div>
      <div id="lf-days" style="font-size:12px;color:#2563eb;font-weight:600;margin:-6px 0 12px"></div>
      <div style="margin-bottom:14px">
        <div class="dc-label">เหตุผลการลา</div>
        <textarea id="lf-reason" placeholder="ระบุเหตุผลการลา" class="dc-input" style="min-height:70px;resize:vertical"></textarea>
      </div>
      <div style="margin-bottom:18px">
        <div class="dc-label">แนบใบรับรองแพทย์ (ถ้ามี)</div>
        <input type="file" id="lf-file" class="dc-input" style="padding:8px"/>
      </div>
      <button onclick="submitLeaveForm()" class="dc-btn-primary">ส่งใบลา</button>
    </div>`;
  document.getElementById('modal-root').innerHTML = overlay(inner, 'end');
};
window.pickLeaveType = (id) => {
  document.getElementById('lf-type').value = id;
  document.querySelectorAll('.lt-chip').forEach(el => {
    const lt = leaveTypes.find(x => x.id == el.dataset.lt);
    const on = el.dataset.lt === id;
    el.style.background = on ? lt.color_code : '#f8fafc';
    el.style.color = on ? '#fff' : lt.color_code;
  });
  calcLeaveDays();
};
// Count leave days on the client, matching the type's count_mode + holidays
function countDaysClient(from, to, mode) {
  if (mode === 'continuous') return daysBetween(from, to);
  const hol = (_teacherData.holidays || []).map(h => normDate(h.date));
  let c = 0; const cur = parseISO(from), end = parseISO(to);
  while (cur <= end) {
    const d = cur.getDay();
    const iso = toISO(cur.getFullYear(), cur.getMonth(), cur.getDate());
    if (d !== 0 && d !== 6 && !hol.includes(iso)) c++;
    cur.setDate(cur.getDate() + 1);
  }
  return c;
}
window.calcLeaveDays = () => {
  const from = document.getElementById('lf-from').value, to = document.getElementById('lf-to').value;
  const el = document.getElementById('lf-days');
  if (!from || !to) { el.innerHTML = ''; el.dataset.days = 0; return; }
  if (parseISO(to) < parseISO(from)) { el.innerHTML = '<span style="color:#dc2626">วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา</span>'; el.dataset.days = 0; return; }
  const type = leaveTypes.find(t => t.id == document.getElementById('lf-type').value);
  const mode = type ? type.count_mode : 'working';
  const days = countDaysClient(from, to, mode);
  el.dataset.days = days;
  let msg = `จำนวนวันลา ${days} วัน` + (mode === 'continuous' ? ' (นับต่อเนื่องรวมวันหยุด)' : ' (นับเฉพาะวันทำการ)');
  let color = '#2563eb';
  const certDays = type ? Number(type.needs_cert_days) || 0 : 0;
  if (certDays > 0 && daysBetween(from, to) >= certDays) {
    msg += ` · ต้องแนบใบรับรองแพทย์ (ลาป่วยตั้งแต่ ${certDays} วัน)`;
    color = '#b45309';
  }
  el.innerHTML = `<span style="color:${color}">${esc(msg)}</span>`;
};
window.submitLeaveForm = async () => {
  const type = document.getElementById('lf-type').value;
  const from = document.getElementById('lf-from').value;
  const to = document.getElementById('lf-to').value;
  const reason = document.getElementById('lf-reason').value.trim();
  const days = Number(document.getElementById('lf-days').dataset.days || 0);
  if (!from || !to || parseISO(to) < parseISO(from)) { toast('กรุณาระบุวันที่ให้ถูกต้อง'); return; }
  if (!reason) { toast('กรุณาระบุเหตุผลการลา'); return; }
  if (days <= 0) { toast('จำนวนวันลาต้องมากกว่า 0'); return; }
  const fileEl = document.getElementById('lf-file');
  const typeObj = leaveTypes.find(t => t.id == type);
  const certDays = typeObj ? Number(typeObj.needs_cert_days) || 0 : 0;
  if (certDays > 0 && daysBetween(from, to) >= certDays && !fileEl.files.length) {
    toast(`ลาป่วยตั้งแต่ ${certDays} วัน ต้องแนบใบรับรองแพทย์`); return;
  }
  showLoader(true);
  try {
    let fileBase64 = null, fileName = null;
    if (fileEl.files.length) { fileName = fileEl.files[0].name; fileBase64 = await toBase64(fileEl.files[0]); }
    await api.submitLeaveRequest({
      teacher_id: currentUser.id, leave_type_id: type, start_date: from, end_date: to,
      total_days: days, reason, fileBase64, fileName
    });
    closeModal();
    toast('ส่งใบลาสำเร็จ รอการอนุมัติ');
    await loadTeacher();
  } catch (err) { swalError(err.message); } finally { showLoader(false); }
};
window.cancelRequest = async (reqId) => {
  const c = await Swal.fire({ title: 'ยกเลิกคำขอนี้?', text: 'โควตาการลาจะถูกคืนเข้าระบบ', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'ยกเลิกคำขอ', cancelButtonText: 'ย้อนกลับ' });
  if (!c.isConfirmed) return;
  showLoader(true);
  try { await api.cancelLeaveRequest(reqId); toast('ยกเลิกคำขอแล้ว'); await loadTeacher(); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};

// ---- HR: on-behalf ----
window.openOnBehalf = () => {
  const teacherOpts = _hrData.teachers.map(t => `<option value="${esc(t.id)}">${esc(t.prefix || '')}${esc(t.name)} ${esc(t.surname || '')} (${esc(t.department || '-')})</option>`).join('');
  const inner = `
    <div style="width:100vw;max-width:440px;background:#fff;border-radius:16px;padding:22px">
      <div style="font-size:16px;font-weight:800;margin-bottom:16px">สร้างใบลาแทนครู</div>
      <div style="margin-bottom:12px"><div class="dc-label">เลือกบุคลากร</div><select id="ob-user" class="dc-input" onchange="obFilterTypes()">${teacherOpts}</select></div>
      <div style="margin-bottom:12px"><div class="dc-label">ประเภทการลา</div><select id="ob-type" class="dc-input"></select></div>
      <div style="margin-bottom:12px"><div class="dc-label">วันที่เริ่มลา</div>${thaiDate('ob-from')}</div>
      <div style="margin-bottom:12px"><div class="dc-label">วันที่สิ้นสุด</div>${thaiDate('ob-to')}</div>
      <div style="margin-bottom:18px"><div class="dc-label">เหตุผล</div><textarea id="ob-reason" class="dc-input" style="min-height:60px;resize:vertical"></textarea></div>
      <div style="display:flex;gap:8px">
        <div onclick="closeModal()" class="dc-hover" style="cursor:pointer;flex:1;text-align:center;padding:11px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:700;color:#334155">ยกเลิก</div>
        <div onclick="submitOnBehalf()" class="dc-hover" style="cursor:pointer;flex:1;text-align:center;background:#2563eb;color:#fff;padding:11px;border-radius:10px;font-size:13px;font-weight:700">บันทึกใบลา</div>
      </div>
    </div>`;
  document.getElementById('modal-root').innerHTML = overlay(inner);
  obFilterTypes();
};
// Rebuild type options for the selected teacher (hide maternity for male)
window.obFilterTypes = () => {
  const teacher = _hrData.teachers.find(t => t.id == document.getElementById('ob-user').value);
  const avail = availableTypesFor(teacher ? teacher.prefix : '');
  document.getElementById('ob-type').innerHTML = avail.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
};
window.submitOnBehalf = async () => {
  const teacher_id = document.getElementById('ob-user').value;
  const leave_type_id = document.getElementById('ob-type').value;
  const start_date = document.getElementById('ob-from').value;
  const end_date = document.getElementById('ob-to').value;
  const reason = document.getElementById('ob-reason').value.trim();
  if (!teacher_id || !start_date || !end_date || !reason) { toast('กรุณากรอกข้อมูลให้ครบถ้วน'); return; }
  if (parseISO(end_date) < parseISO(start_date)) { toast('วันที่ไม่ถูกต้อง'); return; }
  showLoader(true);
  try {
    await api.createLeaveOnBehalf({ teacher_id, leave_type_id, start_date, end_date, reason, created_by: currentUser.id });
    closeModal(); toast('สร้างใบลาแทนครูสำเร็จ'); await loadHr();
  } catch (err) { swalError(err.message); } finally { showLoader(false); }
};

// ---- Admin: user CRUD ----
window.openUserModal = (id) => {
  const u = id ? _adminData.teachers.find(x => x.id == id) : null;
  const roleOpt = (v, label) => `<option value="${v}" ${u && u.role === v ? 'selected' : ''}>${label}</option>`;
  const inner = `
    <div style="width:100vw;max-width:420px;background:#fff;border-radius:16px;padding:22px">
      <div style="font-size:16px;font-weight:800;margin-bottom:16px">${u ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}</div>
      <input type="hidden" id="uf-id" value="${u ? esc(u.id) : ''}"/>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px">
        <div style="display:flex;gap:10px">
          <div style="width:132px"><div class="dc-label">คำนำหน้า</div>${prefixSelectHtml('uf', u ? (u.prefix || '') : '')}</div>
          <div style="flex:1"><div class="dc-label">ชื่อ</div><input type="text" id="uf-name" class="dc-input" value="${u ? esc(u.name) : ''}"/></div>
          <div style="flex:1"><div class="dc-label">นามสกุล</div><input type="text" id="uf-surname" class="dc-input" value="${u ? esc(u.surname || '') : ''}"/></div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1"><div class="dc-label">ตำแหน่ง/วิทยฐานะ</div><input type="text" id="uf-position" class="dc-input" value="${u ? esc(u.position || '') : ''}"/></div>
          <div style="flex:1"><div class="dc-label">กลุ่มสาระ/ฝ่าย</div><input type="text" id="uf-dept" class="dc-input" value="${u ? esc(u.department || '') : ''}"/></div>
        </div>
        <div><div class="dc-label">อีเมล (ถ้ามี)</div><input type="email" id="uf-email" class="dc-input" value="${u ? esc(u.email || '') : ''}"/></div>
        <div><div class="dc-label">สิทธิ์การใช้งาน</div>
          <select id="uf-role" class="dc-input">
            ${roleOpt('Teacher', 'ครู (Teacher)')}${roleOpt('HR', 'ฝ่ายบุคคล (HR)')}${roleOpt('Director', 'ผู้อำนวยการ (Director)')}${roleOpt('Admin', 'ผู้ดูแลระบบ (Admin)')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <div onclick="closeModal()" class="dc-hover" style="cursor:pointer;flex:1;text-align:center;padding:11px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:700;color:#334155">ยกเลิก</div>
        <div onclick="saveUser()" class="dc-hover" style="cursor:pointer;flex:1;text-align:center;background:#2563eb;color:#fff;padding:11px;border-radius:10px;font-size:13px;font-weight:700">บันทึก</div>
      </div>
    </div>`;
  document.getElementById('modal-root').innerHTML = overlay(inner);
};
window.saveUser = async () => {
  const obj = {
    id: document.getElementById('uf-id').value || undefined,
    prefix: getPrefix('uf'),
    name: document.getElementById('uf-name').value.trim(),
    surname: document.getElementById('uf-surname').value.trim(),
    position: document.getElementById('uf-position').value.trim(),
    department: document.getElementById('uf-dept').value.trim(),
    email: document.getElementById('uf-email').value.trim(),
    role: document.getElementById('uf-role').value,
  };
  if (!obj.name) { toast('กรุณากรอกชื่อ'); return; }
  showLoader(true);
  try { await api.saveTeacher(obj); closeModal(); toast(obj.id ? 'บันทึกข้อมูลผู้ใช้งานแล้ว' : 'เพิ่มผู้ใช้งานใหม่แล้ว'); await loadAdmin(); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};

const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
});

// ===========================================================================
// LEAVE FORM DOCUMENT (แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว) -> print / save PDF
// ===========================================================================
const SCHOOL_NAME = 'โรงเรียนบ้านห้วยตาด';

// Map a leave type name to the 3 categories on the official form
function leaveKind(name) {
  const n = String(name || '');
  if (n.includes('ป่วย')) return 'sick';
  if (n.includes('คลอด')) return 'maternity';
  if (n.includes('กิจ')) return 'personal';
  return '';
}

// Teacher: print own approved leave
window.printLeaveForm = (reqId) => {
  const rec = _teacherData.history.find(r => r.id == reqId);
  if (!rec) { toast('ไม่พบข้อมูลใบลา'); return; }
  openPrint(buildLeaveFormHtml(rec, currentUser, _teacherData.quotas));
};
// HR: print any approved leave from the report
window.printLeaveFormHr = (reqId) => {
  const rec = _hrData.records.find(r => r.id == reqId);
  if (!rec) { toast('ไม่พบข้อมูลใบลา'); return; }
  const teacher = _hrData.teachers.find(t => t.id == rec.teacher_id) || { name: rec.teacher_name, department: rec.department };
  openPrint(buildLeaveFormHtml(rec, teacher, null));
};

function buildLeaveFormHtml(rec, teacher, quotas) {
  const box = (on) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:1px solid #000;vertical-align:middle;margin:0 4px">${on ? svg('check', 10, 3) : ''}</span>`;
  const fill = (text, min) => `<span style="display:inline-block;border-bottom:1px dotted #000;min-width:${min};text-align:center;padding:0 6px">${esc(text == null ? '' : text)}</span>`;

  const kind = leaveKind(rec.type_name || typeName(rec.leave_type_id));
  const doc = rec.created_at ? new Date(rec.created_at) : new Date();
  const from = normDate(rec.start_date), to = normDate(rec.end_date);
  const name = `${teacher.prefix || ''}${teacher.name || ''} ${teacher.surname || ''}`.trim();
  const position = teacher.position || (ROLE_META[teacher.role] ? ROLE_META[teacher.role].label : 'ครู');

  // Statistics table from quotas (used_days already includes this request once approved)
  const statRow = (label, matcher) => {
    const q = (quotas || []).find(x => String(x.type_name || '').includes(matcher));
    const used = q ? Number(q.used_days) || 0 : null;
    const thisTime = (kind && matcher && (rec.type_name || '').includes(matcher)) ? (Number(rec.total_days) || 0) : (used != null ? 0 : null);
    const before = used != null ? Math.max(0, used - (thisTime || 0)) : '';
    const sum = used != null ? used : '';
    return `<tr>
      <td style="border:1px solid #000;padding:6px 8px">${label}</td>
      <td style="border:1px solid #000;padding:6px 8px;text-align:center">${before}</td>
      <td style="border:1px solid #000;padding:6px 8px;text-align:center">${thisTime == null ? '' : (thisTime || '')}</td>
      <td style="border:1px solid #000;padding:6px 8px;text-align:center">${sum}</td>
    </tr>`;
  };

  const approved = rec.status === 'Approved';
  const line = 'display:inline-block;border-bottom:1px dotted #000;';

  return `
  <div style="max-width:720px;margin:0 auto;padding:36px 40px;font-family:'Sarabun',sans-serif;font-size:15px;color:#000;line-height:2.1">
    <div style="text-align:center;font-size:18px;font-weight:700;margin-bottom:14px">แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว</div>

    <div style="text-align:right">เขียนที่ ${fill(SCHOOL_NAME, '200px')}</div>
    <div style="text-align:center">วันที่ ${fill(doc.getDate(), '40px')} เดือน ${fill(THAI_MONTHS_FULL[doc.getMonth()], '120px')} พ.ศ. ${fill(doc.getFullYear() + 543, '70px')}</div>

    <div>เรื่อง ${fill('ขอลา' + (rec.type_name || typeName(rec.leave_type_id)), '300px')}</div>
    <div>เรียน ${fill('ผู้อำนวยการ' + SCHOOL_NAME, '400px')}</div>

    <div style="margin-top:6px">ข้าพเจ้า ${fill(name, '260px')} ตำแหน่ง ${fill(position, '200px')}</div>
    <div>สังกัด ${fill(SCHOOL_NAME + (teacher.department && teacher.department !== '-' ? ' กลุ่มสาระ/ฝ่าย ' + teacher.department : ''), '540px')}</div>

    <div style="margin-top:6px">ขอลา ${box(kind === 'sick')} ป่วย ${box(kind === 'personal')} กิจส่วนตัว ${box(kind === 'maternity')} คลอดบุตร</div>
    <div>เนื่องจาก ${fill(rec.reason, '560px')}</div>
    <div>ตั้งแต่วันที่ ${fill(fmtThai(from), '180px')} ถึงวันที่ ${fill(fmtThai(to), '180px')} มีกำหนด ${fill(rec.total_days, '50px')} วัน</div>
    <div>ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ ${fill('', '360px')}</div>
    <div>หมายเลขโทรศัพท์ ${fill(teacher.phone, '220px')}</div>

    <div style="text-align:center;margin-top:22px">(ลงชื่อ) <span style="${line}min-width:220px">&nbsp;</span> ผู้ลา</div>
    <div style="text-align:center">( ${esc(name)} )</div>

    <div style="display:flex;gap:24px;margin-top:26px;align-items:flex-start">
      <div style="flex:1">
        <div style="font-weight:700;margin-bottom:6px">สถิติการลาในปีงบประมาณนี้</div>
        <table style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.4">
          <thead><tr>
            <th style="border:1px solid #000;padding:6px 8px">ประเภทลา</th>
            <th style="border:1px solid #000;padding:6px 8px">ลามาแล้ว<br/>(วันทำการ)</th>
            <th style="border:1px solid #000;padding:6px 8px">ลาครั้งนี้<br/>(วันทำการ)</th>
            <th style="border:1px solid #000;padding:6px 8px">รวมเป็น<br/>(วันทำการ)</th>
          </tr></thead>
          <tbody>
            ${statRow('ป่วย', 'ป่วย')}
            ${statRow('กิจส่วนตัว', 'กิจ')}
            ${statRow('คลอดบุตร', 'คลอด')}
          </tbody>
        </table>
        <div style="margin-top:16px">(ลงชื่อ) <span style="${line}min-width:180px">&nbsp;</span> ผู้ตรวจสอบ</div>
        <div>ตำแหน่ง <span style="${line}min-width:200px">&nbsp;</span></div>
        <div>วันที่ <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:60px">&nbsp;</span></div>
      </div>

      <div style="flex:1">
        <div style="font-weight:700">ความเห็นผู้บังคับบัญชา</div>
        <div style="${line}width:100%;margin-top:20px">&nbsp;</div>
        <div style="margin-top:10px">(ลงชื่อ) <span style="${line}min-width:180px">&nbsp;</span></div>
        <div>ตำแหน่ง <span style="${line}min-width:200px">&nbsp;</span></div>
        <div>วันที่ <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:60px">&nbsp;</span></div>

        <div style="font-weight:700;margin-top:18px">คำสั่ง</div>
        <div>${box(approved)} อนุญาต ${box(rec.status === 'Rejected')} ไม่อนุญาต</div>
        <div style="${line}width:100%;margin-top:8px">${esc(rec.comments || '')}</div>
        <div style="margin-top:10px">(ลงชื่อ) <span style="${line}min-width:180px">&nbsp;</span></div>
        <div>ตำแหน่ง <span style="${line}min-width:200px">&nbsp;</span> ผู้อำนวยการ${esc(SCHOOL_NAME)}</div>
        <div>วันที่ <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:60px">&nbsp;</span></div>
      </div>
    </div>
  </div>`;
}

function openPrint(bodyHtml) {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) { toast('เบราว์เซอร์บล็อกป๊อปอัพ กรุณาอนุญาต'); return; }
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
    <title>ใบลา · ${esc(SCHOOL_NAME)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap">
    <style>@page{size:A4;margin:14mm}body{margin:0;font-family:'Sarabun',sans-serif}@media print{.noprint{display:none}}</style>
    </head><body>
    <div class="noprint" style="text-align:center;padding:12px;background:#f1f5f9">
      <button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-family:'Sarabun';font-weight:700;cursor:pointer">พิมพ์ / บันทึกเป็น PDF</button>
    </div>
    ${bodyHtml}
    </body></html>`);
  w.document.close();
  w.focus();
  w.onload = () => setTimeout(() => w.print(), 400);
}
