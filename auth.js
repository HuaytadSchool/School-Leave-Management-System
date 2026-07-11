// ===========================================================================
// auth.js — boot, login, routing
// ===========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (SCHOOL_LOGO_URL) {
    const el = document.getElementById('landing-logo');
    if (el) el.innerHTML = `<img src="${SCHOOL_LOGO_URL}" style="width:100%;height:100%;object-fit:contain">`;
  }
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

window.openAdminLogin = () => {
  const inner = `
    <div style="width:100vw;max-width:360px;background:#fff;border-radius:16px;padding:24px">
      <div style="font-size:16px;font-weight:800;margin-bottom:4px">เข้าสู่ระบบผู้ดูแลระบบ</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px">สำหรับดูแลและจัดการระบบหลังบ้าน</div>
      <form id="admin-login-form" style="display:flex;flex-direction:column;gap:12px">
        <div><div class="dc-label">ชื่อผู้ใช้</div><input type="text" id="al-user" class="dc-input" autocomplete="username"/></div>
        <div><div class="dc-label">รหัสผ่าน</div><input type="password" id="al-pass" class="dc-input" autocomplete="current-password"/></div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <div onclick="closeModal()" class="dc-hover" style="cursor:pointer;flex:1;text-align:center;padding:11px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:700;color:#334155">ยกเลิก</div>
          <button type="submit" class="dc-btn-primary" style="flex:1;padding:11px">เข้าสู่ระบบ</button>
        </div>
      </form>
    </div>`;
  document.getElementById('modal-root').innerHTML = overlay(inner);
  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('al-user').value.trim();
    const password = document.getElementById('al-pass').value;
    showLoader(true);
    try {
      currentUser = await api.adminLogin(username, password);
      closeModal();
      await routeByRole();
    } catch (err) { swalError(err.message); } finally { showLoader(false); }
  });
};

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
    const [lt, hol, sig] = await Promise.all([api.getLeaveTypes(), api.getHolidays(), api.getSignatories()]);
    leaveTypes = lt; _holidays = hol;
    if (sig) {
      if (sig.director) { DIRECTOR_NAME = sig.director; localStorage.setItem('director_name', sig.director); }
      if (sig.hr)       { PREPARER_NAME = sig.hr;       localStorage.setItem('preparer_name', sig.hr); }
    }
    await reloadPortal();
  } catch (err) { swalError(err.message); }
  finally { showLoader(false); }
}

async function reloadPortal() {
  const role = currentUser.role || 'Teacher';
  if (role === 'HR') { showView('hr'); await loadHr(); }
  else if (role === 'Director') { showView('director'); await loadDirector(); }
  else if (role === 'Admin') { showView('admin'); await loadAdmin(); }
  else { showView('teacher'); await loadTeacher(); }
}
