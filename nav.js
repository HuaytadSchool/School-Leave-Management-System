// ===========================================================================
// nav.js — Sidebar + tab navigation (shared by HR / Director / Admin)
// ===========================================================================

let _activeTab = { HR: 0, Director: 0, Admin: 0 };
window.setTab = (role, idx) => {
  _activeTab[role] = idx;
  if (role === 'HR') renderHr();
  else if (role === 'Director') renderDirector();
  else if (role === 'Admin') renderAdmin();
};

const NAV_BY_ROLE = {
  HR: [['chart', 'ภาพรวม'], ['checkCircle', 'รออนุมัติ'], ['list', 'รายงานการลา'], ['users', 'บุคลากร']],
  Director: [['checkCircle', 'รออนุมัติ'], ['calendar', 'ปฏิทินโรงเรียน']],
  Admin: [['user', 'ผู้ใช้งาน'], ['folder', 'ประเภทการลา'], ['calendar', 'วันหยุด'], ['user', 'ผู้ลงนาม'], ['alert', 'อันตราย'], ['settings', 'ตั้งค่าระบบ']],
};

function sidebar(role, badges = {}) {
  const active = _activeTab[role] || 0;
  const items = (NAV_BY_ROLE[role] || []).map(([icon, label], i) => {
    const isActive = i === active;
    const bg    = isActive ? 'rgba(37,99,235,0.22)' : 'transparent';
    const color = isActive ? '#93c5fd' : '#94a3b8';
    const bdg   = badges[i] ? `<span style="margin-left:auto;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px">${badges[i]}</span>` : '';
    return `<div onclick="setTab('${role}',${i})" class="dc-hover" style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;font-size:13px;font-weight:600;background:${bg};color:${color};border-left:${isActive ? '3px solid #3b82f6' : '3px solid transparent'}"><span style="color:${color};display:inline-flex">${svg(icon, 17)}</span>${esc(label)}${bdg}</div>`;
  }).join('');
  return `
    <div class="dc-sidebar" style="width:220px;flex:none;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;padding:22px 16px;position:sticky;top:0">
      <div class="dc-brand" style="display:flex;align-items:center;gap:10px;margin-bottom:26px;padding:0 4px">
        ${SCHOOL_LOGO_URL
          ? `<img src="${SCHOOL_LOGO_URL}" style="width:36px;height:36px;border-radius:9px;object-fit:contain;background:#fff">`
          : `<div style="width:36px;height:36px;border-radius:9px;background:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff">รร</div>`}
        <div>
          <div style="font-size:12.5px;font-weight:700;color:#fff;line-height:1.2">รร.บ้านห้วยตาด</div>
          <div style="font-size:10px;color:#94a3b8">${esc(ROLE_META[role] ? ROLE_META[role].label : role)}</div>
        </div>
      </div>
      <div class="dc-navlabel" style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase;padding:0 4px;margin-bottom:8px">${esc(ROLE_META[role] ? ROLE_META[role].label : role)}</div>
      <div class="dc-nav" style="display:flex;flex-direction:column;gap:2px;margin-bottom:auto">${items}</div>
      ${currentUser.id === 'ADMIN' ? '' : `<div onclick="openLeaveForm()" class="dc-hover dc-leavebtn" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:10px;border-radius:9px;background:#2563eb;color:#fff;font-size:13px;font-weight:700;cursor:pointer">${svg('plus', 15)} ยื่นใบลาของฉัน</div>`}
      <div class="dc-sidefoot" style="border-top:1px solid #1e293b;margin-top:16px;padding-top:14px">
        <div class="dc-sidename" style="font-size:11px;color:#94a3b8;padding:0 4px 6px">${esc(currentUser.prefix || '')}${esc(currentUser.name)}</div>
        <div onclick="logout()" style="cursor:pointer;font-size:12px;font-weight:600;color:#f87171;padding:0 4px;display:flex;align-items:center;gap:6px">${svg('logout', 15)} ออกจากระบบ</div>
      </div>
    </div>`;
}
