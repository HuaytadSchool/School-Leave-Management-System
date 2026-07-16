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

// ---- Teacher: leave form (editReq set → edit mode for a Pending_HR request) ----
window.openLeaveForm = (editReq) => {
  const editing = !!editReq;
  const avail = availableTypesFor(currentUser.prefix);
  const typeOpts = avail.map(lt => `<option value="${esc(lt.id)}" ${editing && editReq.leave_type_id == lt.id ? 'selected' : ''}>${esc(lt.name)}</option>`).join('');
  const inner = `
    <div style="width:100vw;max-width:430px;background:#fff;border-radius:20px 20px 0 0;padding:22px 20px 28px;max-height:88vh;overflow-y:auto;animation:fadeUp .25s ease">
      <div style="width:36px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 16px"></div>
      <div style="font-size:17px;font-weight:800;margin-bottom:16px">${editing ? 'แก้ไขใบลา' : 'ยื่นใบลา'}</div>
      <input type="hidden" id="lf-edit" value="${editing ? esc(editReq.id) : ''}"/>
      <div style="margin-bottom:14px">
        <div class="dc-label">ประเภทการลา</div>
        <select id="lf-type" class="dc-input" onchange="calcLeaveDays()">${typeOpts}</select>
      </div>
      <div style="margin-bottom:8px"><div class="dc-label">เลือกช่วงวันลา</div>${rangeCalendar('lf', { onchange: 'calcLeaveDays()' })}</div>
      <div id="lf-half-wrap" style="display:none;margin:4px 0 12px">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <label class="dc-half-opt" style="flex:1"><input type="radio" name="lf-dur" value="full" checked onchange="calcLeaveDays()"> เต็มวัน</label>
          <label class="dc-half-opt" style="flex:1"><input type="radio" name="lf-dur" value="half" onchange="calcLeaveDays()"> ครึ่งวัน</label>
        </div>
        <div id="lf-period" style="display:none;gap:8px">
          <label class="dc-half-opt" style="flex:1"><input type="radio" name="lf-period" value="morning" checked onchange="calcLeaveDays()"> เช้า</label>
          <label class="dc-half-opt" style="flex:1"><input type="radio" name="lf-period" value="afternoon" onchange="calcLeaveDays()"> บ่าย</label>
        </div>
      </div>
      <div id="lf-days" style="font-size:12px;color:#2563eb;font-weight:600;margin:0 0 12px"></div>
      <div style="margin-bottom:14px">
        <div class="dc-label">เหตุผลการลา</div>
        <textarea id="lf-reason" placeholder="ระบุเหตุผลการลา" class="dc-input" style="min-height:70px;resize:vertical">${editing ? esc(editReq.reason || '') : ''}</textarea>
      </div>
      <div style="margin-bottom:18px">
        <div class="dc-label">แนบใบรับรองแพทย์ ${editing ? '(แนบใหม่เพื่อแทนที่ไฟล์เดิม)' : '(ถ้ามี)'}</div>
        <input type="file" id="lf-file" class="dc-input" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style="padding:8px"/>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">รองรับ PDF, JPG, PNG · ไม่เกิน 5 MB</div>
      </div>
      <button onclick="submitLeaveForm()" class="dc-btn-primary">${editing ? 'บันทึกการแก้ไข' : 'ส่งใบลา'}</button>
    </div>`;
  document.getElementById('modal-root').innerHTML = overlay(inner, 'end');

  if (editing) {
    // Prefill the range calendar + half-day state, then recompute
    const st = _range['lf'];
    st.start = normDate(editReq.start_date);
    st.end = normDate(editReq.end_date);
    const sd = parseISO(st.start);
    st.year = sd.getFullYear(); st.month = sd.getMonth();
    document.getElementById('lf-from').value = st.start;
    document.getElementById('lf-to').value = st.end;
    document.getElementById('lf-cal').innerHTML = renderRangeCal('lf');
    if (editReq.half_day) {
      const durHalf = document.querySelector('input[name="lf-dur"][value="half"]');
      const period = document.querySelector(`input[name="lf-period"][value="${editReq.half_day}"]`);
      if (durHalf) durHalf.checked = true;
      if (period) period.checked = true;
    }
    calcLeaveDays();
  }
};

