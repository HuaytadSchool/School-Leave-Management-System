// ===========================================================================
// teacher.js — Teacher portal
// ===========================================================================

let _teacherData = { quotas: [], history: [] };
let _calYear = 0, _calMonth = 0, _calFilter = '', _calShown = 10;
let _statsAcadYear = 0;

async function loadTeacher() {
  const [quotas, history] = await Promise.all([
    api.getLeaveQuotas(currentUser.id),
    api.getLeaveHistory(currentUser.id)
  ]);
  _teacherData = { quotas, history };
  renderTeacher(quotas, history);
}

window.switchTeacherTab = (tab) => {
  ['home', 'calendar', 'stats'].forEach(t => {
    const el = document.getElementById('tt-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('[data-tabn]').forEach(el => {
    const active = el.dataset.tabn === tab;
    el.style.color = active ? '#2563eb' : '#94a3b8';
    el.querySelector('.tabn-bar').style.background = active ? '#2563eb' : 'transparent';
  });
  if (tab === 'calendar') renderCalendarTab(_calFilter);
  if (tab === 'stats')    renderStatsTab();
};


function _timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return 'เมื่อกี้';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  if (hrs < 24)  return `${hrs} ชั่วโมงที่แล้ว`;
  if (days === 1) return 'เมื่อวาน';
  return `${days} วันที่แล้ว`;
}

window.markAllNotiRead = () => {
  const ids = (_teacherData.history || []).map(r => r.id);
  localStorage.setItem('noti_read_' + currentUser.id, JSON.stringify(ids));
  const badge = document.getElementById('noti-badge');
  if (badge) badge.style.display = 'none';
  document.querySelectorAll('.noti-dot').forEach(d => { d.style.background = '#cbd5e1'; });
};

