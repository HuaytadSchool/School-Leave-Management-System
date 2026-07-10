// Global State
let currentUser = null;
let currentLineProfile = null;
const LIFF_ID = "2010662195-iJjI0NIA"; // Replace with actual LIFF ID
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwg0ZgCJhyM1K27756K9e5WbyVZ61n09M3l0s9hCnuG1BNaV0r_dH_X9RajxuSblUzjpA/exec"; // Replace with deployed GAS API URL

// UI Utilities
const showLoader = (show = true) => {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
};

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

const swalError = (msg) => Swal.fire('เกิดข้อผิดพลาด!', msg, 'error');
const swalSuccess = (msg) => Swal.fire('สำเร็จ!', msg, 'success');

// API Proxy Wrapper for fetch
const api = new Proxy({}, {
  get: (target, funcName) => {
    return async (...args) => {
      // POST as text/plain to avoid CORS preflight OPTIONS in GAS
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: funcName,
          args: args
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    };
  }
});

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    showLoader(true);
    // Wait for liff sdk to load
    if (typeof liff !== 'undefined') {
      if (LIFF_ID === "YOUR_LIFF_ID_HERE") {
        console.warn("LIFF ID not configured. Running in standalone mode.");
        // Standalone Dev Mode Mock
        mockAuth('mock_line_user_id');
      } else {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          switchMainView('view-landing');
          showLoader(false);
          return;
        }
        currentLineProfile = await liff.getProfile();
        await authenticateUser(currentLineProfile.userId);
      }
    } else {
      mockAuth('mock_line_user_id');
    }
  } catch (err) {
    swalError('ไม่สามารถเริ่มต้นระบบได้: ' + err.message);
    showLoader(false);
  }
});

async function mockAuth(lineUserId) {
  await authenticateUser(lineUserId);
}

// Authentication Flow
async function authenticateUser(lineUserId) {
  try {
    const user = await api.getTeacherByLineId(lineUserId);
    if (user) {
      currentUser = user;
      setupUIForUser(user);
    } else {
      // Not bound yet, show Onboarding
      showLoader(false);
      switchMainView('view-onboarding');
    }
  } catch (err) {
    swalError('Authentication error: ' + err.message);
    showLoader(false);
  }
}

document.getElementById('form-bind-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('teacherName').value;
  const surname = document.getElementById('teacherSurname').value;
  const phone = document.getElementById('teacherPhone').value;

  showLoader(true);
  try {
    const lineUserId = currentLineProfile ? currentLineProfile.userId : 'mock_line_user_id';
    const payload = {
      name: name,
      surname: surname,
      department: '-', // Not used anymore
      phone: phone,
      line_user_id: lineUserId
    };
    const user = await api.registerTeacher(payload);
    currentUser = user;
    swalSuccess('ลงทะเบียนสำเร็จ');
    setupUIForUser(user);
  } catch (err) {
    showLoader(false);
    swalError(err.message);
  }
});

// UI Setup based on Role
async function setupUIForUser(user) {
  // Header Info
  document.getElementById('desktop-user-name').textContent = `${user.name} ${user.surname}`;
  document.getElementById('desktop-user-avatar').textContent = user.name.charAt(0);

  document.getElementById('mobile-nav').classList.remove('hidden');

  if (user.role === 'Admin' || user.role === 'HR') {
    document.getElementById('nav-admin').classList.remove('hidden');
    document.getElementById('nav-admin').classList.add('flex');
  }
  if (user.role === 'Supervisor' || user.role === 'Admin' || user.role === 'HR') {
    document.getElementById('nav-supervisor').classList.remove('hidden');
    document.getElementById('nav-supervisor').classList.add('flex');
  }

  // Default view is Teacher
  switchMainView('view-teacher');
  document.getElementById('teacher-welcome-name').textContent = `สวัสดีคุณ ${user.name}`;
  document.getElementById('teacher-welcome-dept').textContent = `โรงเรียนบ้านห้วยตาด`;

  await loadTeacherData();
  showLoader(false);
}

// View Switching Logic
function switchMainView(viewId) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');

  // Load data based on view
  if (viewId === 'view-supervisor') loadSupervisorData();
}

