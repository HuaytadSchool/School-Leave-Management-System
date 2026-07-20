// ===========================================================================
// print.js — Leave form document (แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว)
// ===========================================================================

const SCHOOL_NAME = 'โรงเรียนบ้านห้วยตาด';
// Populated from DB settings at boot (auth.js routeByRole); shared for all users
let DIRECTOR_NAME  = '';
let PREPARER_NAME  = '';

function leaveKind(name) {
  const n = String(name || '');
  if (n.includes('ป่วย')) return 'sick';
  if (n.includes('คลอด')) return 'maternity';
  if (n.includes('กิจ')) return 'personal';
  return '';
}

// Build "คำนำหน้า+ชื่อ สกุล" with a single space before the surname, collapsing
// any doubles. Guards the name-sticking bug when name/surname arrive merged or
// when the HR fallback passes a pre-joined teacher_name with no surname field.
function fullName(t) {
  const prefix = String(t.prefix || '').trim();
  const name = String(t.name || '').trim();
  const surname = String(t.surname || '').trim();
  // If name already ends with the surname (pre-joined), don't append it twice.
  const base = surname && !name.endsWith(surname) ? `${name} ${surname}` : name;
  return `${prefix}${base}`.replace(/\s+/g, ' ').trim();
}

window.printLeaveForm = (reqId) => {
  const rec = _teacherData.history.find(r => r.id == reqId);
  if (!rec) { toast('ไม่พบข้อมูลใบลา'); return; }
  openPrint(buildLeaveFormHtml(rec, currentUser, _teacherData.quotas));
};
window.printLeaveFormHr = (reqId) => {
  const rec = _hrData.records.find(r => r.id == reqId);
  if (!rec) { toast('ไม่พบข้อมูลใบลา'); return; }
  const teacher = _hrData.teachers.find(t => t.id == rec.teacher_id) || { name: rec.teacher_name, department: rec.department };
  openPrint(buildLeaveFormHtml(rec, teacher, null));
};

