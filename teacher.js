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

window.switchTeacherTab = (tab) => {
  ['home', 'calendar', 'stats', 'guide'].forEach(t => {
    const el = document.getElementById('tt-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('[data-tabn]').forEach(el => {
    const active = el.dataset.tabn === tab;
    el.style.color = active ? '#2563eb' : '#94a3b8';
    el.querySelector('.tabn-bar').style.background = active ? '#2563eb' : 'transparent';
  });
};

// Resize image -> JPEG base64, upload to GDrive via GAS, store fileId in localStorage
window.openPhotoUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = async () => {
        const MAX = 320;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
        showLoader(true);
        try {
          // GAS action: uploadProfilePhoto(userId, base64JPEG, folderId) -> { fileId }
          const result = await api.uploadProfilePhoto(currentUser.id, b64, '15f4Smpdhi1E-TumxCKzu5FsLmiwjWiQ_');
          localStorage.setItem('photo_' + currentUser.id, result.fileId);
          renderTeacher(_teacherData.quotas, _teacherData.history);
          toast('อัปโหลดรูปภาพสำเร็จ');
        } catch (err) {
          swalError('อัปโหลดไม่สำเร็จ: ' + err.message);
        } finally {
          showLoader(false);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

function renderTeacher(quotas, history) {
  const u = currentUser;
  const fullName = `${u.prefix || ''}${u.name} ${u.surname || ''}`.trim();
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

  // Profile photo: prefer uploaded Drive photo, fallback LINE picture, fallback initial
  const savedPhotoId = localStorage.getItem('photo_' + u.id);
  const linePhoto = currentLineProfile ? currentLineProfile.pictureUrl : '';
  const photoSrc = savedPhotoId
    ? `https://drive.google.com/thumbnail?id=${savedPhotoId}&sz=w200-h200-c`
    : linePhoto;
  const photoInner = photoSrc
    ? `<img src="${esc(photoSrc)}" style="width:100%;height:100%;object-fit:cover">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${initials(u.name)}</div>`;

  // Inline SVG paths for icons not in ICONS
  const HOME_PATH = '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
  const CAM_PATH  = '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>';
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
    const range = from === to ? fmtThai(from) : `${fmtShort(from)} - ${fmtThai(to)}`;
    const remark = r.comments
      ? `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;background:#f1f5f9;border-radius:6px;padding:4px 8px;font-size:11px;color:#334155"><strong>ความเห็นผู้อนุมัติ:</strong> ${esc(r.comments)}</div>`
      : '';
    const cancelBtn = isPending(r.status)
      ? `<div onclick="cancelRequest('${esc(r.id)}')" style="margin-top:6px;font-size:11px;font-weight:700;color:#b91c1c;cursor:pointer">ยกเลิกคำขอ</div>`
      : '';
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
    { id: 'home',     label: 'หน้าหลัก',      path: HOME_PATH },
    { id: 'calendar', label: 'ปฏิทินการลา',   path: ICONS.calendar },
    { id: 'stats',    label: 'สถิติการลา',    path: ICONS.chart },
    { id: 'guide',    label: 'คู่มือ/ระเบียบ', path: ICONS.folder },
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

  document.getElementById('view-teacher').innerHTML = `
    <div style="width:100%;min-height:100vh;display:flex;justify-content:center">
      <div style="width:100%;max-width:430px;background:#f8fafc;min-height:100vh;position:relative">

        <!-- ── Tab: หน้าหลัก ── -->
        <div id="tt-home">
          <!-- Header -->
          <div style="background:linear-gradient(160deg,#1e6fe6 0%,#1a55cd 50%,#1740b0 100%);padding:18px 16px 56px;position:relative;overflow:hidden;color:#fff">
            <svg viewBox="0 0 430 100" preserveAspectRatio="none" style="position:absolute;bottom:0;left:0;width:100%;height:100px;pointer-events:none">
              <path d="M0 68 L48 34 L98 54 L158 20 L218 48 L270 26 L330 50 L430 20 L430 100 L0 100Z" fill="rgba(255,255,255,0.07)"/>
              <path d="M0 82 Q110 60 220 76 Q320 92 430 66 L430 100 L0 100Z" fill="rgba(255,255,255,0.1)"/>
              <rect x="342" y="52" width="52" height="48" fill="rgba(255,255,255,0.11)" rx="2"/>
              <rect x="354" y="40" width="28" height="16" fill="rgba(255,255,255,0.11)" rx="1"/>
              <rect x="360" y="28" width="16" height="16" fill="rgba(255,255,255,0.11)" rx="1"/>
              <line x1="368" y1="14" x2="368" y2="30" stroke="rgba(255,255,255,0.38)" stroke-width="1.5"/>
              <polygon points="368,14 382,20 368,26" fill="rgba(255,255,255,0.48)"/>
              <circle cx="368" cy="51" r="5" fill="none" stroke="rgba(255,255,255,0.42)" stroke-width="1.5"/>
              <rect x="348" y="60" width="9" height="9" fill="rgba(255,255,255,0.17)" rx="1"/>
              <rect x="363" y="60" width="9" height="9" fill="rgba(255,255,255,0.17)" rx="1"/>
              <rect x="378" y="60" width="9" height="9" fill="rgba(255,255,255,0.17)" rx="1"/>
              <path d="M26 100 L35 72 L44 100Z" fill="rgba(255,255,255,0.14)"/>
              <path d="M54 100 L66 63 L78 100Z" fill="rgba(255,255,255,0.14)"/>
              <path d="M10 100 L16 82 L22 100Z" fill="rgba(255,255,255,0.11)"/>
              <ellipse cx="128" cy="22" rx="28" ry="9" fill="rgba(255,255,255,0.13)"/>
              <ellipse cx="150" cy="16" rx="22" ry="8" fill="rgba(255,255,255,0.17)"/>
              <ellipse cx="238" cy="14" rx="20" ry="7" fill="rgba(255,255,255,0.11)"/>
              <ellipse cx="256" cy="10" rx="15" ry="6" fill="rgba(255,255,255,0.14)"/>
            </svg>
            <!-- Logout top-right -->
            <div style="display:flex;justify-content:flex-end;position:relative;z-index:2;margin-bottom:14px">
              <div onclick="logout()" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer">${svg('logout', 16)}</div>
            </div>
            <!-- Profile row -->
            <div style="display:flex;align-items:center;gap:14px;position:relative;z-index:2">
              <!-- Avatar wrapper (outer div handles click + badge, inner handles clip) -->
              <div onclick="openPhotoUpload()" style="position:relative;width:72px;height:72px;flex:none;cursor:pointer">
                <div style="width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,0.85);overflow:hidden;background:${aColor}">
                  ${photoInner}
                </div>
                <div style="position:absolute;bottom:1px;right:1px;width:22px;height:22px;background:#1d4ed8;border:2.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center">
                  ${issvgc(CAM_PATH, 11, '#fff', 2)}
                </div>
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
        <div id="tt-calendar" style="display:none;padding:28px 16px 100px">
          <div style="font-size:18px;font-weight:800;margin-bottom:6px">ปฏิทินการลา</div>
          <div style="font-size:13px;color:#94a3b8">กำลังพัฒนา</div>
        </div>

        <!-- ── Tab: สถิติการลา ── -->
        <div id="tt-stats" style="display:none;padding:28px 16px 100px">
          <div style="font-size:18px;font-weight:800;margin-bottom:6px">สถิติการลา</div>
          <div style="font-size:13px;color:#94a3b8">กำลังพัฒนา</div>
        </div>

        <!-- ── Tab: คู่มือ/ระเบียบ ── -->
        <div id="tt-guide" style="display:none;padding:28px 16px 100px">
          <div style="font-size:18px;font-weight:800;margin-bottom:6px">คู่มือ/ระเบียบ</div>
          <div style="font-size:13px;color:#94a3b8">กำลังพัฒนา</div>
        </div>

        ${fab}
        ${bottomNav}
      </div>
    </div>`;
}
