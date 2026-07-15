// ===========================================================================
// director.js — Director portal (mobile UI)
// ===========================================================================

let _dirData = { pending: [], records: [], holidays: [] };
let _dirTab = 0; // 0=คำขอรออนุมัติ 1=ปฏิทิน 2=เมนูอื่นๆ

async function loadDirector() {
  const [pending, records, holidays] = await Promise.all([
    api.getPendingRequestsForApprover(currentUser.id, currentUser.role),
    api.getAllLeaveReport(),
    api.getHolidays()
  ]);
  _dirData = { pending, records, holidays };
  renderDirector();
}

window.setDirTab = (t) => { _dirTab = t; renderDirector(); };

// Shared approval card (mobile style)
function approvalCard(r) {
  const from = normDate(r.start_date), to = normDate(r.end_date);
  const range = (from === to ? fmtThai(from) : `${fmtShort(from)} - ${fmtThai(to)}`) + (r.half_day ? ` (${halfDayLabel(r.half_day)})` : '');
  const submittedAt = r.created_at ? _dirFmtTime(r.created_at) : '';
  const attach = r.attachment_url
    ? `<a href="${esc(r.attachment_url)}" target="_blank" style="color:#2563eb;font-size:11px;display:inline-flex;align-items:center;gap:3px">${svg('paperclip', 11)} เอกสารแนบ</a>`
    : '';
  const CLOCK_PATH = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
  const CAL_PATH   = '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>';
  return `
    <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:44px;height:44px;border-radius:50%;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#fff;flex:none">${initials(r.teacher_name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700">${esc(r.teacher_name)}</div>
          <div style="font-size:11.5px;color:#64748b">${esc(r.position || 'ครู')} · ${esc(r.department || '')}</div>
        </div>
        <span style="font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:999px;background:${r.color_code}22;color:${r.color_code};white-space:nowrap">${esc(r.type_name)}</span>
      </div>
      <div style="font-size:12px;color:#475569;margin-bottom:4px;display:flex;align-items:center;gap:5px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CAL_PATH}</svg>
        ${range} (${r.total_days} วัน)
      </div>
      <div style="font-size:12px;color:#334155;margin-bottom:4px;display:flex;align-items:flex-start;gap:5px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:2px;flex:none">${ICONS.list}</svg>
        ${esc(r.reason)}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:10.5px;color:#94a3b8;display:flex;align-items:center;gap:3px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CLOCK_PATH}</svg>
          ${submittedAt}
        </div>
        ${attach}
      </div>
      <textarea id="remark-${esc(r.id)}" placeholder="ความเห็น (ไม่บังคับ)" style="width:100%;min-height:40px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;resize:vertical;margin-bottom:10px;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:8px">
        <div onclick="decideRequest('${esc(r.id)}','approve')" class="dc-hover" style="cursor:pointer;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid #16a34a;color:#16a34a;padding:10px;border-radius:10px;font-size:13px;font-weight:700">
          ${svg('check', 14)} อนุมัติ
        </div>
        <div onclick="decideRequest('${esc(r.id)}','reject')" class="dc-hover" style="cursor:pointer;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid #dc2626;color:#dc2626;padding:10px;border-radius:10px;font-size:13px;font-weight:700">
          ${svg('x', 14)} ปฏิเสธ
        </div>
      </div>
    </div>`;
}

