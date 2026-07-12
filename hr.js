// ===========================================================================
// hr.js — HR portal (mobile UI)
// ===========================================================================

let _hrData = { records: [], teachers: [], pending: [] };
let _hrTab = 0;           // 0=ภาพรวม 1=รออนุมัติ 2=รายงาน 3=บุคลากร 4=เมนูอื่นๆ
let _hrSearch = '';
let _hrTypeChip = 'all';
let _hrReportView = 'person'; // 'person' | 'type'

async function loadHr() {
  const [records, teachers, pending] = await Promise.all([
    api.getAllLeaveReport(),
    api.getAllTeachers(),
    api.getPendingRequestsForApprover(currentUser.id, 'HR')
  ]);
  _hrData = { records, teachers, pending };
  renderHr();
}

window.setHrTab = (t) => { _hrTab = t; renderHr(); };
window.setHrSearch = (v) => { _hrSearch = v; renderHr(); };
window.setHrTypeChip = (v) => { _hrTypeChip = v; renderHr(); };
window.setHrReportView = (v) => { _hrReportView = v; renderHr(); };
window.openHrNotifications = () => { setHrTab(1); };
window.openHrSettings = () => { setHrTab(4); };

function renderHr() {
  const s = _hrData;
  const today = todayISO();
  const u = currentUser;
  const fullName = `${u.prefix || ''}${u.name} ${u.surname || ''}`.trim();

  // Computed stats
  const onLeaveToday = s.records.filter(r => isActive(r.status) && dateInRange(today, r.start_date, r.end_date));
  const pendingAll = s.records.filter(r => isPending(r.status));
  const approvedMonth = s.records.filter(r =>
    r.status === 'Approved' && normDate(r.start_date).startsWith(today.slice(0, 7))
  );
  const rejectedCancelled = s.records.filter(r => r.status === 'Rejected' || r.status === 'Cancelled');

  // SVG paths
  const BELL_PATH = '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>';
  const GEAR_PATH = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
  const HOME_PATH = '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
  const CAL_ADD  = '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>';
  const MENU_PATH = '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>';
  const CLOCK_PATH = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
  const SEARCH_PATH = '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>';
  const FILTER_PATH = '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>';

  // Bell button (reused in hero)
  const bellBtn = (pending = s.pending.length) => `
    <div onclick="openHrNotifications()" style="position:relative;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${BELL_PATH}</svg>
      ${pending ? `<div style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;background:#ef4444;border-radius:999px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;padding:0 3px">${pending > 9 ? '9+' : pending}</div>` : ''}
    </div>`;

  // --- HERO ---
  const linePhoto = currentLineProfile ? currentLineProfile.pictureUrl : '';
  const aColor = avatarColor(u.id);
  const photoInner = linePhoto
    ? `<img src="${esc(linePhoto)}" style="width:100%;height:100%;object-fit:cover">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${initials(u.name)}</div>`;

  const heroTitles = [
    { title: `สวัสดี, ${esc(u.name)}`, sub: 'จัดการข้อมูลการลาของบุคลากร<br>โรงเรียนบ้านห้วยตาด', showProfile: true },
    { title: 'คำขอรออนุมัติ',          sub: 'ฝ่ายบุคคล โรงเรียนบ้านห้วยตาด',                   showProfile: false },
    { title: 'รายงานการลา',            sub: 'ฝ่ายบุคคล โรงเรียนบ้านห้วยตาด',                   showProfile: false },
    { title: 'บุคลากร',               sub: `โรงเรียนบ้านห้วยตาด · ${s.teachers.length} คน`,    showProfile: false },
    { title: 'เมนูอื่นๆ',             sub: 'ฝ่ายบุคคล โรงเรียนบ้านห้วยตาด',                   showProfile: false },
  ];
  const ht = heroTitles[_hrTab] || heroTitles[0];

  const heroRight = _hrTab === 0 ? `
    <div style="display:flex;gap:8px">
      ${bellBtn()}
      <div onclick="openHrSettings()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GEAR_PATH}</svg>
      </div>
    </div>` : bellBtn();

  const heroBody = ht.showProfile ? `
    <div style="display:flex;align-items:center;gap:14px;position:relative;z-index:2;margin-top:10px">
      <div style="width:64px;height:64px;border-radius:50%;border:3px solid rgba(255,255,255,0.85);overflow:hidden;background:${aColor};flex:none">${photoInner}</div>
      <div>
        <div style="font-size:17px;font-weight:800">${ht.title}</div>
        <div style="font-size:11.5px;opacity:.85;margin-top:3px">${esc(ROLE_META[u.role] ? ROLE_META[u.role].label : u.role)}</div>
        <div style="font-size:11px;opacity:.75;margin-top:2px">โรงเรียนบ้านห้วยตาด</div>
      </div>
    </div>` : `
    <div style="position:relative;z-index:2;margin-top:10px">
      <div style="font-size:20px;font-weight:800">${ht.title}</div>
      <div style="font-size:12px;opacity:.85;margin-top:4px">${ht.sub}</div>
    </div>`;

  const hero = `
    <div style="background:url('https://img2.pic.in.th/BG_User.png') center/cover no-repeat;padding:18px 16px 54px;position:relative;overflow:hidden;color:#fff">
      <div style="position:absolute;inset:0;background:rgba(15,40,100,0.42)"></div>
      <div style="display:flex;justify-content:flex-end;position:relative;z-index:2">${heroRight}</div>
      ${heroBody}
    </div>`;

  // --- 3-TAB BAR (tabs 0-2 only) ---
  const TOP_TABS = [
    { icon: 'chart',       label1: 'ภาพรวม',  label2: 'การลาประจำวัน' },
    { icon: 'checkCircle', label1: 'คำขอ',    label2: 'รออนุมัติ',    badge: s.pending.length },
    { icon: 'list',        label1: 'รายงาน',  label2: 'การลา' },
  ];
  const topTabBar = _hrTab <= 2 ? `
    <div style="margin:-26px 0 0;background:#fff;border-radius:16px 16px 0 0;box-shadow:0 -4px 20px rgba(15,23,42,.08);position:relative;z-index:5">
      <div style="display:flex">
        ${TOP_TABS.map((t, i) => {
          const active = _hrTab === i;
          return `<div onclick="setHrTab(${i})" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:13px 4px 11px;cursor:pointer;border-bottom:2.5px solid ${active ? '#2563eb' : 'transparent'}">
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
  const navActive = _hrTab <= 1 ? 0 : _hrTab;
  const bottomItems = [
    { label: 'หน้าแรก', path: HOME_PATH,   action: 'setHrTab(0)', idx: 0 },
    { label: 'ขอลา',    path: CAL_ADD,     action: 'openLeaveForm()', idx: -1 },
    { label: 'ภาพรวม', path: ICONS.chart, action: 'setHrTab(2)', idx: 2 },
    { label: 'บุคลากร', path: ICONS.users, action: 'setHrTab(3)', idx: 3 },
    { label: 'เมนูอื่นๆ', path: MENU_PATH, action: 'setHrTab(4)', idx: 4 },
  ];
  const bottomNav = `
    <div style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:#fff;border-top:1px solid #f1f5f9;display:flex;z-index:100">
      ${bottomItems.map(n => {
        const active = n.idx === navActive;
        return `<div onclick="${n.action}" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 4px 8px;cursor:pointer;color:${active ? '#2563eb' : '#94a3b8'};gap:3px;position:relative">
          <div style="position:absolute;top:0;left:15%;right:15%;height:2.5px;border-radius:0 0 4px 4px;background:${active ? '#2563eb' : 'transparent'}"></div>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${n.path}</svg>
          <div style="font-size:9.5px;font-weight:600">${n.label}</div>
        </div>`;
      }).join('')}
    </div>`;

  // --- CONTENT ---
  let mainContent = '';
  const pbottom = _hrTab === 0 ? '160px' : '80px';

  if (_hrTab === 0) {
    // ---- Tab 0: ภาพรวม ----
    const totalTeachers = s.teachers.length;
    const onLeavePct = totalTeachers > 0 ? Math.round(onLeaveToday.length / totalTeachers * 100) : 0;
    const totalApproved = s.records.filter(r => r.status === 'Approved').length;

    const STAT_CARDS = [
      {
        iconPath: ICONS.users, iconColor: '#2563eb', bg: '#eff6ff',
        value: onLeaveToday.length, unit: 'คน',
        sub: `จากทั้งหมด ${totalTeachers} คน (${onLeavePct}%)`,
        onclick: ''
      },
      {
        iconPath: CLOCK_PATH, iconColor: '#b45309', bg: '#fffbeb',
        value: pendingAll.length, unit: 'รายการ',
        sub: 'ต้องดำเนินการ',
        onclick: 'setHrTab(1)'
      },
      {
        iconPath: ICONS.checkCircle, iconColor: '#15803d', bg: '#f0fdf4',
        value: approvedMonth.length, unit: 'รายการ',
        sub: `จากทั้งหมด ${totalApproved} รายการ`,
        onclick: ''
      },
      {
        iconPath: ICONS.x, iconColor: '#7c3aed', bg: '#faf5ff',
        value: rejectedCancelled.length, unit: 'รายการ',
        sub: `จากทั้งหมด ${s.records.length} รายการ`,
        onclick: ''
      },
    ];
    const statLabels = ['ลาวันนี้', 'รออนุมัติ', 'อนุมัติแล้ว (เดือนนี้)', 'ปฏิเสธ / ยกเลิก'];

    const statGrid = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        ${STAT_CARDS.map((c, i) => `
          <div ${c.onclick ? `onclick="${c.onclick}"` : ''} style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);${c.onclick ? 'cursor:pointer' : ''}">
            <div style="width:44px;height:44px;border-radius:50%;background:${c.bg};display:flex;align-items:center;justify-content:center;margin-bottom:10px">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c.iconColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${c.iconPath}</svg>
            </div>
            <div style="font-size:28px;font-weight:800;color:${c.iconColor};line-height:1">${c.value}</div>
            <div style="font-size:11px;color:#64748b;margin-top:1px">${c.unit}</div>
            <div style="font-size:10.5px;color:#94a3b8;margin-top:5px">${statLabels[i]}</div>
            <div style="font-size:10px;color:#b0bec5;margin-top:2px">${c.sub}</div>
          </div>`).join('')}
      </div>`;

    // คำขอรออนุมัติ preview (max 2)
    const pendingPreview = s.pending.slice(0, 2).map(r => {
      const from = normDate(r.start_date), to = normDate(r.end_date);
      const range = from === to ? fmtThai(from) : `${fmtShort(from)} - ${fmtThai(to)}`;
      const submittedAt = r.created_at ? _hrFmtTime(r.created_at) : '';
      return `
        <div style="background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:38px;height:38px;border-radius:50%;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex:none">${initials(r.teacher_name)}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.teacher_name)}</div>
              <div style="font-size:10.5px;color:#64748b">${esc(r.department || '')}</div>
            </div>
            <span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:${r.color_code}22;color:${r.color_code};white-space:nowrap">${esc(r.type_name)}</span>
          </div>
          <div style="font-size:11.5px;color:#475569;margin-bottom:2px">${range} (${r.total_days} วัน)</div>
          ${submittedAt ? `<div style="font-size:10.5px;color:#94a3b8;margin-bottom:10px">${submittedAt}</div>` : ''}
          <div style="display:flex;gap:8px">
            <div onclick="decideRequest('${esc(r.id)}','approve')" class="dc-hover" style="cursor:pointer;flex:1;display:flex;align-items:center;justify-content:center;gap:5px;border:1.5px solid #16a34a;color:#16a34a;padding:7px;border-radius:8px;font-size:12px;font-weight:700">
              ${svg('check', 13)} อนุมัติ
            </div>
            <div onclick="decideRequest('${esc(r.id)}','reject')" class="dc-hover" style="cursor:pointer;flex:1;display:flex;align-items:center;justify-content:center;gap:5px;border:1.5px solid #dc2626;color:#dc2626;padding:7px;border-radius:8px;font-size:12px;font-weight:700">
              ${svg('x', 13)} ปฏิเสธ
            </div>
          </div>
        </div>`;
    }).join('');

    // รายงานการลาล่าสุด
    const recentRecs = s.records
      .filter(r => r.status !== 'Pending_HR' && r.status !== 'Pending_Director')
      .sort((a, b) => normDate(b.start_date).localeCompare(normDate(a.start_date)))
      .slice(0, 3);

    const recentRows = recentRecs.map(r => {
      const sm = statusMeta(r.status);
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9">
          <div style="width:36px;height:36px;border-radius:50%;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;flex:none">${initials(r.teacher_name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.teacher_name)}</div>
            <div style="font-size:11px;color:${r.color_code || '#64748b'};font-weight:600">${esc(r.type_name)} · ${fmtShort(normDate(r.start_date))} (${r.total_days} วัน)</div>
          </div>
          <span style="font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:6px;background:${sm.bg};color:${sm.color};white-space:nowrap;flex:none">${sm.label}</span>
        </div>`;
    }).join('');

    mainContent = `
      <div style="font-size:13px;font-weight:700;color:#64748b;margin-bottom:10px">ภาพรวมการลาประจำวัน <span style="float:right;font-size:11.5px;font-weight:500">${fmtThai(today)}</span></div>
      ${statGrid}
      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:14px;font-weight:800">คำขอรออนุมัติ</span>
            ${s.pending.length ? `<div style="min-width:20px;height:20px;background:#ef4444;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;padding:0 4px">${s.pending.length}</div>` : ''}
          </div>
          ${s.pending.length > 2 ? `<div onclick="setHrTab(1)" style="cursor:pointer;font-size:12px;font-weight:700;color:#2563eb;display:flex;align-items:center;gap:2px">ดูทั้งหมด ${svg('chevronRight', 13)}</div>` : ''}
        </div>
        ${s.pending.length ? pendingPreview : '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px">ไม่มีคำขอรออนุมัติ</div>'}
      </div>
      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:14px;font-weight:800">รายงานการลาล่าสุด</span>
          <div onclick="setHrTab(2)" style="cursor:pointer;font-size:12px;font-weight:700;color:#2563eb;display:flex;align-items:center;gap:2px">ดูทั้งหมด ${svg('chevronRight', 13)}</div>
        </div>
        ${recentRows || '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px">ยังไม่มีข้อมูล</div>'}
      </div>`;

  } else if (_hrTab === 1) {
    // ---- Tab 1: คำขอรออนุมัติ ----
    const typeMap = {};
    s.pending.forEach(r => { typeMap[r.leave_type_id] = r.type_name; });
    const pendingTypes = Object.entries(typeMap).map(([id, name]) => ({ id, name }));
    const typeCounts = {};
    s.pending.forEach(r => { typeCounts[r.leave_type_id] = (typeCounts[r.leave_type_id] || 0) + 1; });

    let filtered = s.pending.slice();
    if (_hrSearch) {
      const q = _hrSearch.toLowerCase();
      filtered = filtered.filter(r =>
        (r.teacher_name || '').toLowerCase().includes(q) ||
        (r.type_name || '').toLowerCase().includes(q)
      );
    }
    if (_hrTypeChip !== 'all') {
      filtered = filtered.filter(r => String(r.leave_type_id) === String(_hrTypeChip));
    }

    const chip = (label, val, count) => {
      const active = _hrTypeChip === val;
      return `<div onclick="setHrTypeChip('${esc(val)}')" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;background:${active ? '#2563eb' : '#f1f5f9'};color:${active ? '#fff' : '#64748b'}">${esc(label)} <span style="font-size:10px;opacity:.85">${count}</span></div>`;
    };
    const chips = `
      <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
        ${chip('ทั้งหมด', 'all', s.pending.length)}
        ${pendingTypes.map(t => chip(t.name, t.id, typeCounts[t.id] || 0)).join('')}
      </div>`;

    const pendingCards = filtered.map(r => {
      const from = normDate(r.start_date), to = normDate(r.end_date);
      const range = from === to ? fmtThai(from) : `${fmtShort(from)} - ${fmtThai(to)}`;
      const submittedAt = r.created_at ? _hrFmtTime(r.created_at) : '';
      const attach = r.attachment_url ? `<a href="${esc(r.attachment_url)}" target="_blank" style="color:#2563eb;font-size:11px;display:inline-flex;align-items:center;gap:3px">${svg('paperclip', 11)} เอกสารแนบ</a>` : '';
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
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
    }).join('');

    mainContent = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div style="flex:1;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:0 12px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SEARCH_PATH}</svg>
          <input oninput="setHrSearch(this.value)" value="${esc(_hrSearch)}" placeholder="ค้นหาชื่อ, ประเภทการลา..." style="flex:1;border:none;outline:none;font-size:13px;padding:10px 0;background:transparent">
        </div>
        <div style="display:flex;align-items:center;gap:5px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;cursor:pointer;font-size:13px;font-weight:600;color:#334155;white-space:nowrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${FILTER_PATH}</svg> ตัวกรอง
        </div>
      </div>
      <div style="margin-bottom:14px">${chips}</div>
      ${filtered.length
        ? `<div style="display:flex;flex-direction:column;gap:12px">${pendingCards}</div>
           <div style="text-align:center;font-size:11.5px;color:#94a3b8;margin-top:14px;padding-bottom:4px">แสดง ${filtered.length} จาก ${s.pending.length} รายการ</div>`
        : `<div style="background:#fff;border-radius:16px;padding:48px;text-align:center;color:#94a3b8;font-size:13px;box-shadow:0 2px 10px rgba(15,23,42,.06)">ไม่มีคำขอรออนุมัติ</div>`}`;

  } else if (_hrTab === 2) {
    // ---- Tab 2: รายงานการลา ----
    let rows = s.records.slice();
    if (hrFilters.dateFrom) rows = rows.filter(r => normDate(r.end_date) >= hrFilters.dateFrom);
    if (hrFilters.dateTo)   rows = rows.filter(r => normDate(r.start_date) <= hrFilters.dateTo);
    if (hrFilters.dept !== 'all') rows = rows.filter(r => r.department === hrFilters.dept);
    if (hrFilters.type !== 'all') rows = rows.filter(r => r.leave_type_id == hrFilters.type);
    rows.sort((a, b) => normDate(b.start_date).localeCompare(normDate(a.start_date)));

    const uniqueTeachers = new Set(rows.map(r => r.teacher_id)).size;
    const totalDays = rows.reduce((sum, r) => sum + (Number(r.total_days) || 0), 0);
    const avgPerPerson = uniqueTeachers > 0 ? (totalDays / uniqueTeachers).toFixed(2) : '0';

    // Donut chart
    const typeAgg = {};
    rows.forEach(r => {
      const id = r.leave_type_id;
      if (!typeAgg[id]) typeAgg[id] = { id, name: r.type_name || typeName(id), color: r.color_code || typeColor(id), days: 0, count: 0 };
      typeAgg[id].days += Number(r.total_days) || 0;
      typeAgg[id].count++;
    });
    const types = Object.values(typeAgg).sort((a, b) => b.days - a.days);
    let ang = 0;
    const donutGrad = types.length
      ? types.map(t => {
          const deg = totalDays > 0 ? t.days / totalDays * 360 : 0;
          const chunk = `${t.color} ${ang.toFixed(1)}deg ${(ang + deg).toFixed(1)}deg`;
          ang += deg; return chunk;
        }).join(',')
      : '#e2e8f0 0deg 360deg';

    // Per-person aggregate
    const personAgg = {};
    rows.forEach(r => {
      if (!personAgg[r.teacher_id]) personAgg[r.teacher_id] = { id: r.teacher_id, name: r.teacher_name, dept: r.department, position: r.position, count: 0, days: 0 };
      personAgg[r.teacher_id].count++;
      personAgg[r.teacher_id].days += Number(r.total_days) || 0;
    });
    const persons = Object.values(personAgg).sort((a, b) => b.days - a.days);

    const typeOpts = ['all', ...leaveTypes.map(t => t.id)]
      .map(id => `<option value="${esc(id)}" ${hrFilters.type == id ? 'selected' : ''}>${id === 'all' ? 'ทุกประเภทการลา' : esc(typeName(id))}</option>`).join('');

    const dateLabel = (hrFilters.dateFrom || hrFilters.dateTo)
      ? `${hrFilters.dateFrom ? fmtShort(hrFilters.dateFrom) : '...'} - ${hrFilters.dateTo ? fmtShort(hrFilters.dateTo) : '...'}`
      : 'ทั้งหมด';

    const personList = persons.map(p => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9">
        <div style="width:38px;height:38px;border-radius:50%;background:${avatarColor(p.id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex:none">${initials(p.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
          <div style="font-size:11px;color:#64748b">${esc(p.position || 'ครู')} · ${esc(p.dept || '')}</div>
        </div>
        <div style="text-align:right;flex:none">
          <div style="font-size:12px;font-weight:700;color:#334155">${p.count} รายการ</div>
          <div style="font-size:11px;color:#64748b">${p.days} วัน</div>
        </div>
        <span style="color:#cbd5e1">${svg('chevronRight', 13)}</span>
      </div>`).join('');

    const typeList = types.map(t => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9">
        <div style="width:36px;height:36px;border-radius:50%;background:${t.color}22;display:flex;align-items:center;justify-content:center;flex:none">
          <div style="width:14px;height:14px;border-radius:50%;background:${t.color}"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:700">${esc(t.name)}</div>
          <div style="font-size:11px;color:#94a3b8">${totalDays > 0 ? Math.round(t.days / totalDays * 100) : 0}% ของทั้งหมด</div>
        </div>
        <div style="text-align:right;flex:none">
          <div style="font-size:12px;font-weight:700;color:#334155">${t.count} รายการ</div>
          <div style="font-size:11px;color:#64748b">${t.days} วัน</div>
        </div>
      </div>`).join('');

    // Individual record list with print button for approved
    const recordList = rows.map(r => {
      const sm = statusMeta(r.status);
      const from = normDate(r.start_date), to = normDate(r.end_date);
      const range = from === to ? fmtShort(from) : `${fmtShort(from)} - ${fmtShort(to)}`;
      const printBtn = r.status === 'Approved'
        ? `<div onclick="printLeaveFormHr('${esc(r.id)}')" class="dc-hover" title="ออกใบลา" style="cursor:pointer;width:32px;height:32px;border-radius:8px;border:1px solid #2563eb;display:flex;align-items:center;justify-content:center;color:#2563eb;flex:none">${svg('download', 14)}</div>`
        : `<div style="width:32px;height:32px;flex:none"></div>`;
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9">
          <div style="width:36px;height:36px;border-radius:50%;background:${avatarColor(r.teacher_id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;flex:none">${initials(r.teacher_name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.teacher_name)}</div>
            <div style="font-size:11px;color:${r.color_code || '#64748b'};font-weight:600">${esc(r.type_name)} · ${range} (${r.total_days} วัน)</div>
          </div>
          <span style="font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:6px;background:${sm.bg};color:${sm.color};white-space:nowrap;flex:none">${sm.label}</span>
          ${printBtn}
        </div>`;
    }).join('');

    mainContent = `
      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px">เลือกช่วงวันที่</div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end;margin-bottom:10px">
          <div>
            <div style="font-size:10.5px;color:#94a3b8;margin-bottom:4px">เริ่มต้น</div>
            <input type="date" value="${hrFilters.dateFrom}" onchange="setHrFilter('dateFrom',this.value)"
              style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box">
          </div>
          <div style="font-size:12px;color:#94a3b8;padding-bottom:10px">ถึง</div>
          <div>
            <div style="font-size:10.5px;color:#94a3b8;margin-bottom:4px">สิ้นสุด</div>
            <input type="date" value="${hrFilters.dateTo}" onchange="setHrFilter('dateTo',this.value)"
              style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box">
          </div>
        </div>
        <select onchange="setHrFilter('type',this.value)" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px">${typeOpts}</select>
        ${(hrFilters.dateFrom || hrFilters.dateTo || hrFilters.type !== 'all')
          ? `<div onclick="setHrFilter('dateFrom','');setHrFilter('dateTo','');setHrFilter('type','all')" style="margin-top:8px;text-align:center;font-size:11.5px;font-weight:600;color:#2563eb;cursor:pointer">ล้างตัวกรอง</div>`
          : ''}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;background:#f1f5f9;border-radius:8px;padding:3px;gap:2px">
          <div onclick="setHrReportView('person')" style="padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;${_hrReportView === 'person' ? 'background:#fff;color:#2563eb;box-shadow:0 1px 4px rgba(0,0,0,.1)' : 'color:#64748b'}">บุคคล</div>
          <div onclick="setHrReportView('type')" style="padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;${_hrReportView === 'type' ? 'background:#fff;color:#2563eb;box-shadow:0 1px 4px rgba(0,0,0,.1)' : 'color:#64748b'}">ประเภทการลา</div>
        </div>
        <div onclick="exportCsv()" style="display:flex;align-items:center;gap:5px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;color:#334155;cursor:pointer">
          ${svg('download', 13)} Export
        </div>
      </div>

      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:12px">
        <div style="font-size:13px;font-weight:800;margin-bottom:12px">สรุปภาพรวม <span style="font-size:11px;color:#94a3b8;font-weight:400">(${dateLabel})</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:#eff6ff;border-radius:12px;padding:12px">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px">${ICONS.users}</svg>
            <div style="font-size:24px;font-weight:800;color:#2563eb;line-height:1">${uniqueTeachers}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">คน</div>
            <div style="font-size:10.5px;color:#94a3b8;margin-top:4px">จำนวนผู้ลา</div>
          </div>
          <div style="background:#f0fdf4;border-radius:12px;padding:12px">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
            <div style="font-size:24px;font-weight:800;color:#059669;line-height:1">${rows.length}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">รายการ</div>
            <div style="font-size:10.5px;color:#94a3b8;margin-top:4px">จำนวนรายการลา</div>
          </div>
          <div style="background:#fffbeb;border-radius:12px;padding:12px">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px">${CLOCK_PATH}</svg>
            <div style="font-size:24px;font-weight:800;color:#b45309;line-height:1">${totalDays}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">วัน</div>
            <div style="font-size:10.5px;color:#94a3b8;margin-top:4px">รวมวันลา</div>
          </div>
          <div style="background:#faf5ff;border-radius:12px;padding:12px">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <div style="font-size:24px;font-weight:800;color:#7c3aed;line-height:1">${avgPerPerson}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">วัน</div>
            <div style="font-size:10.5px;color:#94a3b8;margin-top:4px">เฉลี่ยต่อคน</div>
          </div>
        </div>
      </div>

      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:12px">
        <div style="font-size:13px;font-weight:800;margin-bottom:12px">สถิติการลาตามประเภท</div>
        <div style="display:flex;gap:14px;align-items:center">
          <div style="position:relative;width:100px;height:100px;border-radius:50%;background:conic-gradient(${donutGrad});display:flex;align-items:center;justify-content:center;flex:none">
            <div style="width:66px;height:66px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-size:9px;color:#64748b">รวม</div>
              <div style="font-size:18px;font-weight:800;line-height:1">${totalDays}</div>
              <div style="font-size:9px;color:#64748b">วัน</div>
            </div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px">
            ${types.map(t => `
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:8px;height:8px;border-radius:50%;background:${t.color};flex:none"></div>
                <div style="flex:1;font-size:11px;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name)}</div>
                <div style="font-size:11px;color:#64748b;white-space:nowrap">${t.days}วัน (${totalDays > 0 ? Math.round(t.days / totalDays * 100) : 0}%)</div>
              </div>`).join('') || '<div style="font-size:11px;color:#94a3b8">ไม่มีข้อมูล</div>'}
          </div>
        </div>
      </div>

      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:12px">
        <div style="font-size:13px;font-weight:800;margin-bottom:2px">
          ${_hrReportView === 'person' ? 'รายงานการลารายบุคคล' : 'รายงานการลาตามประเภท'}
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:10px">${rows.length} รายการ</div>
        ${_hrReportView === 'person'
          ? (personList || '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px">ไม่พบข้อมูล</div>')
          : (typeList   || '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px">ไม่พบข้อมูล</div>')}
      </div>

      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:13px;font-weight:800">รายการทั้งหมด</div>
          <div style="font-size:11px;color:#94a3b8">${svg('download',11)} = ออกใบลา</div>
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:10px">${rows.length} รายการ · เรียงจากล่าสุด</div>
        ${recordList || '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px">ไม่พบข้อมูล</div>'}
      </div>`;

  } else if (_hrTab === 3) {
    // ---- Tab 3: บุคลากร ----
    const teacherCards = s.teachers.map(t => {
      const rm = ROLE_META[t.role] || { label: t.role, bg: '#f1f5f9', color: '#64748b' };
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(15,23,42,.05)">
          <div style="width:44px;height:44px;border-radius:50%;background:${avatarColor(t.id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#fff;flex:none">${initials(t.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700">${esc(t.prefix || '')}${esc(t.name)} ${esc(t.surname || '')}</div>
            <div style="font-size:11.5px;color:#64748b">${esc(t.position || 'ครู')} · ${esc(t.department || '-')}</div>
          </div>
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:${rm.bg};color:${rm.color};white-space:nowrap;flex:none">${rm.label}</span>
        </div>`;
    }).join('');

    mainContent = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <div style="font-size:16px;font-weight:800">บุคลากรทั้งหมด</div>
          <div style="font-size:12px;color:#64748b">${s.teachers.length} คน</div>
        </div>
        <div onclick="openOnBehalf()" style="cursor:pointer;background:#2563eb;color:#fff;padding:9px 14px;border-radius:10px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:5px">
          ${svg('plus', 14)} สร้างใบลาแทน
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">${teacherCards}</div>`;

  } else {
    // ---- Tab 4: เมนูอื่นๆ ----
    const fullName2 = `${u.prefix || ''}${u.name} ${u.surname || ''}`.trim();
    const MENU_ITEMS = [
      { label: 'ยื่นใบลาของฉัน',   icon: 'calendar', bg: '#eff6ff', color: '#2563eb', action: 'openLeaveForm()' },
      { label: 'สร้างใบลาแทนครู', icon: 'users',    bg: '#f0fdf4', color: '#15803d', action: 'openOnBehalf()' },
      { label: 'Export รายงาน CSV', icon: 'download', bg: '#fffbeb', color: '#b45309', action: 'exportCsv()' },
    ];
    mainContent = `
      <div style="background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:50%;background:${avatarColor(u.id)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff;flex:none">${initials(u.name)}</div>
          <div>
            <div style="font-size:14px;font-weight:800">${esc(fullName2)}</div>
            <div style="font-size:12px;color:#64748b">${esc(ROLE_META[u.role] ? ROLE_META[u.role].label : u.role)}</div>
          </div>
        </div>
      </div>
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);overflow:hidden;margin-bottom:12px">
        ${MENU_ITEMS.map((m, i) => `
          <div onclick="${m.action}" class="dc-hover" style="display:flex;align-items:center;gap:12px;padding:14px 16px;${i < MENU_ITEMS.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}cursor:pointer">
            <div style="width:36px;height:36px;border-radius:10px;background:${m.bg};display:flex;align-items:center;justify-content:center;flex:none;color:${m.color}">${svg(m.icon, 16)}</div>
            <div style="flex:1;font-size:13.5px;font-weight:600">${m.label}</div>
            ${svg('chevronRight', 14)}
          </div>`).join('')}
      </div>
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);overflow:hidden">
        <div onclick="logout()" class="dc-hover" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer">
          <div style="width:36px;height:36px;border-radius:10px;background:#fef2f2;display:flex;align-items:center;justify-content:center;flex:none;color:#b91c1c">${svg('logout', 16)}</div>
          <div style="flex:1;font-size:13.5px;font-weight:600;color:#b91c1c">ออกจากระบบ</div>
          ${svg('chevronRight', 14)}
        </div>
      </div>`;
  }

  // Leave request button (tab 0 only, above bottom nav)
  const reqBtn = _hrTab === 0 ? `
    <div onclick="openLeaveForm()" style="position:fixed;bottom:66px;left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:398px;background:#2563eb;color:#fff;padding:14px;border-radius:14px;font-size:15px;font-weight:800;text-align:center;cursor:pointer;z-index:50;box-shadow:0 8px 24px rgba(37,99,235,.4);display:flex;align-items:center;justify-content:center;gap:8px">
      ${svg('plus', 18, 2.5)} ขอลา
    </div>` : '';

  document.getElementById('view-hr').innerHTML = `
    <div style="width:100%;min-height:100vh;display:flex;justify-content:center;background:#f8fafc">
      <div style="width:100%;max-width:430px;background:#f8fafc;min-height:100vh;position:relative">
        ${hero}
        ${topTabBar}
        <div style="padding:16px 14px ${pbottom}">
          ${mainContent}
        </div>
        ${reqBtn}
        ${bottomNav}
      </div>
    </div>`;
}

// --- Helper: format submitted time ---
function _hrFmtTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `ยื่นเมื่อ ${fmtShort(toISO(d.getFullYear(), d.getMonth(), d.getDate()))} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} น.`;
}

// --- Filter + sort (used by tab 2) ---
window.setHrFilter = (k, v) => { hrFilters[k] = v; renderHr(); };
window.sortHr = (field) => {
  if (hrSort.field === field) hrSort.dir = hrSort.dir === 'asc' ? 'desc' : 'asc';
  else { hrSort.field = field; hrSort.dir = 'asc'; }
  renderHr();
};

// --- Export CSV ---
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

// --- On-behalf leave modal ---
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