function switchTeacherTab(tabId) {
  // Tabs styling
  document.querySelectorAll('.tab-link').forEach(el => {
    el.classList.remove('active-tab', 'inactive-tab');
    if (el.id === `tab-${tabId}`) {
      el.classList.add('active-tab');
    } else {
      el.classList.add('inactive-tab');
    }
  });

  // Content switching
  document.querySelectorAll('.teacher-tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`teacher-tab-${tabId}`).classList.remove('hidden');
}

// Teacher Functions
async function loadTeacherData() {
  try {
    // 1. Load Quotas
    const quotas = await api.getLeaveQuotas(currentUser.id);
    renderQuotas(quotas);

    // 2. Load Types for Dropdown
    const types = await api.getLeaveTypes();
    const select = document.getElementById('leave_type');
    select.innerHTML = '<option value="">-- เลือกประเภทการลา --</option>';
    types.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });

    // 3. Load History
    const history = await api.getLeaveHistory(currentUser.id);
    renderHistory(history);

  } catch (err) {
    console.error(err);
    Toast.fire({ icon: 'error', title: 'ดึงข้อมูลล้มเหลว' });
  }
}

function renderQuotas(quotas) {
  const container = document.getElementById('quota-container');
  container.innerHTML = '';

  if (!quotas || quotas.length === 0) {
    container.innerHTML = '<div class="text-sm text-slate-500 p-4">ไม่มีข้อมูลโควต้าการลา</div>';
    return;
  }

  quotas.forEach(q => {
    const percentage = q.total_quota > 0 ? ((q.used_days + q.pending_days) / q.total_quota) * 100 : 0;
    const html = `
      <div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
        <div class="flex justify-between items-center mb-2">
          <span class="font-medium text-slate-700">${q.type_name}</span>
          <span class="text-xs font-bold px-2 py-1 rounded-full bg-slate-100" style="color: ${q.color_code}">${q.remaining_days} วัน</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 mb-1">
          <div class="h-2 rounded-full transition-all" style="width: ${percentage}%; background-color: ${q.color_code}"></div>
        </div>
        <div class="flex justify-between text-xs text-slate-500 mt-1">
          <span>ใช้ไป ${q.used_days} (+รออนุมัติ ${q.pending_days})</span>
          <span>ทั้งหมด ${q.total_quota}</span>
        </div>
      </div>
    `;
    container.innerHTML += html;
  });
}

const getStatusBadge = (status) => {
  const styles = {
    'Pending': 'bg-amber-100 text-amber-800',
    'Approved_L1': 'bg-blue-100 text-blue-800',
    'Approved': 'bg-green-100 text-green-800',
    'Rejected': 'bg-red-100 text-red-800',
    'Cancelled': 'bg-slate-100 text-slate-800'
  };
  const labels = {
    'Pending': 'รออนุมัติ',
    'Approved_L1': 'ผ่าน L1',
    'Approved': 'อนุมัติแล้ว',
    'Rejected': 'ไม่อนุมัติ',
    'Cancelled': 'ยกเลิกแล้ว'
  };
  return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${styles[status] || styles['Pending']}">${labels[status] || status}</span>`;
};