function buildLeaveFormHtml(rec, teacher, quotas) {
  const box = (on) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:1px solid #000;vertical-align:middle;margin:0 4px">${on ? svg('check', 10, 3) : ''}</span>`;
  const fill = (text, min) => `<span style="display:inline-block;border-bottom:1px dotted #000;min-width:${min};text-align:center;padding:0 6px">${esc(text == null ? '' : text)}</span>`;

  const kind = leaveKind(rec.type_name || typeName(rec.leave_type_id));
  const doc = rec.created_at ? new Date(rec.created_at) : new Date();
  const from = normDate(rec.start_date), to = normDate(rec.end_date);
  const name = fullName(teacher);
  const position = teacher.position || (ROLE_META[teacher.role] ? ROLE_META[teacher.role].label : 'ครู');

  const statRow = (label, matcher) => {
    const q = (quotas || []).find(x => String(x.type_name || '').includes(matcher));
    const used = q ? Number(q.used_days) || 0 : null;
    const thisTime = (kind && matcher && (rec.type_name || '').includes(matcher)) ? (Number(rec.total_days) || 0) : (used != null ? 0 : null);
    const before = used != null ? Math.max(0, used - (thisTime || 0)) : '';
    const sum = used != null ? used : '';
    return `<tr>
      <td style="border:1px solid #000;padding:6px 8px">${label}</td>
      <td style="border:1px solid #000;padding:6px 8px;text-align:center">${before}</td>
      <td style="border:1px solid #000;padding:6px 8px;text-align:center">${thisTime == null ? '' : (thisTime || '')}</td>
      <td style="border:1px solid #000;padding:6px 8px;text-align:center">${sum}</td>
    </tr>`;
  };

  const approved = rec.status === 'Approved';
  const line = 'display:inline-block;border-bottom:1px dotted #000;';

  return `
  <div style="max-width:720px;margin:0 auto;padding:20px 40px;font-family:'Sarabun',sans-serif;font-size:14px;color:#000;line-height:1.85">
    <div style="text-align:center;font-size:17px;font-weight:700;margin-bottom:10px">แบบใบลาป่วย ลาคลอดบุตร ลากิจส่วนตัว</div>

    <div style="text-align:right">เขียนที่ ${fill(SCHOOL_NAME, '200px')}</div>
    <div style="text-align:center">วันที่ ${fill(doc.getDate(), '40px')} เดือน ${fill(THAI_MONTHS_FULL[doc.getMonth()], '120px')} พ.ศ. ${fill(doc.getFullYear() + 543, '70px')}</div>

    <div>เรื่อง ${fill('ขอลา' + (rec.type_name || typeName(rec.leave_type_id)), '300px')}</div>
    <div>เรียน ${fill('ผู้อำนวยการ' + SCHOOL_NAME + (DIRECTOR_NAME ? ' (' + DIRECTOR_NAME + ')' : ''), '480px')}</div>

    <div style="margin-top:6px">ข้าพเจ้า ${fill(name, '260px')} ตำแหน่ง ${fill(position, '200px')}</div>
    <div>สังกัด ${fill(SCHOOL_NAME + (teacher.department && teacher.department !== '-' ? ' กลุ่มสาระ/ฝ่าย ' + teacher.department : ''), '540px')}</div>

    <div style="margin-top:6px">ขอลา ${box(kind === 'sick')} ป่วย ${box(kind === 'personal')} กิจส่วนตัว ${box(kind === 'maternity')} คลอดบุตร</div>
    <div>เนื่องจาก ${fill(rec.reason, '560px')}</div>
    <div>ตั้งแต่วันที่ ${fill(fmtThai(from), '180px')} ถึงวันที่ ${fill(fmtThai(to), '180px')} มีกำหนด ${fill(rec.total_days, '50px')} วัน${rec.half_day ? ' (' + halfDayLabel(rec.half_day) + ')' : ''}</div>
    <div>ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ ${fill('', '360px')}</div>
    <div>หมายเลขโทรศัพท์ ${fill(teacher.phone, '220px')}</div>

    <div style="text-align:center;margin-top:14px">(ลงชื่อ) <span style="${line}min-width:220px">&nbsp;</span> ผู้ลา</div>
    <div style="text-align:center">( ${esc(name)} )</div>

    <div style="display:flex;gap:24px;margin-top:16px;align-items:flex-start">
      <div style="flex:1">
        <div style="font-weight:700;margin-bottom:6px">สถิติการลาในปีงบประมาณนี้</div>
        <table style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.4">
          <thead><tr>
            <th style="border:1px solid #000;padding:6px 8px">ประเภทลา</th>
            <th style="border:1px solid #000;padding:6px 8px">ลามาแล้ว<br/>(วันทำการ)</th>
            <th style="border:1px solid #000;padding:6px 8px">ลาครั้งนี้<br/>(วันทำการ)</th>
            <th style="border:1px solid #000;padding:6px 8px">รวมเป็น<br/>(วันทำการ)</th>
          </tr></thead>
          <tbody>
            ${statRow('ป่วย', 'ป่วย')}
            ${statRow('กิจส่วนตัว', 'กิจ')}
            ${statRow('คลอดบุตร', 'คลอด')}
          </tbody>
        </table>
        <div style="margin-top:16px">(ลงชื่อ) <span style="${line}min-width:180px">&nbsp;</span> ผู้ตรวจสอบ</div>
        <div style="text-align:center;font-size:13px">${PREPARER_NAME ? '(' + esc(PREPARER_NAME) + ')' : '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)'}</div>
        <div>ตำแหน่ง <span style="${line}min-width:200px">&nbsp;</span></div>
        <div>วันที่ <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:60px">&nbsp;</span></div>
      </div>

      <div style="flex:1">
        <div style="font-weight:700">ความเห็นผู้บังคับบัญชา</div>
        <div style="${line}width:100%;margin-top:20px">&nbsp;</div>
        <div style="margin-top:10px">(ลงชื่อ) <span style="${line}min-width:180px">&nbsp;</span></div>
        <div>ตำแหน่ง <span style="${line}min-width:200px">&nbsp;</span></div>
        <div>วันที่ <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:60px">&nbsp;</span></div>

        <div style="font-weight:700;margin-top:18px">คำสั่ง</div>
        <div>${box(approved)} อนุญาต ${box(rec.status === 'Rejected')} ไม่อนุญาต</div>
        <div style="${line}width:100%;margin-top:8px">${esc(rec.comments || '')}</div>
        <div style="margin-top:10px">(ลงชื่อ) <span style="${line}min-width:180px">&nbsp;</span></div>
        <div style="text-align:center;font-size:13px">${DIRECTOR_NAME ? '(' + esc(DIRECTOR_NAME) + ')' : '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)'}</div>
        <div>ตำแหน่ง ผู้อำนวยการ${esc(SCHOOL_NAME)}</div>
        <div>วันที่ <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:40px">&nbsp;</span> / <span style="${line}min-width:60px">&nbsp;</span></div>
      </div>
    </div>
  </div>`;
}

