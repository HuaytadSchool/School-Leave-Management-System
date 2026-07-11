// ===========================================================================
// hr.js — HR portal
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
  const activeRecs = s.records.filter(r => isActive(r.status));
  const onLeaveToday = activeRecs.filter(r => dateInRange(today, r.start_date, r.end_date));
  const pendingAll = s.records.filter(r => isPending(r.status));
  const approvedThisMonth = s.records.filter(r => r.status === 'Approved' && normDate(r.start_date).startsWith(today.substring(0, 7)));
  const tab = _activeTab.HR || 0;

  // Tab 0: ภาพรวม
  const onLeaveChips = onLeaveToday.length ? onLeaveToday.map(r => `
    <div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:6px 14px 6px 6px">
      <div style="width:28px;height:28px;border-radius:50%;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff">${initials(r.teacher_name)}</div>
      <div style="font-size:12px;font-weight:600">${esc(r.teacher_name)}</div>
      <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${r.color_code}22;color:${r.color_code};font-weight:600">${esc(r.type_name)}</span>
    </div>`).join('')
    : '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">ไม่มีบุคลากรลาในวันนี้</div>';

  const tabContent0 = `
    <div class="dc-grid4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px">
      ${[
        { label: 'ลาวันนี้', value: onLeaveToday.length, sub: 'คน', color: '#2563eb', bg: '#eff6ff' },
        { label: 'รออนุมัติ', value: pendingAll.length, sub: 'รายการ', color: '#b45309', bg: '#fffbeb' },
        { label: 'อนุมัติแล้ว (เดือนนี้)', value: approvedThisMonth.length, sub: 'รายการ', color: '#15803d', bg: '#f0fdf4' },
        { label: 'บุคลากรทั้งหมด', value: s.teachers.length, sub: 'คน', color: '#334155', bg: '#f8fafc' },
      ].map(c => `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px">
          <div style="width:36px;height:36px;border-radius:10px;background:${c.bg};display:flex;align-items:center;justify-content:center;margin-bottom:12px">
            <div style="width:10px;height:10px;border-radius:50%;background:${c.color}"></div>
          </div>
          <div style="font-size:28px;font-weight:800;color:${c.color};line-height:1">${c.value}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px">${c.sub}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:600">${c.label}</div>
        </div>`).join('')}
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">ใครลาบ้างวันนี้ (${onLeaveToday.length} คน)</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">${onLeaveChips}</div>
    </div>`;

  // Tab 1: รออนุมัติ
  const tabContent1 = `
    <div style="margin-bottom:16px">
      <div style="font-size:18px;font-weight:800">คำขอรออนุมัติ</div>
      <div style="font-size:13px;color:#64748b">${s.pending.length} รายการรอการพิจารณา</div>
    </div>
    ${s.pending.length
      ? `<div style="display:flex;flex-direction:column;gap:14px">${s.pending.map(approvalCard).join('')}</div>`
      : `<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:14px;padding:48px;text-align:center;color:#94a3b8;font-size:13px">ไม่มีคำขอรออนุมัติในขณะนี้</div>`}`;

  // Tab 2: รายงาน
  const depts = [...new Set(s.teachers.map(t => t.department).filter(Boolean))];
  const deptOpts = ['all', ...depts].map(d => `<option value="${esc(d)}" ${hrFilters.dept === d ? 'selected' : ''}>${d === 'all' ? 'ทุกกลุ่มสาระ/ฝ่าย' : esc(d)}</option>`).join('');
  const typeOpts = ['all', ...leaveTypes.map(t => t.id)].map(id => `<option value="${esc(id)}" ${hrFilters.type === id ? 'selected' : ''}>${id === 'all' ? 'ทุกประเภท' : esc(typeName(id))}</option>`).join('');
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
  const arrowName = hrSort.field === 'teacher_name' ? svg(hrSort.dir === 'asc' ? 'chevronUp' : 'chevronDown', 12) : '';
  const arrowDate = hrSort.field === 'start_date' ? svg(hrSort.dir === 'asc' ? 'chevronUp' : 'chevronDown', 12) : '';
  const th = (label, onclick = '', arrow = '') => `<th ${onclick ? `onclick="${onclick}" style="cursor:pointer;` : 'style="'}text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #e2e8f0">${label} ${arrow}</th>`;
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
  const tabContent2 = `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div style="font-size:14px;font-weight:700">รายงานการลาทั้งหมด (${rows.length} รายการ)</div>
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
            ${th('ชื่อ-สกุล', "sortHr('teacher_name')", arrowName)}
            ${th('กลุ่มสาระ/ฝ่าย')}${th('ประเภทการลา')}
            ${th('วันที่', "sortHr('start_date')", arrowDate)}
            ${th('จำนวนวัน')}${th('สถานะ')}
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        ${rows.length === 0 ? '<div style="padding:30px;text-align:center;font-size:13px;color:#94a3b8">ไม่พบรายการ</div>' : ''}
      </div>
    </div>`;

  // Tab 3: บุคลากร
  const teacherRows = s.teachers.map(t => {
    const rm = ROLE_META[t.role] || { label: t.role, bg: '#f1f5f9', color: '#64748b' };
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px">
        <div style="width:40px;height:40px;border-radius:12px;background:${avatarColor(t.id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;flex:none">${initials(t.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700">${esc(t.prefix || '')}${esc(t.name)} ${esc(t.surname || '')}</div>
          <div style="font-size:11.5px;color:#64748b">${esc(t.position || '-')} · ${esc(t.department || '-')}</div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:${rm.bg};color:${rm.color};white-space:nowrap">${rm.label}</span>
      </div>`;
  }).join('');
  const tabContent3 = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div><div style="font-size:18px;font-weight:800">บุคลากร</div><div style="font-size:13px;color:#64748b">${s.teachers.length} คน</div></div>
      <div onclick="openOnBehalf()" class="dc-hover" style="cursor:pointer;background:#2563eb;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700">+ สร้างใบลาแทน</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">${teacherRows}</div>`;

  const tabContents = [tabContent0, tabContent1, tabContent2, tabContent3];
  const pageTitle = ['ภาพรวมการลาประจำวัน', 'คำขอรออนุมัติ', 'รายงานการลา', 'บุคลากร'][tab];

  document.getElementById('view-hr').innerHTML = `
    <div class="dc-shell" style="display:flex;min-height:100vh">
      ${sidebar('HR', { 1: s.pending.length || '' })}
      <div class="dc-main" style="flex:1;padding:28px 32px;max-width:1400px">
        <div style="margin-bottom:22px">
          <div style="font-size:22px;font-weight:800">${pageTitle}</div>
          <div style="font-size:13px;color:#64748b">วันนี้ ${fmtThai(today)}</div>
        </div>
        ${tabContents[tab] || ''}
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

// ---- HR: on-behalf modal ----
window.openOnBehalf = () => {
  const teacherOpts = _hrData.teachers.map(t => `<option value="${esc(t.id)}">${esc(t.prefix || '')}${esc(t.name)} ${esc(t.surname || '')} (${esc(t.department || '-')})</option>`).join('');
  const inner = `
    <div style="width:100vw;max-width:440px;background:#fff;border-radius:16px;padding:22px">
      <div style="font-size:16px;font-weight:800;margin-bottom:16px">สร้างใบลาแทนครู</div>
      <div style="margin-bottom:12px"><div class="dc-label">เลือกบุคลากร</div><select id="ob-user" class="dc-input" onchange="obFilterTypes()">${teacherOpts}</select></div>
      <div style="margin-bottom:12px"><div class="dc-label">ประเภทการลา</div><select id="ob-type" class="dc-input"></select></div>
      <div style="margin-bottom:12px"><div class="dc-label">เลือกช่วงวันลา</div>${rangeCalendar('ob')}</div>
      <div style="margin-bottom:18px"><div class="dc-label">เหตุผล</div><textarea id="ob-reason" class="dc-input" style="min-height:60px;resize:vertical"></textarea></div>
      <div style="display:flex;gap:8px">
        <div onclick="closeModal()" class="dc-hover" style="cursor:pointer;flex:1;text-align:center;padding:11px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:700;color:#334155">ยกเลิก</div>
        <div onclick="submitOnBehalf()" class="dc-hover" style="cursor:pointer;flex:1;text-align:center;background:#2563eb;color:#fff;padding:11px;border-radius:10px;font-size:13px;font-weight:700">บันทึกใบลา</div>
      </div>
    </div>`;
  document.getElementById('modal-root').innerHTML = overlay(inner);
  obFilterTypes();
};
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