window.openNotifications = () => {
  const history = _teacherData.history || [];
  const sorted  = history.slice().sort((a, b) => normDate(b.start_date).localeCompare(normDate(a.start_date)));
  const readIds = new Set(JSON.parse(localStorage.getItem('noti_read_' + currentUser.id) || '[]'));

  const CLOCK_PATH = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
  const XCIRC_PATH = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
  const GEAR_PATH  = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';

  function notiMeta(r) {
    const name = esc(r.type_name || typeName(r.leave_type_id));
    if (isPending(r.status)) return {
      title: `คำขอ${name} รอการอนุมัติ`,
      desc: `คำขอวันที่ ${fmtShort(normDate(r.start_date))} - ${fmtThai(normDate(r.end_date))}<br>รอการอนุมัติจากผู้บริหาร`,
      iconPath: CLOCK_PATH, iconBg: '#fff7ed', iconColor: '#f59e0b'
    };
    if (r.status === 'Approved') return {
      title: `อนุมัติการลา${name}`,
      desc: `คำขอวันที่ ${fmtThai(normDate(r.start_date))} ได้รับการอนุมัติแล้ว<br>โดย ผู้อำนวยการโรงเรียน`,
      iconPath: ICONS.checkCircle, iconBg: '#f0fdf4', iconColor: '#16a34a'
    };
    if (r.status === 'Rejected') return {
      title: `ไม่อนุมัติการลา${name}`,
      desc: `คำขอวันที่ ${fmtThai(normDate(r.start_date))} ไม่ได้รับการอนุมัติ`,
      iconPath: XCIRC_PATH, iconBg: '#fef2f2', iconColor: '#dc2626'
    };
    return {
      title: `ยกเลิกคำขอ${name}`,
      desc: `ยกเลิกคำขอวันที่ ${fmtThai(normDate(r.start_date))}`,
      iconPath: XCIRC_PATH, iconBg: '#f1f5f9', iconColor: '#94a3b8'
    };
  }

  const items = sorted.map(r => {
    const isRead = readIds.has(r.id);
    const m = notiMeta(r);
    const time = _timeAgo(r.created_at);
    return `
      <div style="display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid #f8fafc;align-items:flex-start">
        <div style="width:44px;height:44px;border-radius:50%;background:${m.iconBg};flex:none;display:flex;align-items:center;justify-content:center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${m.iconColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${m.iconPath}</svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:3px">${m.title}</div>
          <div style="font-size:11.5px;color:#64748b;line-height:1.55">${m.desc}</div>
          ${time ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:4px">${time}</div>` : ''}
        </div>
        <div class="noti-dot" style="width:9px;height:9px;border-radius:50%;background:${isRead?'#cbd5e1':'#ef4444'};flex:none;margin-top:5px"></div>
      </div>`;
  }).join('') || `<div style="font-size:13px;color:#94a3b8;padding:32px;text-align:center">ไม่มีการแจ้งเตือน</div>`;

  document.getElementById('modal-root').innerHTML = `
    <div onclick="closeModal()" style="position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:500">
      <div onclick="event.stopPropagation()" style="position:fixed;top:70px;left:50%;transform:translateX(-50%);width:calc(100% - 20px);max-width:410px;background:#fff;border-radius:16px;max-height:calc(100vh - 90px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.22);overflow:hidden">
        <div style="position:absolute;top:-7px;right:22px;width:14px;height:14px;background:#fff;transform:rotate(45deg);border-radius:2px 0 0 0;box-shadow:-3px -3px 6px rgba(0,0,0,0.06)"></div>
        <div style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid #f1f5f9;gap:8px;flex:none">
          <div style="font-size:15px;font-weight:800;flex:1">การแจ้งเตือน</div>
          <div onclick="markAllNotiRead()" style="font-size:11.5px;font-weight:600;color:#2563eb;cursor:pointer;white-space:nowrap">ทำเครื่องหมายว่าอ่านทั้งหมด</div>
          <div onclick="logout()" style="cursor:pointer;display:inline-flex;padding:3px;color:#64748b">
            ${svg('logout', 16)}
          </div>
        </div>
        <div style="overflow-y:auto;flex:1">${items}</div>
        <div onclick="closeModal()" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:13px;border-top:1px solid #f1f5f9;font-size:13px;font-weight:700;color:#2563eb;cursor:pointer;flex:none">
          ดูการแจ้งเตือนทั้งหมด ${svg('chevronRight', 14)}
        </div>
      </div>
    </div>`;
};

// ── Fiscal year helpers (Oct 1 – Sep 30) ──
function currentAcadYear() {
  const d = new Date(), ty = d.getFullYear() + 543;
  return d.getMonth() >= 9 ? ty + 1 : ty;
}
function acadYearRange(ty) {
  const ce = ty - 543;
  return { start: `${ce - 1}-10-01`, end: `${ce}-09-30` };
}

// ── Calendar tab ──
window.calNav = (dir) => {
  _calMonth += dir;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  renderCalendarTab(_calFilter);
};
window.calToday = () => {
  const d = new Date(); _calYear = d.getFullYear(); _calMonth = d.getMonth();
  renderCalendarTab(_calFilter);
};
window.renderCalendarTab = (filterType = '') => {
  if (!_calYear) { const d = new Date(); _calYear = d.getFullYear(); _calMonth = d.getMonth(); }
  if (String(filterType || '') !== _calFilter) _calShown = 10; // reset paging when filter changes
  _calFilter = String(filterType || '');
  const el = document.getElementById('tt-calendar');
  if (!el) return;
  const history = _teacherData.history || [];
  const year = _calYear, month = _calMonth;
  const today = todayISO();

  // date -> first active leave record
  const dateLeaves = {};
  for (const r of history) {
    if (r.status === 'Cancelled') continue;
    const cur = parseISO(normDate(r.start_date)), end = parseISO(normDate(r.end_date));
    while (cur <= end) {
      const iso = toISO(cur.getFullYear(), cur.getMonth(), cur.getDate());
      if (!dateLeaves[iso]) dateLeaves[iso] = r;
      cur.setDate(cur.getDate() + 1);
    }
  }

  // calendar grid
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays    = new Date(year, month, 0).getDate();
  const dayHdrs = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'].map((d,i) =>
    `<div style="text-align:center;font-size:11px;font-weight:700;padding:4px 0;color:${i===0||i===6?'#ef4444':'#64748b'}">${d}</div>`
  ).join('');
  let cells = '';
  for (let i = firstDay - 1; i >= 0; i--)
    cells += `<div style="text-align:center;font-size:12px;color:#cbd5e1;padding:4px 0">${prevDays - i}</div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(year, month, d);
    const dow = new Date(year, month, d).getDay();
    const r   = dateLeaves[iso];
    const dot = r ? (r.color_code || typeColor(r.leave_type_id)) : '';
    const isToday = iso === today;
    const bg = isToday ? '#dcfce7' : r ? `${dot}22` : (dow===0||dow===6) ? '#fef2f2' : '';
    cells += `<div style="text-align:center;font-size:12.5px;border-radius:8px;padding:4px 1px;${bg?`background:${bg}`:''};${isToday?'color:#16a34a;font-weight:700':''}">
      ${d}<div style="height:5px;display:flex;justify-content:center;margin-top:1px">${dot?`<div style="width:5px;height:5px;border-radius:50%;background:${dot}"></div>`:''}</div>
    </div>`;
  }
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for (let i = 1; i <= totalCells - firstDay - daysInMonth; i++)
    cells += `<div style="text-align:center;font-size:12px;color:#cbd5e1;padding:4px 0">${i}</div>`;

  // legend (unique types, preserve insertion order)
  const seen = new Map();
  for (const r of history)
    if (r.status !== 'Cancelled' && !seen.has(r.leave_type_id))
      seen.set(r.leave_type_id, { id: r.leave_type_id, name: r.type_name||typeName(r.leave_type_id), color: r.color_code||typeColor(r.leave_type_id) });
  const legendItems = [...seen.values()];
  const legend = legendItems.map(t =>
    `<div style="display:flex;align-items:center;gap:5px;font-size:11.5px"><div style="width:8px;height:8px;border-radius:50%;background:${t.color}"></div>${esc(t.name)}</div>`
  ).join('');

  // leave list with filter
  const sorted   = history.slice().sort((a,b) => normDate(b.start_date).localeCompare(normDate(a.start_date)));
  const filtered = _calFilter ? sorted.filter(r => String(r.leave_type_id) === _calFilter) : sorted;
  const typeOpts = `<option value="" ${!_calFilter?'selected':''}>ทั้งหมด</option>` +
    legendItems.map(t => `<option value="${t.id}" ${_calFilter===String(t.id)?'selected':''}>${esc(t.name)}</option>`).join('');
  const UP  = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
  const SP  = '<line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>';
  const CHEV = '<polyline points="9 18 15 12 9 6"/>';
  const FILTER_ICO = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`;
  const shown = filtered.slice(0, _calShown);
  const listRows = shown.map(r => {
    const ic = r.color_code || typeColor(r.leave_type_id);
    const sm = statusMeta(r.status);
    const from = normDate(r.start_date), to = normDate(r.end_date);
    const range = (from === to ? fmtThai(from) : `${fmtShort(from)} – ${fmtThai(to)}`) + (r.half_day ? ` (${halfDayLabel(r.half_day)})` : '');
    const isSick = /ป่วย/.test(r.type_name || '');
    return `<div style="background:#fff;border:1px solid #f1f5f9;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center">
      <div style="width:44px;height:44px;border-radius:50%;background:${ic};flex:none;display:flex;align-items:center;justify-content:center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${isSick?SP:UP}</svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">${esc(r.type_name||typeName(r.leave_type_id))}</div>
        <div style="font-size:11.5px;color:#64748b">${range} · ${r.total_days} วัน</div>
        <div style="font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.reason||'')}</div>
      </div>
      <div style="font-size:10.5px;font-weight:700;color:${sm.color};background:${sm.bg};padding:3px 8px;border-radius:6px;white-space:nowrap;flex:none">${sm.label}</div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${CHEV}</svg>
    </div>`;
  }).join('') || `<div style="font-size:13px;color:#94a3b8;padding:24px;text-align:center">ไม่มีรายการลา</div>`;
  const moreBtn = filtered.length > _calShown
    ? `<div onclick="calShowMore()" style="text-align:center;font-size:13px;font-weight:700;color:#2563eb;background:#eff6ff;border-radius:12px;padding:12px;cursor:pointer">ดูเพิ่มเติม (${filtered.length - _calShown})</div>`
    : '';

  el.innerHTML = `
    <div style="padding:16px 14px 140px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="display:flex;align-items:center;gap:8px">${svg('calendar',18)}<div style="font-size:16px;font-weight:800">ปฏิทินการลา</div></div>
          <div style="font-size:11.5px;color:#94a3b8;margin-top:2px">ดูปฏิทินภาพรวมการลาทั้งหมดของคุณ</div>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          <div onclick="calToday()" style="font-size:12px;font-weight:600;padding:5px 10px;border:1.5px solid #2563eb;border-radius:8px;color:#2563eb;cursor:pointer">วันนี้</div>
          <div onclick="calNav(-1)" style="width:30px;height:30px;border:1.5px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b">${svg('chevronLeft',14)}</div>
          <div onclick="calNav(1)" style="width:30px;height:30px;border:1.5px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b">${svg('chevronRight',14)}</div>
        </div>
      </div>
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(15,23,42,.06);padding:14px;margin-bottom:14px">
        <div style="text-align:center;font-size:15px;font-weight:800;margin-bottom:10px">${THAI_MONTHS_FULL[month]} ${year+543}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${dayHdrs}${cells}</div>
        ${legend ? `<div style="display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:12px;padding-top:10px;border-top:1px solid #f8fafc">${legend}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:14px;font-weight:800">รายการลาของคุณ</div>
        <div style="display:flex;align-items:center;gap:5px">
          ${FILTER_ICO}
          <select onchange="renderCalendarTab(this.value)" style="font-size:12px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;color:#334155;background:#fff;cursor:pointer">${typeOpts}</select>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">${listRows}${moreBtn}</div>
    </div>`;
};
window.calShowMore = () => { _calShown += 10; renderCalendarTab(_calFilter); };

// ── Stats tab ──
window.statsSelectYear = (y) => { _statsAcadYear = y; closeModal(); renderStatsTab(); };
window.statsSetYear = () => {
  const curr = currentAcadYear();
  document.getElementById('modal-root').innerHTML = `
    <div onclick="closeModal()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:500">
      <div onclick="event.stopPropagation()" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:220px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.2)">
        <div style="padding:14px 16px;font-size:14px;font-weight:800;border-bottom:1px solid #f1f5f9">เลือกปีงบประมาณ</div>
        ${[curr,curr-1,curr-2].map(y => `<div onclick="statsSelectYear(${y})" style="padding:12px 16px;font-size:14px;cursor:pointer;font-weight:${y===_statsAcadYear?800:400};color:${y===_statsAcadYear?'#2563eb':'#334155'};border-bottom:1px solid #f8fafc">${y}</div>`).join('')}
      </div>
    </div>`;
};
window.renderStatsTab = () => {
  if (!_statsAcadYear) _statsAcadYear = currentAcadYear();
  const el = document.getElementById('tt-stats');
  if (!el) return;
  const { start, end } = acadYearRange(_statsAcadYear);
  const history = (_teacherData.history || []).filter(r => {
    const d = normDate(r.start_date);
    return d >= start && d <= end && r.status !== 'Cancelled';
  });

  // per-type aggregation
  const typeMap = {};
  for (const r of history) {
    const id = r.leave_type_id;
    if (!typeMap[id]) typeMap[id] = { id, name: r.type_name||typeName(id), color: r.color_code||typeColor(id), days:0, count:0 };
    typeMap[id].days  += Number(r.total_days)||0;
    typeMap[id].count++;
  }
  const types     = Object.values(typeMap).sort((a,b) => b.days - a.days);
  const totalDays = types.reduce((s,t) => s + t.days, 0);

  // quotas
  const quotas     = _teacherData.quotas || [];
  const totalQuota = quotas.reduce((s,q) => s + (Number(q.max_days)||0), 0);
  const remaining  = Math.max(0, totalQuota - totalDays);
  const usedPct    = totalQuota > 0 ? Math.min(100, Math.round(totalDays/totalQuota*100)) : 0;

  // monthly aggregation
  const monthMap = {};
  for (const r of history) {
    const ym = normDate(r.start_date).slice(0,7);
    if (!monthMap[ym]) monthMap[ym] = { total:0, byType:{} };
    monthMap[ym].total += Number(r.total_days)||0;
    const id = r.leave_type_id;
    monthMap[ym].byType[id] = (monthMap[ym].byType[id]||0) + (Number(r.total_days)||0);
  }
  const months  = Object.keys(monthMap).sort();
  const maxDays = Math.max(...months.map(m => monthMap[m].total), 1);

  // donut
  let ang = 0;
  const donutGrad = types.length
    ? types.map(t => {
        const deg = totalDays > 0 ? t.days/totalDays*360 : 0;
        const chunk = `${t.color} ${ang.toFixed(1)}deg ${(ang+deg).toFixed(1)}deg`;
        ang += deg; return chunk;
      }).join(',')
    : '#e2e8f0 0deg 360deg';

  // summary cards (total + up to 3 types)
  const typeCards = types.slice(0,3).map(t => `
    <div style="background:${t.color}12;border:1px solid ${t.color}30;border-radius:14px;padding:12px">
      <div style="font-size:10.5px;font-weight:700;color:${t.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name)}</div>
      <div style="font-size:24px;font-weight:800;line-height:1.1;margin:4px 0">${t.days} <span style="font-size:11px;color:#64748b;font-weight:500">วัน</span></div>
      <div style="font-size:10.5px;color:#94a3b8">${t.count} ครั้ง</div>
    </div>`).join('');

  // bar chart
  const barCols = months.map(m => {
    const d = parseISO(m+'-01');
    const val = monthMap[m].total;
    const h = Math.max(4, Math.round(val/maxDays*72));
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;justify-content:flex-end">
      <div style="font-size:10px;font-weight:700;color:#334155">${val}</div>
      <div style="width:calc(100% - 2px);max-width:24px;height:${h}px;background:#f59e0b;border-radius:3px 3px 0 0"></div>
    </div>`;
  }).join('');
  const barLabels = months.map(m => {
    const d = parseISO(m+'-01');
    return `<div style="flex:1;text-align:center;font-size:9.5px;color:#94a3b8">${THAI_MONTHS[d.getMonth()]}</div>`;
  }).join('');
  const bestM = months.reduce((b,m) => monthMap[m].total > (monthMap[b]?.total||0) ? m : b, months[0]||'');
  const bestLabel = bestM ? (() => { const d = parseISO(bestM+'-01'); return `${THAI_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()+543}`; })() : '';

  // monthly table
  const tableRows = months.map(m => {
    const d = parseISO(m+'-01');
    const lbl = `${THAI_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()+543}`;
    const tds = types.map(t => `<td style="text-align:center;font-size:11.5px;padding:7px 4px">${monthMap[m].byType[t.id]||0}</td>`).join('');
    return `<tr style="border-top:1px solid #f1f5f9"><td style="font-size:11.5px;padding:7px 4px;font-weight:600">${lbl}</td>${tds}<td style="text-align:center;font-size:11.5px;font-weight:700;padding:7px 4px">${monthMap[m].total}</td></tr>`;
  }).join('');
  const totRow = `<tr style="border-top:2px solid #e2e8f0;background:#f8fafc"><td style="font-size:12px;padding:7px 4px;font-weight:800">รวม</td>${types.map(t=>`<td style="text-align:center;font-size:12px;font-weight:800;color:${t.color};padding:7px 4px">${t.days}</td>`).join('')}<td style="text-align:center;font-size:12px;font-weight:800;padding:7px 4px">${totalDays}</td></tr>`;

  el.innerHTML = `
    <div style="padding:16px 14px 140px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="display:flex;align-items:center;gap:8px">${svg('chart',18)}<div style="font-size:16px;font-weight:800">สถิติการลา</div></div>
          <div style="font-size:11.5px;color:#94a3b8;margin-top:2px">ภาพรวมการลาทั้งหมดของคุณ</div>
        </div>
        <div onclick="statsSetYear()" style="display:flex;align-items:center;gap:5px;border:1.5px solid #e2e8f0;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:700;color:#334155">
          ${svg('calendar',13)} ปีงบประมาณ ${_statsAcadYear} ${svg('chevronDown',13)}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:12px">
          <div style="font-size:11px;font-weight:700;color:#ea580c">ทั้งหมด</div>
          <div style="font-size:24px;font-weight:800;line-height:1.1;margin:4px 0">${totalDays} <span style="font-size:11px;color:#64748b;font-weight:500">วัน</span></div>
          <div style="font-size:10.5px;color:#94a3b8">จากสิทธิ์ ${totalQuota} วัน</div>
        </div>
        ${typeCards}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:#fff;border-radius:16px;padding:14px;box-shadow:0 2px 10px rgba(15,23,42,.06)">
          <div style="font-size:12.5px;font-weight:800;margin-bottom:10px">แยกตามประเภท</div>
          <div style="display:flex;justify-content:center;margin-bottom:10px">
            <div style="position:relative;width:110px;height:110px;border-radius:50%;background:conic-gradient(${donutGrad});display:flex;align-items:center;justify-content:center">
              <div style="width:72px;height:72px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
                <div style="font-size:9.5px;color:#64748b">รวม</div>
                <div style="font-size:18px;font-weight:800">${totalDays}</div>
                <div style="font-size:9.5px;color:#64748b">วัน</div>
              </div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px">
            ${types.map(t => `<div style="display:flex;align-items:center;gap:5px;font-size:11px">
              <div style="width:8px;height:8px;border-radius:50%;background:${t.color};flex:none"></div>
              <span style="flex:1;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name)}</span>
              <span style="color:#64748b;white-space:nowrap">${t.days}วัน(${totalDays>0?Math.round(t.days/totalDays*100):0}%)</span>
            </div>`).join('')||'<div style="font-size:11px;color:#94a3b8">ไม่มีข้อมูล</div>'}
          </div>
        </div>
        <div style="background:#fff;border-radius:16px;padding:14px;box-shadow:0 2px 10px rgba(15,23,42,.06)">
          <div style="font-size:12.5px;font-weight:800;margin-bottom:8px">รายเดือน (วัน)</div>
          ${months.length ? `
          <div style="display:flex;gap:3px;align-items:flex-end;height:76px">${barCols}</div>
          <div style="display:flex;gap:3px;margin-top:4px">${barLabels}</div>
          ${bestLabel ? `<div style="margin-top:8px;font-size:10px;color:#64748b;display:flex;align-items:center;gap:3px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
            มากสุด: ${bestLabel} รวม ${monthMap[bestM].total} วัน</div>` : ''}
          ` : '<div style="font-size:11px;color:#94a3b8;text-align:center;padding:20px 0">ไม่มีข้อมูล</div>'}
        </div>
      </div>

      ${months.length ? `
      <div style="background:#fff;border-radius:16px;padding:14px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:14px;overflow-x:auto">
        <div style="font-size:13px;font-weight:800;margin-bottom:10px">สรุปการลาแต่ละเดือน</div>
        <table style="width:100%;border-collapse:collapse;min-width:180px">
          <thead><tr>
            <th style="text-align:left;font-size:11px;font-weight:700;color:#64748b;padding:4px 4px 8px">เดือน</th>
            ${types.map(t=>`<th style="padding:4px 4px 8px"><div style="width:8px;height:8px;border-radius:50%;background:${t.color};margin:0 auto"></div></th>`).join('')}
            <th style="text-align:center;font-size:11px;font-weight:700;color:#64748b;padding:4px 4px 8px">รวม</th>
          </tr></thead>
          <tbody>${tableRows}${totRow}</tbody>
        </table>
      </div>` : ''}

      <div style="background:#fff;border-radius:16px;padding:14px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:14px">
        <div style="font-size:13px;font-weight:800;margin-bottom:12px">ข้อมูลสิทธิการลา</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div>
            <div style="font-size:11px;color:#64748b">สิทธิ์ลาทั้งหมด</div>
            <div style="font-size:28px;font-weight:800;line-height:1.1">${totalQuota} <span style="font-size:13px;font-weight:500;color:#64748b">วัน</span></div>
            <div style="font-size:10.5px;color:#94a3b8;margin-top:2px">ต่อปีงบประมาณ</div>
          </div>
          <div style="width:42px;height:42px;border-radius:12px;background:#eff6ff;display:flex;align-items:center;justify-content:center">
            ${svg('calendar',20)}
          </div>
        </div>
        <div style="height:8px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;width:${usedPct}%;background:#f59e0b;border-radius:999px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px">
          <div style="color:#f59e0b;font-weight:700">ใช้ไป ${totalDays} วัน</div>
          <div style="color:#64748b">คงเหลือ ${remaining} วัน</div>
        </div>
      </div>

      <div>
        <div style="font-size:13px;font-weight:800;margin-bottom:10px">ทางลัด</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <div onclick="openLeaveForm()" style="background:#fff;border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer;box-shadow:0 1px 6px rgba(15,23,42,.06)">
            <div style="width:36px;height:36px;border-radius:50%;background:#fff7ed;display:flex;align-items:center;justify-content:center;margin:0 auto 6px">${svg('calendar',16)}</div>
            <div style="font-size:10.5px;font-weight:700;color:#334155;line-height:1.4">บันทึกการลาใหม่</div>
          </div>
          <div onclick="switchTeacherTab('calendar')" style="background:#fff;border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer;box-shadow:0 1px 6px rgba(15,23,42,.06)">
            <div style="width:36px;height:36px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;margin:0 auto 6px">${svg('calendar',16)}</div>
            <div style="font-size:10.5px;font-weight:700;color:#334155;line-height:1.4">ปฏิทินการลา</div>
          </div>
          <div onclick="switchTeacherTab('home')" style="background:#fff;border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer;box-shadow:0 1px 6px rgba(15,23,42,.06)">
            <div style="width:36px;height:36px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin:0 auto 6px">${svg('list',16)}</div>
            <div style="font-size:10.5px;font-weight:700;color:#334155;line-height:1.4">ประวัติการลา</div>
          </div>
        </div>
      </div>
    </div>`;
};

function renderTeacher(quotas, history) {
  const u = currentUser;
  const fullName = `${u.prefix || ''}${u.name} ${u.surname || ''}`.trim();
  const aColor = avatarColor(u.id);

  // Hide gender-mismatched leave types (e.g. ลาคลอด for males) — quotas are
  // seeded for all types, so filter the display to what this user can actually take.
  const allowedIds = new Set(availableTypesFor(u.prefix, u.gender).map(t => t.id));
  quotas = (quotas || []).filter(q => allowedIds.has(q.leave_type_id));

  const WARN_TIMES  = 6;
  const DANGER_DAYS = 23;

  const countByType = {};
  (history || []).filter(r => r.status === 'Approved').forEach(r => {
    countByType[r.leave_type_id] = (countByType[r.leave_type_id] || 0) + 1;
  });

  const combinedUsedDays = (quotas || [])
    .filter(q => /ลากิจ|ป่วย/.test(q.type_name))
    .reduce((sum, q) => sum + (Number(q.used_days) || 0), 0);

  const primaryQ   = (quotas || []).filter(q => /ลากิจ|ป่วย/.test(q.type_name));
  const secondaryQ = (quotas || []).filter(q => !/ลากิจ|ป่วย/.test(q.type_name));

  const linePhoto = currentLineProfile ? currentLineProfile.pictureUrl : '';
  const photoInner = linePhoto
    ? `<img src="${esc(linePhoto)}" style="width:100%;height:100%;object-fit:cover">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${initials(u.name)}</div>`;

  // Inline SVG paths for icons not in ICONS
  const HOME_PATH = '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
  const USER_PATH = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
  const SICK_PATH = '<line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>';
  function isvg(path, size, sw) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw||2}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`; }
  function issvgc(path, size, color, sw) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw||2}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`; }

  // ── Primary leave type cards ──
  const primaryCards = primaryQ.map(q => {
    const total = Number(q.total_quota) || 0;
    const used  = Number(q.used_days) || 0;
    const rem   = Number(q.remaining_days) || 0;
    const count = countByType[q.leave_type_id] || 0;
    const pct   = total > 0 ? Math.min(1, used / total) : 0;
    const isDanger = combinedUsedDays >= DANGER_DAYS;
    const isWarn   = count >= WARN_TIMES;
    const ringColor  = isDanger ? '#ef4444' : isWarn ? '#f59e0b' : q.color_code;
    const countColor = isDanger ? '#ef4444' : isWarn ? '#f59e0b' : '#64748b';
    const cardBg     = isDanger ? '#fff5f5' : isWarn ? '#fffbf0' : `${q.color_code}14`;
    const cardBorder = isDanger ? '#fca5a5' : isWarn ? '#fcd34d' : `${q.color_code}30`;
    const isSick = /ป่วย/.test(q.type_name);
    return `
      <div style="flex:1;min-width:130px;background:${cardBg};border:1px solid ${cardBorder};border-radius:16px;padding:14px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:12px">
          <div style="width:30px;height:30px;border-radius:50%;background:${q.color_code};display:flex;align-items:center;justify-content:center;flex:none">
            ${issvgc(isSick ? SICK_PATH : USER_PATH, 15, '#fff', 2.2)}
          </div>
          <div style="font-size:12.5px;font-weight:700;color:#334155;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.type_name)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:72px;height:72px;border-radius:50%;background:conic-gradient(${ringColor} ${Math.round(pct*360)}deg,#eef2f7 0deg);display:flex;align-items:center;justify-content:center;flex:none">
            <div style="width:56px;height:56px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-size:21px;font-weight:800;color:#0f172a;line-height:1">${rem}</div>
              <div style="font-size:8px;color:#94a3b8;margin-top:1px">จาก ${total} วัน</div>
            </div>
          </div>
          <div>
            <div style="font-size:11.5px;font-weight:700;color:${countColor}">ใช้ไป ${used} วัน</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px">(${count} ครั้ง)</div>
          </div>
        </div>
      </div>`;
  }).join('') || `<div style="font-size:12px;color:#94a3b8;padding:8px">ไม่มีข้อมูลโควตา</div>`;

  // ── Secondary leave items ──
  const secondaryItems = secondaryQ.map(q => {
    const total = Number(q.total_quota) || 0;
    const used  = Number(q.used_days) || 0;
    const rem   = Number(q.remaining_days) || 0;
    const count = countByType[q.leave_type_id] || 0;
    const pct   = total > 0 ? Math.min(1, used / total) : 0;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#f8fafc;border-radius:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:conic-gradient(${q.color_code} ${Math.round(pct*360)}deg,#eef2f7 0deg);flex:none;display:flex;align-items:center;justify-content:center">
          <div style="width:26px;height:26px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#0f172a">${rem}</div>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;color:#334155">${esc(q.type_name)}</div>
          <div style="font-size:11px;color:#94a3b8">เหลือ ${rem}/${total} วัน · ใช้แล้ว ${count} ครั้ง</div>
        </div>
      </div>`;
  }).join('');

  const secondaryBlock = secondaryQ.length ? `
    <div style="margin-top:12px;border-top:1px solid #f1f5f9;padding-top:12px">
      <div onclick="var s=this.nextElementSibling;var open=s.style.display==='flex';s.style.display=open?'none':'flex';this.querySelector('.sec-lbl').textContent=open?'ดูสิทธิ์การลาประเภทอื่นๆ':'ซ่อนสิทธิ์การลาประเภทอื่นๆ'"
           style="display:flex;align-items:center;gap:6px;font-size:12px;color:#2563eb;font-weight:600;cursor:pointer">
        ${svg('plus', 13)} <span class="sec-lbl">ดูสิทธิ์การลาประเภทอื่นๆ</span> ${svg('chevronRight', 13)}
      </div>
      <div style="display:none;flex-direction:column;gap:8px;margin-top:10px">${secondaryItems}</div>
    </div>` : '';

  // ── History record card renderer ──
  const sorted = (history || []).slice().sort((a, b) => normDate(b.start_date).localeCompare(normDate(a.start_date)));

  function makeRecordCard(r) {
    const sm = statusMeta(r.status);
    const from = normDate(r.start_date), to = normDate(r.end_date);
    const range = (from === to ? fmtThai(from) : `${fmtShort(from)} - ${fmtThai(to)}`) + (r.half_day ? ` (${halfDayLabel(r.half_day)})` : '');
    const remark = r.comments
      ? `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;background:#f1f5f9;border-radius:6px;padding:4px 8px;font-size:11px;color:#334155"><strong>ความเห็นผู้อนุมัติ:</strong> ${esc(r.comments)}</div>`
      : '';
    const actions = [];
    if (r.status === 'Pending_HR') actions.push(`<span onclick="editRequest('${esc(r.id)}')" style="font-size:11px;font-weight:700;color:#2563eb;cursor:pointer">แก้ไข</span>`);
    if (isPending(r.status)) actions.push(`<span onclick="cancelRequest('${esc(r.id)}')" style="font-size:11px;font-weight:700;color:#b91c1c;cursor:pointer">ยกเลิกคำขอ</span>`);
    const cancelBtn = actions.length ? `<div style="display:flex;gap:16px;margin-top:6px">${actions.join('')}</div>` : '';
    const printBtn = r.status === 'Approved'
      ? `<div onclick="printLeaveForm('${esc(r.id)}')" class="dc-hover" style="margin-top:8px;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid #2563eb;border-radius:8px;font-size:11px;font-weight:700;color:#2563eb;cursor:pointer">${svg('download', 13)} ออกใบลา</div>`
      : '';
    const iconColor = r.color_code || typeColor(r.leave_type_id);
    const isSick = /ป่วย/.test(r.type_name || '');
    return `
      <div style="background:#fff;border:1px solid #f1f5f9;border-radius:14px;padding:14px;display:flex;gap:12px;align-items:flex-start">
        <div style="width:44px;height:44px;border-radius:50%;background:${iconColor};flex:none;display:flex;align-items:center;justify-content:center">
          ${issvgc(isSick ? SICK_PATH : USER_PATH, 20, '#fff', 2)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div style="font-size:13px;font-weight:700">${esc(r.type_name || typeName(r.leave_type_id))}</div>
            <div style="display:flex;align-items:center;gap:3px;flex:none">
              <div style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:${sm.bg};color:${sm.color};white-space:nowrap">${sm.label}</div>
              <span style="color:#cbd5e1;display:inline-flex">${svg('chevronRight', 14)}</span>
            </div>
          </div>
          <div style="font-size:12px;color:#475569;margin-bottom:3px;font-weight:500">${range} · ${r.total_days} วัน</div>
          <div style="font-size:11.5px;color:#94a3b8">${esc(r.reason)}</div>
          ${remark}${cancelBtn}${printBtn}
        </div>
      </div>`;
  }

  const latestCard = sorted.length
    ? makeRecordCard(sorted[0])
    : `<div style="font-size:12px;color:#94a3b8;padding:24px;text-align:center">ยังไม่มีประวัติการลา</div>`;

  const historyRest = sorted.slice(1);
  const historyToggle = historyRest.length ? `
    <div onclick="(function(btn){var s=btn.nextElementSibling;var open=s.style.display==='flex';s.style.display=open?'none':'flex';btn.querySelector('.hist-label').textContent=open?'ดูประวัติย้อนหลัง (${historyRest.length} รายการ)':'ซ่อนประวัติย้อนหลัง';btn.querySelector('.hist-arrow').style.transform=open?'rotate(0deg)':'rotate(180deg)'})(this)"
         style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 0 4px;font-size:12px;font-weight:600;color:#2563eb;cursor:pointer">
      <span class="hist-arrow" style="display:inline-flex;transition:transform .2s">${svg('chevronDown', 14)}</span>
      <span class="hist-label">ดูประวัติย้อนหลัง (${historyRest.length} รายการ)</span>
    </div>
    <div style="display:none;flex-direction:column;gap:10px">
      ${historyRest.map(makeRecordCard).join('')}
    </div>` : '';

  // ── Bottom navigation ──
  const navItems = [
    { id: 'home',     label: 'หน้าหลัก',    path: HOME_PATH },
    { id: 'calendar', label: 'ปฏิทินการลา', path: ICONS.calendar },
    { id: 'stats',    label: 'สถิติการลา',  path: ICONS.chart },
  ];
  const bottomNav = `
    <div style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:#fff;border-top:1px solid #f1f5f9;display:flex;z-index:100">
      ${navItems.map(n => `
        <div data-tabn="${n.id}" onclick="switchTeacherTab('${n.id}')"
             style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 4px 8px;cursor:pointer;color:${n.id==='home'?'#2563eb':'#94a3b8'};gap:3px;position:relative">
          <div class="tabn-bar" style="position:absolute;top:0;left:15%;right:15%;height:2.5px;border-radius:0 0 4px 4px;background:${n.id==='home'?'#2563eb':'transparent'}"></div>
          ${isvg(n.path, 20, 1.8)}
          <div style="font-size:9.5px;font-weight:600">${n.label}</div>
        </div>`).join('')}
    </div>`;

  // ── FAB ──
  const fab = `
    <div onclick="openLeaveForm()" class="dc-hover dc-fab" style="position:fixed;bottom:70px;right:calc(50% - 199px);width:60px;height:60px;border-radius:50%;background:#2563eb;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(37,99,235,.45);cursor:pointer;z-index:50;gap:0">
      ${svg('plus', 22, 2.5)}
      <div style="font-size:9.5px;font-weight:700;letter-spacing:.02em">ขอลา</div>
    </div>`;

  const _notiReadIds = new Set(JSON.parse(localStorage.getItem('noti_read_' + u.id) || '[]'));
  const unreadCount  = (history || []).filter(r => (r.status === 'Approved' || r.status === 'Rejected') && !_notiReadIds.has(r.id)).length;
  const BELL_PATH    = '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>';
  const NGEAR_PATH   = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';

  document.getElementById('view-teacher').innerHTML = `
    <div style="width:100%;min-height:100vh;display:flex;justify-content:center">
      <div style="width:100%;max-width:430px;background:#f8fafc;min-height:100vh;position:relative">

        <!-- ── Tab: หน้าหลัก ── -->
        <div id="tt-home">
          <!-- Header -->
          <div style="background:url('https://img2.pic.in.th/BG_User.png') center/cover no-repeat;padding:18px 16px 56px;position:relative;overflow:hidden;color:#fff">
            <div style="position:absolute;inset:0;background:rgba(15,40,100,0.35)"></div>
            <!-- Header top-right: bell + gear -->
            <div style="display:flex;justify-content:flex-end;gap:8px;position:relative;z-index:2;margin-bottom:14px">
              <div id="noti-bell-btn" onclick="openNotifications()" style="position:relative;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#1d4ed8;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${BELL_PATH}</svg>
                ${unreadCount > 0 ? `<div id="noti-badge" style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;background:#ef4444;border-radius:999px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;padding:0 3px">${unreadCount > 9 ? '9+' : unreadCount}</div>` : '<div id="noti-badge" style="display:none"></div>'}
              </div>
              <div onclick="logout()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#1d4ed8;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
                ${svg('logout', 18)}
              </div>
            </div>
            <!-- Profile row -->
            <div style="display:flex;align-items:center;gap:14px;position:relative;z-index:2">
              <div style="width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,0.85);overflow:hidden;background:${aColor};flex:none">
                ${photoInner}
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:17px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fullName)}</div>
                <div style="font-size:12px;opacity:.85;margin-top:2px">${esc(u.position || (ROLE_META[u.role] ? ROLE_META[u.role].label : u.role))} · ${esc(u.department || '-')}</div>
                <div style="margin-top:8px;display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);border-radius:999px;padding:4px 10px;font-size:11px;font-weight:600">
                  ${issvgc(HOME_PATH, 11, 'rgba(255,255,255,0.9)', 2.5)}
                  โรงเรียนบ้านห้วยตาด
                </div>
              </div>
            </div>
          </div>

          <!-- Quota card -->
          <div style="margin:-28px 14px 0;background:#fff;border-radius:18px;box-shadow:0 8px 30px rgba(15,23,42,.1);padding:16px;position:relative;z-index:2">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
              ${svg('calendar', 16)}
              <div style="font-size:14px;font-weight:800">ภาพรวมวันลา</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">${primaryCards}</div>
            ${secondaryBlock}
          </div>

          <!-- History -->
          <div style="padding:20px 14px 140px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
              ${svg('list', 16)}
              <div style="font-size:14px;font-weight:800;flex:1">ประวัติการลา</div>
              <div style="font-size:11.5px;font-weight:600;color:#64748b;background:#f1f5f9;padding:3px 10px;border-radius:999px">${sorted.length} รายการ</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${latestCard}
              ${historyToggle}
            </div>
          </div>
        </div>

        <!-- ── Tab: ปฏิทินการลา ── -->
        <div id="tt-calendar" style="display:none"></div>

        <!-- ── Tab: สถิติการลา ── -->
        <div id="tt-stats" style="display:none"></div>

        ${fab}
        ${bottomNav}
      </div>
    </div>`;
}