// District summary report: per-teacher leave days by type for a fiscal year (1 Oct – 30 Sep)
window.printDistrictReport = () => {
  const nowBE = new Date().getMonth() >= 9 ? new Date().getFullYear() + 544 : new Date().getFullYear() + 543;
  const ce = nowBE - 543;
  const fyStart = `${ce - 1}-10-01`, fyEnd = `${ce}-09-30`;

  const records = (_hrData.records || []).filter(r =>
    r.status === 'Approved' && normDate(r.start_date) >= fyStart && normDate(r.start_date) <= fyEnd
  );
  if (!records.length) { toast('ไม่มีข้อมูลการลาที่อนุมัติในปีงบประมาณนี้'); return; }

  // Group by teacher → days per leave type
  const byTeacher = {};
  records.forEach(r => {
    const t = byTeacher[r.teacher_id] || (byTeacher[r.teacher_id] = { name: r.teacher_name, dept: r.department, byType: {}, total: 0 });
    const days = Number(r.total_days) || 0;
    t.byType[r.leave_type_id] = (t.byType[r.leave_type_id] || 0) + days;
    t.total += days;
  });
  const teacherObj = (id) => (_hrData.teachers || []).find(x => x.id == id) || {};
  const rows = Object.keys(byTeacher).map(id => ({ id, ...byTeacher[id], position: teacherObj(id).position || 'ครู' }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'th'));

  const types = leaveTypes || [];
  const th = (t, extra) => `<th style="border:1px solid #000;padding:6px 8px;font-size:12px;${extra || ''}">${t}</th>`;
  const td = (t, extra) => `<td style="border:1px solid #000;padding:5px 8px;font-size:12px;${extra || ''}">${t}</td>`;

  const totalsByType = {};
  let grandTotal = 0;
  rows.forEach(r => { types.forEach(ty => { totalsByType[ty.id] = (totalsByType[ty.id] || 0) + (r.byType[ty.id] || 0); }); grandTotal += r.total; });

  const bodyRows = rows.map((r, i) => `<tr>
    ${td(i + 1, 'text-align:center')}
    ${td(esc(r.name))}
    ${td(esc(r.position), 'text-align:center')}
    ${types.map(ty => td(r.byType[ty.id] ? r.byType[ty.id] : '-', 'text-align:center')).join('')}
    ${td(r.total || '-', 'text-align:center;font-weight:700')}
  </tr>`).join('');

  const body = `
  <div style="max-width:1000px;margin:0 auto;padding:32px 36px;font-family:'Sarabun',sans-serif;color:#000">
    <div style="text-align:center;font-size:18px;font-weight:700">รายงานสรุปสถิติการลาของข้าราชการครูและบุคลากร</div>
    <div style="text-align:center;font-size:15px;margin-top:4px">${esc(SCHOOL_NAME)}</div>
    <div style="text-align:center;font-size:14px;margin:4px 0 18px">ปีงบประมาณ ${nowBE} (1 ตุลาคม ${ce - 1 + 543} – 30 กันยายน ${ce + 543})</div>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr>
        ${th('ที่', 'width:36px')}${th('ชื่อ-สกุล')}${th('ตำแหน่ง')}
        ${types.map(ty => th(esc(ty.name))).join('')}${th('รวม (วัน)')}
      </tr></thead>
      <tbody>${bodyRows}
        <tr style="background:#f1f5f9;font-weight:700">
          ${td('', 'text-align:center')}${td('รวมทั้งสิ้น', 'text-align:center')}${td('')}
          ${types.map(ty => td(totalsByType[ty.id] || '-', 'text-align:center')).join('')}
          ${td(grandTotal || '-', 'text-align:center')}
        </tr>
      </tbody>
    </table>
    <div style="display:flex;justify-content:space-around;margin-top:48px;font-size:14px;text-align:center">
      <div>
        <div>ลงชื่อ ................................................</div>
        <div style="margin-top:4px">( ${PREPARER_NAME ? esc(PREPARER_NAME) : '................................................'} )</div>
        <div style="margin-top:2px">ผู้จัดทำ / ฝ่ายบุคคล</div>
      </div>
      <div>
        <div>ลงชื่อ ................................................</div>
        <div style="margin-top:4px">( ${DIRECTOR_NAME ? esc(DIRECTOR_NAME) : '................................................'} )</div>
        <div style="margin-top:2px">ผู้อำนวยการ${esc(SCHOOL_NAME)}</div>
      </div>
    </div>
  </div>`;
  openPrint(body);
};

function openPrint(bodyHtml) {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) { toast('เบราว์เซอร์บล็อกป๊อปอัพ กรุณาอนุญาต'); return; }
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
    <title>ใบลา · ${esc(SCHOOL_NAME)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap">
    <style>@page{size:A4;margin:14mm}body{margin:0;font-family:'Sarabun',sans-serif}@media print{.noprint{display:none}}</style>
    </head><body>
    <div class="noprint" style="text-align:center;padding:12px;background:#f1f5f9">
      <button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-family:'Sarabun';font-weight:700;cursor:pointer">พิมพ์ / บันทึกเป็น PDF</button>
    </div>
    ${bodyHtml}
    </body></html>`);
  w.document.close();
  w.focus();
  w.onload = () => setTimeout(() => w.print(), 400);
}