function renderDirector() {
  const s = _dirData;
  const u = currentUser;
  const fullName = `${u.prefix || ''}${u.name} ${u.surname || ''}`.trim();
  const today = todayISO();

  // SVG paths
  const BELL_PATH  = '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>';
  const HOME_PATH  = '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
  const MENU_PATH  = '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>';

  const bellBtn = `
    <div onclick="setDirTab(0)" style="position:relative;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${BELL_PATH}</svg>
      ${s.pending.length ? `<div style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;background:#ef4444;border-radius:999px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;padding:0 3px">${s.pending.length > 9 ? '9+' : s.pending.length}</div>` : ''}
    </div>`;

  // --- HERO ---
  const linePhoto = currentLineProfile ? currentLineProfile.pictureUrl : '';
  const aColor = avatarColor(u.id);
  const photoInner = linePhoto
    ? `<img src="${esc(linePhoto)}" style="width:100%;height:100%;object-fit:cover">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${initials(u.name)}</div>`;

  const heroTitles = [
    'คำขอรออนุมัติ',
    'ปฏิทินโรงเรียน',
    'เมนูอื่นๆ',
  ];
  const heroBody = _dirTab === 0 && s.pending.length === 0 ? `
    <div style="display:flex;align-items:center;gap:14px;position:relative;z-index:2;margin-top:10px">
      <div style="width:64px;height:64px;border-radius:50%;border:3px solid rgba(255,255,255,0.85);overflow:hidden;background:${aColor};flex:none">${photoInner}</div>
      <div>
        <div style="font-size:17px;font-weight:800">สวัสดี, ${esc(u.name)}</div>
        <div style="font-size:11.5px;opacity:.85;margin-top:3px">${esc(ROLE_META[u.role] ? ROLE_META[u.role].label : u.role)}</div>
        <div style="font-size:11px;opacity:.75;margin-top:2px">โรงเรียนบ้านห้วยตาด</div>
      </div>
    </div>` : `
    <div style="position:relative;z-index:2;margin-top:10px">
      <div style="font-size:20px;font-weight:800">${heroTitles[_dirTab] || ''}</div>
      <div style="font-size:12px;opacity:.85;margin-top:4px">ผู้อำนวยการ โรงเรียนบ้านห้วยตาด</div>
    </div>`;

  const heroRight = _dirTab === 0 ? `
    <div style="display:flex;gap:8px">
      ${bellBtn}
      <div onclick="setDirTab(2)" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${MENU_PATH}</svg>
      </div>
    </div>` : bellBtn;

  const hero = `
    <div style="background:url('https://img2.pic.in.th/BG_User.png') center/cover no-repeat;padding:18px 16px 54px;position:relative;overflow:hidden;color:#fff">
      <div style="position:absolute;inset:0;background:rgba(15,40,100,0.42)"></div>
      <div style="display:flex;justify-content:flex-end;position:relative;z-index:2">${heroRight}</div>
      ${heroBody}
    </div>`;

  // --- TOP 2-TAB BAR (tabs 0-1 only) ---
  const TOP_TABS = [
    { icon: 'checkCircle', label1: 'คำขอ',   label2: 'รออนุมัติ', badge: s.pending.length },
    { icon: 'calendar',    label1: 'ปฏิทิน', label2: 'โรงเรียน' },
  ];
  const topTabBar = _dirTab <= 1 ? `
    <div style="margin:-26px 0 0;background:#fff;border-radius:16px 16px 0 0;box-shadow:0 -4px 20px rgba(15,23,42,.08);position:relative;z-index:5">
      <div style="display:flex">
        ${TOP_TABS.map((t, i) => {
          const active = _dirTab === i;
          return `<div onclick="setDirTab(${i})" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:13px 4px 11px;cursor:pointer;border-bottom:2.5px solid ${active ? '#2563eb' : 'transparent'}">
            <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
              <span style="color:${active ? '#2563eb' : '#94a3b8'}">${svg(t.icon, 14)}</span>
              ${t.badge ? `<div style="min-width:17px;height:17px;background:#ef4444;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;padding:0 3px">${t.badge}</div>` : ''}
            </div>
            <div style="font-size:11px;font-weight:${active ? 700 : 500};color:${active ? '#1e3a8a' : '#94a3b8'};line-height:1.3;text-align:center">${t.label1}</div>
            <div style="font-size:10px;color:${active ? '#3b82f6' : '#b0bec5'};line-height:1.2;text-align:center">${t.label2}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  // --- BOTTOM NAV ---
  // Director submits leave through the district office, not this school system
  const navItems = [
    { label: 'หน้าแรก',  path: HOME_PATH,        action: 'setDirTab(0)', active: _dirTab === 0 },
    { label: 'ปฏิทิน',  path: ICONS.calendar,    action: 'setDirTab(1)', active: _dirTab === 1 },
    { label: 'เมนูอื่นๆ', path: MENU_PATH,        action: 'setDirTab(2)', active: _dirTab === 2 },
  ];
  const bottomNav = `
    <div style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:#fff;border-top:1px solid #f1f5f9;display:flex;z-index:100">
      ${navItems.map(n => `
        <div onclick="${n.action}" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 4px 8px;cursor:pointer;color:${n.active ? '#2563eb' : '#94a3b8'};gap:3px;position:relative">
          <div style="position:absolute;top:0;left:15%;right:15%;height:2.5px;border-radius:0 0 4px 4px;background:${n.active ? '#2563eb' : 'transparent'}"></div>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${n.path}</svg>
          <div style="font-size:9.5px;font-weight:600">${n.label}</div>
        </div>`).join('')}
    </div>`;

  // --- CONTENT ---
  let mainContent = '';
  const pbottom = _dirTab === 0 && s.pending.length ? '80px' : '80px';

  if (_dirTab === 0) {
    // ---- Tab 0: คำขอรออนุมัติ ----
    const onLeaveToday = s.records.filter(r =>
      isActive(r.status) && dateInRange(today, r.start_date, r.end_date)
    );

    if (s.pending.length === 0) {
      // Show mini overview when no pending
      mainContent = `
        <div style="background:#fff;border-radius:16px;padding:24px;text-align:center;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:16px">
          <div style="width:56px;height:56px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS.checkCircle}</svg>
          </div>
          <div style="font-size:15px;font-weight:800;color:#15803d;margin-bottom:4px">ไม่มีคำขอรออนุมัติ</div>
          <div style="font-size:12px;color:#94a3b8">ทุกรายการได้รับการพิจารณาแล้ว</div>
        </div>
        ${onLeaveToday.length ? `
        <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06)">
          <div style="font-size:13px;font-weight:800;margin-bottom:10px">บุคลากรลาวันนี้ (${onLeaveToday.length} คน)</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${onLeaveToday.map(r => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#f8fafc;border-radius:10px">
                <div style="width:36px;height:36px;border-radius:50%;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;flex:none">${initials(r.teacher_name)}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.teacher_name)}</div>
                  <div style="font-size:11px;color:${r.color_code || '#64748b'};font-weight:600">${esc(r.type_name)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}`;
    } else {
      mainContent = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-size:13px;font-weight:700;color:#64748b">${s.pending.length} รายการรอการพิจารณา</div>
          <div style="font-size:11.5px;color:#94a3b8">${fmtThai(today)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${s.pending.map(approvalCard).join('')}
        </div>`;
    }

  } else if (_dirTab === 1) {
    // ---- Tab 1: ปฏิทินโรงเรียน ----
    mainContent = `
      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06)">
        ${renderCalendar(s.records, s.holidays)}
      </div>`;

  } else {
    // ---- Tab 2: เมนูอื่นๆ ----
    // No "submit leave" menu: director leave goes through the district office
    mainContent = `
      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:50%;background:${avatarColor(u.id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff;flex:none">${initials(u.name)}</div>
          <div>
            <div style="font-size:14px;font-weight:800">${esc(fullName)}</div>
            <div style="font-size:12px;color:#64748b">${esc(ROLE_META[u.role] ? ROLE_META[u.role].label : u.role)}</div>
          </div>
        </div>
      </div>
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);overflow:hidden">
        <div onclick="logout()" class="dc-hover" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer">
          <div style="width:36px;height:36px;border-radius:10px;background:#fef2f2;display:flex;align-items:center;justify-content:center;flex:none;color:#b91c1c">${svg('logout', 16)}</div>
          <div style="flex:1;font-size:13.5px;font-weight:600;color:#b91c1c">ออกจากระบบ</div>
          ${svg('chevronRight', 14)}
        </div>
      </div>`;
  }

  document.getElementById('view-director').innerHTML = `
    <div style="width:100%;min-height:100vh;display:flex;justify-content:center;background:#f8fafc">
      <div style="width:100%;max-width:430px;background:#f8fafc;min-height:100vh;position:relative">
        ${hero}
        ${topTabBar}
        <div style="padding:16px 14px ${pbottom}">
          ${mainContent}
        </div>
        ${bottomNav}
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

  const weekdayCells = WEEKDAYS.map(w =>
    `<div style="text-align:center;font-size:10px;color:#94a3b8;font-weight:700;padding:2px 0">${w}</div>`
  ).join('');

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
    const badge = names.length
      ? `<div style="font-size:8px;font-weight:800;margin-top:1px;display:flex;align-items:center;gap:1px">${names.length}${svg('user', 8, 2.5)}</div>`
      : '';
    const click = (names.length || isHoliday) ? `onclick="showDayLeaves('${iso}')" ` : '';
    cells += `<div ${click}title="${esc(tip)}" style="aspect-ratio:1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;background:${bg};color:${color};border:${border};${click ? 'cursor:pointer' : ''}"><div style="font-weight:700">${d}</div>${badge}</div>`;
  }

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:14px;font-weight:800">ปฏิทินการลาโรงเรียน</div>
      <div style="display:flex;align-items:center;gap:6px">
        <div onclick="calMove(-1)" class="dc-hover" style="cursor:pointer;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;color:#334155">${svg('chevronLeft', 14)}</div>
        <div style="font-size:12.5px;font-weight:700;min-width:110px;text-align:center">${label}</div>
        <div onclick="calMove(1)" class="dc-hover" style="cursor:pointer;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;color:#334155">${svg('chevronRight', 14)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">${weekdayCells}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${cells}</div>
    <div style="display:flex;gap:14px;margin-top:12px;font-size:10.5px;color:#64748b">
      <div style="display:flex;align-items:center;gap:5px"><div style="width:9px;height:9px;border-radius:3px;background:#fef3c7"></div>มีผู้ลา</div>
      <div style="display:flex;align-items:center;gap:5px"><div style="width:9px;height:9px;border-radius:3px;background:#fee2e2"></div>วันหยุดราชการ</div>
    </div>`;
}

function _dirFmtTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `ยื่นเมื่อ ${fmtShort(toISO(d.getFullYear(), d.getMonth(), d.getDate()))} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} น.`;
}

window.showDayLeaves = (iso) => {
  const rows = (_dirData.records || []).filter(r => isActive(r.status) && dateInRange(iso, r.start_date, r.end_date));
  const holiday = (_dirData.holidays || []).find(h => normDate(h.date) === iso);
  const holidayHtml = holiday
    ? `<div style="background:#fee2e2;color:#b91c1c;font-size:12.5px;font-weight:700;padding:8px 12px;border-radius:10px;margin-bottom:10px">${esc(holiday.name)}</div>`
    : '';
  const listHtml = rows.length ? rows.map(r => {
    const from = normDate(r.start_date), to = normDate(r.end_date);
    const range = (from === to ? fmtShort(from) : `${fmtShort(from)} - ${fmtShort(to)}`) + (r.half_day ? ` (${halfDayLabel(r.half_day)})` : '');
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:#f8fafc;border-radius:10px;text-align:left">
        <div style="width:34px;height:34px;border-radius:50%;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;flex:none">${initials(r.teacher_name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.teacher_name)}</div>
          <div style="font-size:11px;color:#64748b">${range} (${r.total_days} วัน)</div>
        </div>
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;background:${r.color_code}22;color:${r.color_code};white-space:nowrap">${esc(r.type_name)}</span>
      </div>`;
  }).join('') : (holiday ? '' : '<div style="font-size:12px;color:#94a3b8">ไม่มีผู้ลา</div>');
  Swal.fire({
    title: `<div style="font-size:16px;font-weight:800">${fmtThai(iso)}</div>`,
    html: `${holidayHtml}<div style="display:flex;flex-direction:column;gap:7px;max-height:55vh;overflow-y:auto">${listHtml}</div>`,
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#2563eb'
  });
};

window.calMove = (delta) => {
  let { year, month } = calendarState;
  month += delta;
  if (month < 0)  { month = 11; year--; }
  if (month > 11) { month = 0;  year++; }
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
