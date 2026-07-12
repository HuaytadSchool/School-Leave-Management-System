// ===========================================================================
// teacher.js — Teacher portal
// ===========================================================================

let _teacherData = { quotas: [], history: [] };
async function loadTeacher() {
  const [quotas, history] = await Promise.all([
    api.getLeaveQuotas(currentUser.id),
    api.getLeaveHistory(currentUser.id)
  ]);
  _teacherData = { quotas, history };
  renderTeacher(quotas, history);
}

function renderTeacher(quotas, history) {
  const u = currentUser;
  const fullName = `${u.prefix || ''}${u.name} ${u.surname || ''}`.trim();
  const ini = initials(u.name);
  const aColor = avatarColor(u.id);

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

  const primaryCards = primaryQ.map(q => {
    const total = Number(q.total_quota) || 0;
    const used  = Number(q.used_days) || 0;
    const rem   = Number(q.remaining_days) || 0;
    const count = countByType[q.leave_type_id] || 0;
    const pct   = total > 0 ? Math.min(1, used / total) : 0;
    const isDanger = combinedUsedDays >= DANGER_DAYS;
    const isWarn   = count >= WARN_TIMES;
    const ringColor  = isDanger ? '#ef4444' : isWarn ? '#f59e0b' : q.color_code;
    const countColor = isDanger ? '#ef4444' : isWarn ? '#f59e0b' : '#94a3b8';
    return `
      <div style="flex:1;min-width:90px;display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="width:90px;height:90px;border-radius:50%;background:conic-gradient(${ringColor} ${Math.round(pct * 360)}deg,#eef2f7 0deg);display:flex;align-items:center;justify-content:center">
          <div style="width:72px;height:72px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1">${rem}</div>
            <div style="font-size:9px;color:#94a3b8">จาก ${total} วัน</div>
          </div>
        </div>
        <div style="font-size:12px;font-weight:700;color:#475569;text-align:center">${esc(q.type_name)}</div>
        <div style="font-size:11px;font-weight:600;color:${countColor}">ใช้ไป ${used} วัน (${count} ครั้ง)</div>
      </div>`;
  }).join('') || '<div style="font-size:12px;color:#94a3b8;padding:8px">ไม่มีข้อมูลโควตา</div>';

  const secondaryItems = secondaryQ.map(q => {
    const total = Number(q.total_quota) || 0;
    const used  = Number(q.used_days) || 0;
    const rem   = Number(q.remaining_days) || 0;
    const count = countByType[q.leave_type_id] || 0;
    const pct   = total > 0 ? Math.min(1, used / total) : 0;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#f8fafc;border-radius:10px">
        <div style="width:38px;height:38px;border-radius:50%;background:conic-gradient(${q.color_code} ${Math.round(pct * 360)}deg,#eef2f7 0deg);flex:none;display:flex;align-items:center;justify-content:center">
          <div style="width:28px;height:28px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#0f172a">${rem}</div>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;color:#334155">${esc(q.type_name)}</div>
          <div style="font-size:11px;color:#94a3b8">เหลือ ${rem}/${total} วัน · ใช้แล้ว ${count} ครั้ง</div>
        </div>
      </div>`;
  }).join('');

  const secondaryBlock = secondaryQ.length ? `
    <div style="margin-top:14px;border-top:1px solid #f1f5f9;padding-top:12px">
      <div onclick="var s=this.nextElementSibling;s.style.display=s.style.display==='flex'?'none':'flex'"
           style="font-size:12px;color:#2563eb;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px">
        ${svg('plus', 13)} ดูสิทธิ์การลาประเภทอื่นๆ
      </div>
      <div style="display:none;flex-direction:column;gap:8px;margin-top:10px">${secondaryItems}</div>
    </div>` : '';

  const quotaCards = `<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center">${primaryCards}</div>${secondaryBlock}`;

  const sorted = (history || []).slice().sort((a, b) => normDate(b.start_date).localeCompare(normDate(a.start_date)));

  function makeRecordCard(r) {
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
  }

  const latestCard = sorted.length
    ? makeRecordCard(sorted[0])
    : '<div style="font-size:12px;color:#94a3b8;padding:20px;text-align:center">ยังไม่มีประวัติการลา</div>';

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
          ${quotaCards}
        </div>

        <div style="padding:20px 16px 0">
          <div style="display:flex;align-items:center;margin-bottom:10px">
            <div style="font-size:14px;font-weight:700;flex:1">ประวัติการลา</div>
            <div style="font-size:12px;color:#94a3b8">${sorted.length} รายการ</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${latestCard}
            ${historyToggle}
          </div>
        </div>

        <div onclick="openLeaveForm()" class="dc-hover dc-fab" style="position:fixed;bottom:28px;right:calc(50% - 199px);width:58px;height:58px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 28px rgba(37,99,235,.4);cursor:pointer;font-size:28px;z-index:50">+</div>
      </div>
    </div>`;
}