function renderHistory(history) {
  const container = document.getElementById('history-container');
  container.innerHTML = '';

  if (!history || history.length === 0) {
    container.innerHTML = '<div class="text-sm text-slate-500 p-4 text-center">ไม่มีประวัติการลา</div>';
    return;
  }

  history.forEach(h => {
    // Create clickable card
    const dateStr = new Date(h.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow";
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <h4 class="font-medium text-slate-800 text-sm">${h.type_name}</h4>
          <p class="text-xs text-slate-500 mt-0.5">${h.start_date} - ${h.end_date} (${h.total_days} วัน)</p>
        </div>
        ${getStatusBadge(h.status)}
      </div>
      <p class="text-xs text-slate-600 truncate mt-2">เหตุผล: ${h.reason}</p>
      <div class="text-[10px] text-slate-400 mt-2 text-right">ยื่นเมื่อ ${dateStr}</div>
    `;

    card.addEventListener('click', () => showHistoryModal(h));
    container.appendChild(card);
  });
}

function showHistoryModal(h) {
  let cancelBtn = '';
  if (h.status === 'Pending') {
    cancelBtn = `<button id="btn-cancel-req" class="mt-4 w-full bg-red-50 text-red-600 border border-red-200 rounded-md py-2 text-sm font-medium hover:bg-red-100 transition-colors">ยกเลิกคำขอนี้</button>`;
  }

  let attachmentHtml = h.attachment_url ? `<a href="${h.attachment_url}" target="_blank" class="text-indigo-600 text-sm underline"><i class="fa-solid fa-paperclip"></i> ดูเอกสารแนบ</a>` : '-';

  Swal.fire({
    title: 'รายละเอียดการลา',
    html: `
      <div class="text-left text-sm space-y-3 mt-4">
        <div class="grid grid-cols-3 border-b pb-2"><span class="text-slate-500">ประเภท</span><span class="col-span-2 font-medium">${h.type_name}</span></div>
        <div class="grid grid-cols-3 border-b pb-2"><span class="text-slate-500">วันที่</span><span class="col-span-2">${h.start_date} ถึง ${h.end_date}</span></div>
        <div class="grid grid-cols-3 border-b pb-2"><span class="text-slate-500">รวม</span><span class="col-span-2">${h.total_days} วัน</span></div>
        <div class="grid grid-cols-3 border-b pb-2"><span class="text-slate-500">เหตุผล</span><span class="col-span-2">${h.reason}</span></div>
        <div class="grid grid-cols-3 border-b pb-2"><span class="text-slate-500">สถานะ</span><span class="col-span-2">${getStatusBadge(h.status)}</span></div>
        <div class="grid grid-cols-3 border-b pb-2"><span class="text-slate-500">หมายเหตุ</span><span class="col-span-2">${h.comments || '-'}</span></div>
        <div class="grid grid-cols-3 border-b pb-2"><span class="text-slate-500">เอกสาร</span><span class="col-span-2">${attachmentHtml}</span></div>
      </div>
      ${cancelBtn}
    `,
    showConfirmButton: true,
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#4f46e5',
    didOpen: () => {
      const btn = document.getElementById('btn-cancel-req');
      if (btn) {
        btn.addEventListener('click', async () => {
          Swal.close();
          const confirm = await Swal.fire({
            title: 'ยืนยันการยกเลิก?',
            text: "โควต้าการลาจะถูกคืนเข้าสู่ระบบ",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e02424',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'ใช่, ยกเลิกเลย',
            cancelButtonText: 'ย้อนกลับ'
          });
          if (confirm.isConfirmed) {
            showLoader(true);
            try {
              await api.cancelLeaveRequest(h.id);
              swalSuccess('ยกเลิกสำเร็จ');
              loadTeacherData();
            } catch (err) {
              swalError(err.message);
            } finally {
              showLoader(false);
            }
          }
        });
      }
    }
  });
}

// Date Calculation Logic
const calcDays = () => {
  const start = document.getElementById('start_date').value;
  const end = document.getElementById('end_date').value;
  const el = document.getElementById('calculated_days');

  if (!start || !end) {
    el.textContent = "0 วัน";
    el.dataset.days = 0;
    return;
  }

  let startDate = new Date(start);
  let endDate = new Date(end);

  if (endDate < startDate) {
    el.textContent = "วันที่ไม่ถูกต้อง";
    el.dataset.days = 0;
    return;
  }

  // Basic calculation excluding weekends (Can be expanded to check Holidays table)
  let count = 0;
  let curDate = new Date(startDate);
  while (curDate <= endDate) {
    let dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++; // 0=Sun, 6=Sat
    curDate.setDate(curDate.getDate() + 1);
  }

  el.textContent = `${count} วัน`;
  el.dataset.days = count;
};

document.getElementById('start_date').addEventListener('change', calcDays);
document.getElementById('end_date').addEventListener('change', calcDays);

// Leave Form Submission
document.getElementById('form-leave').addEventListener('submit', async (e) => {
  e.preventDefault();

  const leave_type_id = document.getElementById('leave_type').value;
  const start_date = document.getElementById('start_date').value;
  const end_date = document.getElementById('end_date').value;
  const reason = document.getElementById('reason').value;
  const total_days = parseInt(document.getElementById('calculated_days').dataset.days || "0");
  const fileInput = document.getElementById('attachment');

  if (total_days <= 0) {
    swalError('จำนวนวันลาต้องมากกว่า 0 วัน (ไม่รวมวันหยุด)');
    return;
  }

  showLoader(true);
  try {
    let fileBase64 = null;
    let fileName = null;

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      fileName = file.name;
      fileBase64 = await toBase64(file);
    }

    const payload = {
      teacher_id: currentUser.id,
      leave_type_id: leave_type_id,
      start_date: start_date,
      end_date: end_date,
      total_days: total_days,
      reason: reason,
      fileBase64: fileBase64,
      fileName: fileName
    };

    await api.submitLeaveRequest(payload);

    swalSuccess('ส่งคำขอลาสำเร็จ');
    document.getElementById('form-leave').reset();
    document.getElementById('calculated_days').textContent = '0 วัน';

    // Reload and switch to history
    await loadTeacherData();
    switchTeacherTab('history');

  } catch (err) {
    swalError(err.message);
  } finally {
    showLoader(false);
  }
});

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

// Supervisor Functions
async function loadSupervisorData() {
  showLoader(true);
  try {
    const pending = await api.getPendingRequestsForSupervisor(currentUser.id);

    document.getElementById('supervisor-badge-count').textContent = pending.length;

    const container = document.getElementById('supervisor-pending-container');
    container.innerHTML = '';

    if (pending.length === 0) {
      container.innerHTML = '<div class="text-sm text-slate-500 p-8 text-center bg-white rounded-xl shadow-sm border border-slate-100">ไม่มีรายการรออนุมัติ</div>';
      return;
    }

    pending.forEach(req => {
      const html = `
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-bold text-slate-800">${req.teacher_name}</h3>
              <span class="text-xs text-slate-500">แผนก: ${req.department}</span>
            </div>
            <span class="px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">${req.leave_type_id}</span>
          </div>
          
          <div class="bg-slate-50 rounded p-3 text-sm border border-slate-100">
            <div class="grid grid-cols-3 mb-1"><span class="text-slate-500">วันที่:</span><span class="col-span-2 font-medium">${req.start_date} ถึง ${req.end_date} (${req.total_days} วัน)</span></div>
            <div class="grid grid-cols-3"><span class="text-slate-500">เหตุผล:</span><span class="col-span-2">${req.reason}</span></div>
          </div>
          
          <div class="flex gap-2 mt-2">
            <button onclick="handleApproveReject('${req.id}', 'Approved')" class="flex-1 bg-indigo-600 text-white rounded-md py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">อนุมัติ</button>
            <button onclick="handleApproveReject('${req.id}', 'Rejected')" class="flex-1 bg-white border border-red-200 text-red-600 rounded-md py-2 text-sm font-medium hover:bg-red-50 transition-colors">ไม่อนุมัติ</button>
          </div>
        </div>
      `;
      container.innerHTML += html;
    });

  } catch (err) {
    swalError('ดึงข้อมูลผิดพลาด: ' + err.message);
  } finally {
    showLoader(false);
  }
}

window.handleApproveReject = async (reqId, status) => {
  const actionTxt = status === 'Approved' ? 'อนุมัติ' : 'ไม่อนุมัติ';
  const { value: comment } = await Swal.fire({
    title: `ยืนยัน${actionTxt}`,
    input: 'text',
    inputLabel: 'ระบุหมายเหตุ (ถ้ามี)',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: status === 'Approved' ? '#4f46e5' : '#e02424'
  });

  if (comment !== undefined) { // if not cancelled
    showLoader(true);
    try {
      await api.updateLeaveStatusAPI(reqId, status, comment, currentUser.id);
      swalSuccess('บันทึกสำเร็จ');
      loadSupervisorData();
    } catch (err) {
      swalError(err.message);
    } finally {
      showLoader(false);
    }
  }
};