// Attachment validation (mirrors server uploadFileToDrive)
const ATTACH_ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
function attachmentError(file) {
  if (!ATTACH_ALLOWED.includes(file.type)) return 'รองรับเฉพาะไฟล์ PDF, JPG, PNG';
  if (file.size > ATTACH_MAX_BYTES) return 'ไฟล์แนบต้องมีขนาดไม่เกิน 5 MB';
  return '';
}
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
// Allowed leave window (mirrors server submitLeaveRequest): back ≤30 days, forward ≤30 days
const LEAVE_BACK_DAYS = 30, LEAVE_FWD_DAYS = 30;
function leaveDateError(from) {
  if (!from) return '';
  const diff = Math.round((parseISO(from) - parseISO(todayISO())) / 86400000);
  if (diff < -LEAVE_BACK_DAYS) return `ยื่นลาย้อนหลังได้ไม่เกิน ${LEAVE_BACK_DAYS} วัน`;
  if (diff > LEAVE_FWD_DAYS) return `ยื่นลาล่วงหน้าได้ไม่เกิน ${LEAVE_FWD_DAYS} วัน`;
  return '';
}
window.calcLeaveDays = () => {
  const from = document.getElementById('lf-from').value, to = document.getElementById('lf-to').value;
  const el = document.getElementById('lf-days');
  const halfWrap = document.getElementById('lf-half-wrap');
  const periodWrap = document.getElementById('lf-period');
  if (!from || !to) { el.innerHTML = ''; el.dataset.days = 0; if (halfWrap) halfWrap.style.display = 'none'; return; }
  if (parseISO(to) < parseISO(from)) { el.innerHTML = '<span style="color:#dc2626">วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา</span>'; el.dataset.days = 0; if (halfWrap) halfWrap.style.display = 'none'; return; }
  const dErr = leaveDateError(from);
  if (dErr) { el.innerHTML = `<span style="color:#dc2626">${dErr}</span>`; el.dataset.days = 0; if (halfWrap) halfWrap.style.display = 'none'; return; }

  // Half-day option only for a single-day leave
  const singleDay = from === to;
  if (halfWrap) halfWrap.style.display = singleDay ? 'block' : 'none';
  const durEl = document.querySelector('input[name="lf-dur"]:checked');
  const isHalf = singleDay && durEl && durEl.value === 'half';
  if (periodWrap) periodWrap.style.display = isHalf ? 'flex' : 'none';

  const type = leaveTypes.find(t => t.id == document.getElementById('lf-type').value);
  const mode = type ? type.count_mode : 'working';
  const days = isHalf ? 0.5 : countDaysClient(from, to, mode);
  el.dataset.days = days;
  let msg = isHalf
    ? 'ลาครึ่งวัน (0.5 วัน)'
    : `จำนวนวันลา ${days} วัน` + (mode === 'continuous' ? ' (นับต่อเนื่องรวมวันหยุด)' : ' (นับเฉพาะวันทำการ)');
  let color = '#2563eb';
  const certDays = type ? Number(type.needs_cert_days) || 0 : 0;
  if (!isHalf && certDays > 0 && daysBetween(from, to) >= certDays) {
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
  const dErr = leaveDateError(from);
  if (dErr) { toast(dErr); return; }
  if (!reason) { toast('กรุณาระบุเหตุผลการลา'); return; }
  if (days <= 0) { toast('จำนวนวันลาต้องมากกว่า 0'); return; }
  const fileEl = document.getElementById('lf-file');
  if (fileEl.files.length) {
    const fErr = attachmentError(fileEl.files[0]);
    if (fErr) { toast(fErr); return; }
  }
  const typeObj = leaveTypes.find(t => t.id == type);
  const certDays = typeObj ? Number(typeObj.needs_cert_days) || 0 : 0;
  if (certDays > 0 && daysBetween(from, to) >= certDays && !fileEl.files.length) {
    toast(`ลาป่วยตั้งแต่ ${certDays} วัน ต้องแนบใบรับรองแพทย์`); return;
  }
  const typeNameStr = typeObj ? typeObj.name : type;
  const durEl = document.querySelector('input[name="lf-dur"]:checked');
  const isHalf = from === to && durEl && durEl.value === 'half';
  const periodEl = document.querySelector('input[name="lf-period"]:checked');
  const half_day = isHalf ? (periodEl ? periodEl.value : 'morning') : '';
  const editId = (document.getElementById('lf-edit') || {}).value || '';
  const dateRange = (from === to ? fmtThai(from) : `${fmtThai(from)} – ${fmtThai(to)}`) + (half_day ? ` (${halfDayLabel(half_day)})` : '');
  const confirm = await Swal.fire({
    title: editId ? 'ยืนยันการแก้ไขใบลา' : 'ยืนยันการส่งใบลา',
    html: `<div style="text-align:left;font-size:14px;line-height:2">
      <div><b>ประเภท:</b> ${typeNameStr}</div>
      <div><b>วันที่:</b> ${dateRange}</div>
      <div><b>จำนวน:</b> ${days} วัน</div>
      <div><b>เหตุผล:</b> ${reason}</div>
    </div>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    confirmButtonText: editId ? 'บันทึกการแก้ไข' : 'ยืนยัน ส่งใบลา',
    cancelButtonText: 'ตรวจสอบอีกครั้ง'
  });
  if (!confirm.isConfirmed) return;
  showLoader(true);
  try {
    let fileBase64 = null, fileName = null;
    if (fileEl.files.length) { fileName = fileEl.files[0].name; fileBase64 = await toBase64(fileEl.files[0]); }
    const payload = {
      teacher_id: currentUser.id, leave_type_id: type, start_date: from, end_date: to,
      total_days: days, reason, half_day, fileBase64, fileName,
      photo_url: currentLineProfile ? currentLineProfile.pictureUrl : ''
    };
    if (editId) await api.editLeaveRequest(editId, payload);
    else await api.submitLeaveRequest(payload);
    closeModal();
    toast(editId ? 'แก้ไขใบลาสำเร็จ' : 'ส่งใบลาสำเร็จ รอการอนุมัติ');
    await reloadPortal();
  } catch (err) { swalError(err.message); } finally { showLoader(false); }
};
window.editRequest = (reqId) => {
  const r = (_teacherData.history || []).find(x => x.id == reqId);
  if (!r) { toast('ไม่พบข้อมูลใบลา'); return; }
  openLeaveForm(r);
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
