// ===========================================================================
// admin.js — Admin portal
// ===========================================================================

let _adminData = { teachers: [], holidays: [], records: [], pendingUsers: [], settings: { approval_steps: 2 } };
async function loadAdmin() {
  const [teachers, holidays, records, pendingUsers, settings] = await Promise.all([
    api.getAllTeachers(), api.getHolidays(), api.getAllLeaveReport(), api.getPendingUsers(), api.getSettings()
  ]);
  _adminData = { teachers, holidays, records, pendingUsers, settings };
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

  const tab = _activeTab.Admin || 0;

  const tab0 = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div><div style="font-size:18px;font-weight:800">จัดการผู้ใช้งาน</div><div style="font-size:13px;color:#64748b">${s.teachers.length} บัญชี</div></div>
      <div onclick="openUserModal()" class="dc-hover" style="cursor:pointer;background:#2563eb;color:#fff;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:700">+ เพิ่มผู้ใช้งาน</div>
    </div>
    ${pendingBlock}
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr>
          <th style="text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">ชื่อ-สกุล</th>
          <th style="text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">ตำแหน่ง</th>
          <th style="text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">กลุ่มสาระ/ฝ่าย</th>
          <th style="text-align:left;padding:9px 8px;color:#64748b;font-size:11px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">สิทธิ์</th>
          <th style="text-align:right;padding:9px 8px;color:#64748b;font-size:11px;border-bottom:2px solid #e2e8f0">จัดการ</th>
        </tr></thead>
        <tbody>${userRows}</tbody>
      </table>
    </div>`;

  const tab1 = `
    <div style="font-size:18px;font-weight:800;margin-bottom:16px">ประเภทการลาและโควตา</div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px">
      <div style="font-size:13px;color:#64748b;margin-bottom:14px">แก้ไขจำนวนวันลาสูงสุดต่อปีของแต่ละประเภท</div>
      ${typeConfig}
    </div>`;

  const tab2 = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:18px;font-weight:800">วันหยุดราชการ / วันหยุดโรงเรียน</div>
      <div onclick="addHoliday()" class="dc-hover" style="cursor:pointer;background:#2563eb;color:#fff;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:700">+ เพิ่มวันหยุด</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px">
      <div style="display:flex;flex-direction:column;gap:6px">${holidayRows || '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:20px">ยังไม่มีวันหยุด</div>'}</div>
    </div>`;

  const tab3 = `
    <div style="font-size:18px;font-weight:800;margin-bottom:16px">ข้อมูลผู้ลงนามในใบลา</div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;max-width:480px">
      <div style="font-size:13px;color:#64748b;margin-bottom:18px">ชื่อที่กำหนดจะปรากฏในใบลาเมื่อพิมพ์</div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <div class="dc-label">ชื่อ-นามสกุล ผู้อำนวยการ (ลงนามอนุมัติ)</div>
          <input id="cfg-director" class="dc-input" value="${esc(DIRECTOR_NAME)}" placeholder="เช่น นายพานิก สิทธิ">
        </div>
        <div>
          <div class="dc-label">ชื่อ-นามสกุล ผู้ตรวจสอบ/ผู้จัดทำ (ฝ่ายบุคคล)</div>
          <input id="cfg-preparer" class="dc-input" value="${esc(PREPARER_NAME)}" placeholder="เช่น นางหทัยชนก ปรุงพาณิช">
        </div>
        <div onclick="saveDocConfig()" class="dc-hover" style="cursor:pointer;display:inline-block;background:#2563eb;color:#fff;padding:10px 22px;border-radius:9px;font-size:13px;font-weight:700">บันทึก</div>
      </div>
    </div>`;

  const tab4 = `
    <div style="font-size:18px;font-weight:800;margin-bottom:16px;color:#b91c1c">พื้นที่อันตราย</div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:14px;padding:24px;max-width:500px">
      <div style="font-size:14px;font-weight:700;color:#b91c1c;margin-bottom:8px">ยกยอดวันลาข้ามปีงบประมาณ</div>
      <div style="font-size:13px;color:#7f1d1d;line-height:1.7;margin-bottom:16px">รีเซ็ตวันลาที่ใช้ไปของบุคลากรทุกคนกลับเป็นศูนย์ เหมาะใช้ในต้นปีงบประมาณใหม่ (1 ตุลาคม) ไม่สามารถย้อนกลับได้</div>
      <div onclick="confirmYearlyReset()" class="dc-hover" style="cursor:pointer;display:inline-block;background:#dc2626;color:#fff;padding:10px 22px;border-radius:9px;font-size:13px;font-weight:700">ยกยอดวันลาข้ามปี (Reset)</div>
    </div>`;

  const steps = (s.settings && s.settings.approval_steps) ? s.settings.approval_steps : 2;
  const tab5 = `
    <div style="font-size:18px;font-weight:800;margin-bottom:16px">ตั้งค่าระบบ</div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;max-width:500px">
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">ขั้นตอนการอนุมัติใบลา</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:18px">กำหนดว่าใบลาต้องผ่านกี่ขั้นตอนก่อนถือว่าอนุมัติ</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:22px">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:14px;border:2px solid ${steps==1?'#2563eb':'#e2e8f0'};border-radius:10px;background:${steps==1?'#eff6ff':'#fff'}">
          <input type="radio" name="approval_steps" value="1" ${steps==1?'checked':''} style="margin-top:2px;accent-color:#2563eb">
          <div>
            <div style="font-size:13px;font-weight:700">1 ขั้นตอน</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">ครู → HR อนุมัติ → แจ้งผลครูทันที</div>
          </div>
        </label>
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:14px;border:2px solid ${steps!=1?'#2563eb':'#e2e8f0'};border-radius:10px;background:${steps!=1?'#eff6ff':'#fff'}">
          <input type="radio" name="approval_steps" value="2" ${steps!=1?'checked':''} style="margin-top:2px;accent-color:#2563eb">
          <div>
            <div style="font-size:13px;font-weight:700">2 ขั้นตอน <span style="font-size:11px;font-weight:600;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:999px;margin-left:6px">ค่าเริ่มต้น</span></div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">ครู → HR อนุมัติ → ผู้อำนวยการอนุมัติ → แจ้งผลครู</div>
          </div>
        </label>
      </div>
      <div onclick="saveSystemSettings()" class="dc-hover" style="cursor:pointer;display:inline-block;background:#2563eb;color:#fff;padding:10px 22px;border-radius:9px;font-size:13px;font-weight:700">บันทึกการตั้งค่า</div>
    </div>`;

  const pageTitles = ['จัดการผู้ใช้งาน', 'ประเภทการลา/โควตา', 'วันหยุดราชการ', 'ผู้ลงนามในใบลา', 'พื้นที่อันตราย', 'ตั้งค่าระบบ'];

  document.getElementById('view-admin').innerHTML = `
    <div class="dc-shell" style="display:flex;min-height:100vh">
      ${sidebar('Admin', { 0: s.pendingUsers.length || '' })}
      <div class="dc-main" style="flex:1;padding:28px 32px;max-width:1200px">
        <div style="margin-bottom:22px">
          <div style="font-size:22px;font-weight:800">${pageTitles[tab]}</div>
        </div>
        ${[tab0, tab1, tab2, tab3, tab4, tab5][tab] || ''}
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
window.saveDocConfig = () => {
  DIRECTOR_NAME = document.getElementById('cfg-director').value.trim();
  PREPARER_NAME = document.getElementById('cfg-preparer').value.trim();
  localStorage.setItem('director_name', DIRECTOR_NAME);
  localStorage.setItem('preparer_name', PREPARER_NAME);
  toast('บันทึกข้อมูลผู้ลงนามเรียบร้อย');
};
window.saveSystemSettings = async () => {
  const selected = document.querySelector('input[name="approval_steps"]:checked');
  if (!selected) return;
  const steps = parseInt(selected.value);
  showLoader(true);
  try {
    await api.saveSettings({ approval_steps: steps });
    _adminData.settings = { approval_steps: steps };
    renderAdmin();
    toast(`บันทึกแล้ว: ${steps === 1 ? '1 ขั้นตอน (HR → ครู)' : '2 ขั้นตอน (HR → ผอ. → ครู)'}`);
  } catch (err) { swalError(err.message); } finally { showLoader(false); }
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

// ---- Admin: user CRUD modal ----
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
