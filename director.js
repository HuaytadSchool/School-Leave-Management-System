// ===========================================================================
// director.js — Director portal
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
  const tab = _activeTab.Director || 0;

  const tabContent0 = `
    <div style="margin-bottom:16px">
      <div style="font-size:18px;font-weight:800">คำขอรออนุมัติ</div>
      <div style="font-size:13px;color:#64748b">${s.pending.length} รายการรอการพิจารณา</div>
    </div>
    ${s.pending.length
      ? `<div style="display:flex;flex-direction:column;gap:14px">${s.pending.map(approvalCard).join('')}</div>`
      : `<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:14px;padding:48px;text-align:center;color:#94a3b8;font-size:13px">ไม่มีคำขอรออนุมัติในขณะนี้</div>`}`;

  const tabContent1 = `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px">
      ${renderCalendar(s.records, s.holidays)}
    </div>`;

  const pageTitles = ['คำขอรออนุมัติ', 'ปฏิทินโรงเรียน'];

  document.getElementById('view-director').innerHTML = `
    <div class="dc-shell" style="display:flex;min-height:100vh">
      ${sidebar('Director', { 0: s.pending.length || '' })}
      <div class="dc-main" style="flex:1;padding:28px 32px;max-width:900px">
        <div style="margin-bottom:22px">
          <div style="font-size:22px;font-weight:800">${pageTitles[tab]}</div>
        </div>
        ${[tabContent0, tabContent1][tab] || ''}
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
