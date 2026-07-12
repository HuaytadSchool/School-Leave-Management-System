// ===========================================================================
// modals.js — shared modal infrastructure + leave form modal
// ===========================================================================

function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
window.closeModal = closeModal;
function overlay(inner, align = 'center') {
  const justify = align === 'end' ? 'flex-end' : 'center';
  return `<div onclick="closeModal()" style="position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:${justify};justify-content:center;z-index:1000;padding:${align === 'end' ? '0' : '20px'}">
    <div onclick="event.stopPropagation()">${inner}</div></div>`;
}

// ---- Teacher: leave form ----
window.openLeaveForm = () => {
  const avail = availableTypesFor(currentUser.prefix);
  const typeOpts = avail.map(lt => `<option value="${esc(lt.id)}">${esc(lt.name)}</option>`).join('');
  const inner = `
    <div style="width:100vw;max-width:430px;background:#fff;border-radius:20px 20px 0 0;padding:22px 20px 28px;max-height:88vh;overflow-y:auto;animation:fadeUp .25s ease">
      <div style="width:36px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 16px"></div>
      <div style="font-size:17px;font-weight:800;margin-bottom:16px">ยื่นใบลา</div>
      <div style="margin-bottom:14px">
        <div class="dc-label">ประเภทการลา</div>
        <select id="lf-type" class="dc-input" onchange="calcLeaveDays()">${typeOpts}</select>
      </div>
      <div style="margin-bottom:8px"><div class="dc-label">เลือกช่วงวันลา</div>${rangeCalendar('lf', { onchange: 'calcLeaveDays()' })}</div>
      <div id="lf-days" style="font-size:12px;color:#2563eb;font-weight:600;margin:0 0 12px"></div>
      <div style="margin-bottom:14px">
        <div class="dc-label">เหตุผลการลา</div>
        <textarea id="lf-reason" placeholder="ระบุเหตุผลการลา" class="dc-input" style="min-height:70px;resize:vertical"></textarea>
      </div>
      <div style="margin-bottom:18px">
        <div class="dc-label">แนบใบรับรองแพทย์ (ถ้ามี)</div>
        <input type="file" id="lf-file" class="dc-input" style="padding:8px"/>
      </div>
      <button onclick="submitLeaveForm()" class="dc-btn-primary">ส่งใบลา</button>
    </div>`;
  document.getElementById('modal-root').innerHTML = overlay(inner, 'end');
};

function countDaysClient(from, to, mode) {
  if (mode === 'continuous') return daysBetween(from, to);
  const hol = (_holidays || []).map(h => normDate(h.date));
  let c = 0; const cur = parseISO(from), end = parseISO(to);
  while (cur <= end) {
    const d = cur.getDay();
    const iso = toISO(cur.getFullYear(), cur.getMonth(), cur.getDate());
    if (d !== 0 && d !== 6 && !hol.includes(iso)) c++;
    cur.setDate(cur.getDate() + 1);
  }
  return c;
}
window.calcLeaveDays = () => {
  const from = document.getElementById('lf-from').value, to = document.getElementById('lf-to').value;
  const el = document.getElementById('lf-days');
  if (!from || !to) { el.innerHTML = ''; el.dataset.days = 0; return; }
  if (parseISO(to) < parseISO(from)) { el.innerHTML = '<span style="color:#dc2626">วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา</span>'; el.dataset.days = 0; return; }
  const type = leaveTypes.find(t => t.id == document.getElementById('lf-type').value);
  const mode = type ? type.count_mode : 'working';
  const days = countDaysClient(from, to, mode);
  el.dataset.days = days;
  let msg = `จำนวนวันลา ${days} วัน` + (mode === 'continuous' ? ' (นับต่อเนื่องรวมวันหยุด)' : ' (นับเฉพาะวันทำการ)');
  let color = '#2563eb';
  const certDays = type ? Number(type.needs_cert_days) || 0 : 0;
  if (certDays > 0 && daysBetween(from, to) >= certDays) {
    msg += ` · ต้องแนบใบรับรองแพทย์ (ลาป่วยตั้งแต่ ${certDays} วัน)`;
    color = '#b45309';
  }
  el.innerHTML = `<span style="color:${color}">${esc(msg)}</span>`;
};
window.submitLeaveForm = async () => {
  const type = document.getElementById('lf-type').value;
  const from = document.getElementById('lf-from').value;
  const to = document.getElementById('lf-to').value;
  const reason = document.getElementById('lf-reason').value.trim();
  const days = Number(document.getElementById('lf-days').dataset.days || 0);
  if (!from || !to || parseISO(to) < parseISO(from)) { toast('กรุณาระบุวันที่ให้ถูกต้อง'); return; }
  if (!reason) { toast('กรุณาระบุเหตุผลการลา'); return; }
  if (days <= 0) { toast('จำนวนวันลาต้องมากกว่า 0'); return; }
  const fileEl = document.getElementById('lf-file');
  const typeObj = leaveTypes.find(t => t.id == type);
  const certDays = typeObj ? Number(typeObj.needs_cert_days) || 0 : 0;
  if (certDays > 0 && daysBetween(from, to) >= certDays && !fileEl.files.length) {
    toast(`ลาป่วยตั้งแต่ ${certDays} วัน ต้องแนบใบรับรองแพทย์`); return;
  }
  const typeNameStr = typeObj ? typeObj.name : type;
  const dateRange = from === to ? fmtThai(from) : `${fmtThai(from)} – ${fmtThai(to)}`;
  const confirm = await Swal.fire({
    title: 'ยืนยันการส่งใบลา',
    html: `<div style="text-align:left;font-size:14px;line-height:2">
      <div><b>ประเภท:</b> ${typeNameStr}</div>
      <div><b>วันที่:</b> ${dateRange}</div>
      <div><b>จำนวน:</b> ${days} วัน</div>
      <div><b>เหตุผล:</b> ${reason}</div>
    </div>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'ยืนยัน ส่งใบลา',
    cancelButtonText: 'ตรวจสอบอีกครั้ง'
  });
  if (!confirm.isConfirmed) return;
  showLoader(true);
  try {
    let fileBase64 = null, fileName = null;
    if (fileEl.files.length) { fileName = fileEl.files[0].name; fileBase64 = await toBase64(fileEl.files[0]); }
    await api.submitLeaveRequest({
      teacher_id: currentUser.id, leave_type_id: type, start_date: from, end_date: to,
      total_days: days, reason, fileBase64, fileName,
      photo_url: currentLineProfile ? currentLineProfile.pictureUrl : ''
    });
    closeModal();
    toast('ส่งใบลาสำเร็จ รอการอนุมัติ');
    await reloadPortal();
  } catch (err) { swalError(err.message); } finally { showLoader(false); }
};
window.cancelRequest = async (reqId) => {
  const c = await Swal.fire({ title: 'ยกเลิกคำขอนี้?', text: 'โควตาการลาจะถูกคืนเข้าระบบ', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'ยกเลิกคำขอ', cancelButtonText: 'ย้อนกลับ' });
  if (!c.isConfirmed) return;
  showLoader(true);
  try { await api.cancelLeaveRequest(reqId); toast('ยกเลิกคำขอแล้ว'); await loadTeacher(); }
  catch (err) { swalError(err.message); } finally { showLoader(false); }
};

const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
});
