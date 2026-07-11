// Config & Globals
const CONFIG = {
  SPREADSHEET_ID: '', // Optional: If empty, uses the active spreadsheet
  LINE_CHANNEL_ACCESS_TOKEN: 'QH1HGxWGjPmmdfxGvOao39gagWbh0u7KQfM6rB2S58fR3+JcBSUfYmfh7Ww2cLDxxAFcCeAdHSNB2WynBCpOIsSh+worEYVsRtolfTPl8yuCtN+ceuJ3MGe/gfzf1ZCSRHpJMlEx1198NcKWxAw9MgdB04t89/1O/w1cDnyilFU=',
  DRIVE_FOLDER_ID: 'YOUR_DRIVE_FOLDER_ID'
};

function getSpreadsheet() {
  return CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  // Simple ping endpoint
  return ContentService.createTextOutput(JSON.stringify({
    status: "API is active", 
    version: "2.0 (Teacher terminology)"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payloadStr = e.postData.contents;
    const payload = JSON.parse(payloadStr);
    
    // 1. Handle LINE Webhook Events
    if (payload.events) {
      const events = payload.events;
      for (let i = 0; i < events.length; i++) {
        if (events[i].type === 'postback') {
          const data = events[i].postback.data;
          const params = new URLSearchParams(data);
          const action = params.get('action');
          const reqId = params.get('reqId');
          
          if (action === 'approve' || action === 'reject') {
            const approverLineId = events[i].source.userId;
            const approver = getTeacherByLineId(approverLineId);
            if (approver && (approver.role === 'HR' || approver.role === 'Director' || approver.role === 'Admin')) {
              updateLeaveStatusAPI(reqId, action, 'อนุมัติผ่าน LINE', approver.id, approver.role);
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Handle Frontend API Calls (RPC)
    const action = payload.action;
    const args = payload.args || [];
    
    // Whitelist allowed functions
    const allowedActions = [
      'setupDatabase',
      'getTeacherByLineId',
      'registerTeacher',
      'adminLogin',
      'getLeaveQuotas',
      'getLeaveTypes',
      'getLeaveHistory',
      'submitLeaveRequest',
      'cancelLeaveRequest',
      'getPendingRequestsForApprover',
      'updateLeaveStatusAPI',
      // HR / Director / Admin
      'getAllLeaveReport',
      'createLeaveOnBehalf',
      'getAllTeachers',
      'getPendingUsers',
      'approveUser',
      'rejectUser',
      'saveTeacher',
      'deleteTeacher',
      'updateLeaveTypeQuota',
      'getHolidays',
      'saveHoliday',
      'deleteHoliday',
      'yearlyReset'
    ];
    
    if (allowedActions.includes(action) && typeof this[action] === 'function') {
      const result = this[action].apply(this, args);
      return ContentService.createTextOutput(JSON.stringify({success: true, data: result}))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      throw new Error("Invalid Action or Access Denied");
    }
    
  } catch (error) {
    Logger.log(error);
    return ContentService.createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------
// Database Setup
// -------------------------

function setupDatabase() {
  const ss = getSpreadsheet();
  
  const tables = {
    'Teachers': ['id', 'prefix', 'name', 'surname', 'position', 'department', 'role', 'email', 'phone', 'start_date', 'line_user_id', 'status', 'created_at'],
    'LeaveTypes': ['id', 'name', 'quota_days', 'color_code', 'count_mode', 'gender', 'needs_cert_days', 'apply_by_years_of_service'],
    'LeaveQuotas': ['teacher_id', 'leave_type_id', 'total_quota', 'pending_days', 'used_days', 'remaining_days'],
    'LeaveRequests': ['id', 'teacher_id', 'leave_type_id', 'start_date', 'end_date', 'total_days', 'reason', 'attachment_url', 'status', 'approver_l1_id', 'approver_l2_id', 'comments', 'created_at'],
    'Holidays': ['id', 'date', 'name', 'type']
  };

  for (const sheetName in tables) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(tables[sheetName]);
      sheet.getRange(1, 1, 1, tables[sheetName].length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    
    // Add default LeaveTypes if empty (OBEC teacher leave policy).
    // count_mode: 'working' = นับเฉพาะวันทำการ (เว้นเสาร์อาทิตย์+วันหยุด), 'continuous' = นับต่อเนื่องรวมวันหยุด
    // gender: 'any' | 'male' | 'female' ; needs_cert_days: ต้องแนบใบรับรองแพทย์เมื่อลาติดต่อกัน >= N วัน (0 = ไม่ต้อง)
    if (sheetName === 'LeaveTypes' && sheet.getLastRow() === 1) {
      sheet.appendRow(['L1', 'ลากิจส่วนตัว', 45, '#f59e0b', 'working', 'any', 0, 0]);
      sheet.appendRow(['L2', 'ลาป่วย', 60, '#ef4444', 'working', 'any', 30, 0]);
      sheet.appendRow(['L3', 'ลาคลอดบุตร', 90, '#ec4899', 'continuous', 'female', 0, 0]);
      sheet.appendRow(['L4', 'ลาไปช่วยเหลือภริยาที่คลอดบุตร', 15, '#0891b2', 'working', 'male', 0, 0]);
      sheet.appendRow(['L5', 'ลาอุปสมบท/ประกอบพิธีฮัจย์', 120, '#7c3aed', 'continuous', 'any', 0, 1]);
    }
  }
  return "Database Setup Complete. NOTE: schema changed for Teachers and LeaveTypes — if old 'Teachers' or 'LeaveTypes' sheets exist, delete them and run setupDatabase again so the new columns are recreated.";
}

// -------------------------
// Business Logic Functions
// -------------------------

function getTeacherByLineId(lineUserId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Teachers');
  if(!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  const headers = data[0];
  const lineUserIdIdx = headers.indexOf('line_user_id');
  
  const statusIdx = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    // Return any non-deleted match (Active / Pending / Rejected) so the frontend
    // can gate access; only 'Active' users are allowed to actually use the system.
    if (data[i][lineUserIdIdx] === lineUserId && data[i][statusIdx] !== 'Deleted') {
      const obj = arrayToObject(headers, data[i]);
      obj.start_date = obj.start_date ? formatISODate(obj.start_date) : '';
      return obj;
    }
  }
  return null;
}

function registerTeacher(dataObj) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Teachers');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  const statusIdx = headers.indexOf('status');
  const lineIdx = headers.indexOf('line_user_id');

  // Reject duplicate registration for the same LINE account
  for (let i = 1; i < data.length; i++) {
    if (data[i][lineIdx] === dataObj.line_user_id && data[i][statusIdx] !== 'Deleted') {
      throw new Error("บัญชี LINE นี้ลงทะเบียนไว้แล้ว");
    }
  }

  // Auto-increment id: T001, T002, ...
  let maxIdNum = 0;
  for (let i = 1; i < data.length; i++) {
    const cur = data[i][idIdx];
    if (cur && typeof cur === 'string' && cur.startsWith('T')) {
      const num = parseInt(cur.substring(1), 10);
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  }
  const newId = 'T' + String(maxIdNum + 1).padStart(3, '0');

  // All LINE registrants start as Pending Teacher; the system admin (backend door)
  // approves them and assigns roles. Quotas are seeded on approval.
  const values = {
    id: newId,
    prefix: dataObj.prefix || '',
    name: dataObj.name || '',
    surname: dataObj.surname || '',
    position: dataObj.position || '',
    department: dataObj.department || '',
    role: 'Teacher',
    email: dataObj.email || '',
    phone: dataObj.phone || '',
    start_date: dataObj.start_date || '',
    line_user_id: dataObj.line_user_id || '',
    status: 'Pending',
    created_at: new Date().toISOString()
  };
  sheet.appendRow(headers.map(k => values[k] !== undefined ? values[k] : ''));

  return getTeacherByLineId(dataObj.line_user_id);
}

// -------------------------
// Backend admin door (username/password, independent of LINE)
// -------------------------

// Credentials live in Script Properties (not in this repo). Run setAdminCredentials()
// once from the Apps Script editor to set them; falls back to a default if unset.
function adminLogin(username, password) {
  const props = PropertiesService.getScriptProperties();
  const u = props.getProperty('ADMIN_USERNAME') || 'admin';
  const p = props.getProperty('ADMIN_PASSWORD') || 'admin1234';
  if (String(username) === u && String(password) === p) {
    return { id: 'ADMIN', prefix: '', name: 'ผู้ดูแลระบบ', surname: '', position: 'System Admin', department: '-', role: 'Admin', status: 'Active' };
  }
  throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
}

// Run manually from the Apps Script editor (NOT web-callable) to set admin credentials.
function setAdminCredentials(username, password) {
  if (!username || !password) throw new Error("username และ password ห้ามว่าง");
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ADMIN_USERNAME', String(username));
  props.setProperty('ADMIN_PASSWORD', String(password));
  return 'Admin credentials saved.';
}

// >>> EDIT the two values below, then press Run on THIS function (configureAdmin). <<<
// (ห้ามกด Run ที่ setAdminCredentials ตรง ๆ เพราะจะไม่มี argument ส่งเข้าไป)
function configureAdmin() {
  setAdminCredentials('admin', 'ChangeMe1234');
}

// Create LeaveQuotas rows for a user from every LeaveType (skips existing).
// Quotas are tracked per fiscal year (see yearlyReset); no years-of-service gate.
function initQuotasForUser(teacherId) {
  const ss = getSpreadsheet();
  const qSheet = ss.getSheetByName('LeaveQuotas');
  const types = getLeaveTypes();

  const qData = qSheet.getDataRange().getValues();
  const qHeaders = qData[0];
  const existing = {};
  for (let i = 1; i < qData.length; i++) {
    existing[qData[i][qHeaders.indexOf('teacher_id')] + '|' + qData[i][qHeaders.indexOf('leave_type_id')]] = true;
  }

  types.forEach(t => {
    if (existing[teacherId + '|' + t.id]) return;
    const total = Number(t.quota_days) || 0;
    // Row order must match headers: teacher_id, leave_type_id, total_quota, pending_days, used_days, remaining_days
    qSheet.appendRow([teacherId, t.id, total, 0, 0, total]);
  });
}

function getLeaveQuotas(teacherId) {
  const ss = getSpreadsheet();
  const qSheet = ss.getSheetByName('LeaveQuotas');
  if(!qSheet) return [];
  const tSheet = ss.getSheetByName('LeaveTypes');
  
  const qData = qSheet.getDataRange().getValues();
  if(qData.length < 2) return [];
  const qHeaders = qData[0];
  
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const types = tData.slice(1).map(row => arrayToObject(tHeaders, row));
  
  let quotas = [];
  for (let i = 1; i < qData.length; i++) {
    if (qData[i][qHeaders.indexOf('teacher_id')] == teacherId) {
      let q = arrayToObject(qHeaders, qData[i]);
      let typeInfo = types.find(t => t.id == q.leave_type_id);
      q.type_name = typeInfo ? typeInfo.name : 'Unknown';
      q.color_code = typeInfo ? typeInfo.color_code : '#000000';
      quotas.push(q);
    }
  }
  return quotas;
}

function getLeaveTypes() {
  const ss = getSpreadsheet();
  const tSheet = ss.getSheetByName('LeaveTypes');
  if(!tSheet) return [];
  const tData = tSheet.getDataRange().getValues();
  if(tData.length < 2) return [];
  const tHeaders = tData[0];
  return tData.slice(1).map(row => arrayToObject(tHeaders, row));
}

function getLeaveHistory(teacherId) {
  const ss = getSpreadsheet();
  const rSheet = ss.getSheetByName('LeaveRequests');
  if(!rSheet) return [];
  const rData = rSheet.getDataRange().getValues();
  if(rData.length < 2) return [];
  const rHeaders = rData[0];
  
  const tSheet = ss.getSheetByName('LeaveTypes');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const types = tData.slice(1).map(row => arrayToObject(tHeaders, row));
  
  let history = [];
  for (let i = 1; i < rData.length; i++) {
    if (rData[i][rHeaders.indexOf('teacher_id')] == teacherId) {
      let req = arrayToObject(rHeaders, rData[i]);
      let typeInfo = types.find(t => t.id == req.leave_type_id);
      req.type_name = typeInfo ? typeInfo.name : 'Unknown';
      req.color_code = typeInfo ? typeInfo.color_code : '#64748b';
      req.start_date = formatISODate(req.start_date);
      req.end_date = formatISODate(req.end_date);
      history.push(req);
    }
  }
  return history.reverse(); // Newest first
}

function submitLeaveRequest(data) {
  const ss = getSpreadsheet();
  const reqSheet = ss.getSheetByName('LeaveRequests');
  const qSheet = ss.getSheetByName('LeaveQuotas');

  // Resolve leave type + enforce OBEC policy (authoritative, server-side)
  const type = getLeaveTypes().find(t => t.id == data.leave_type_id);
  if (!type) throw new Error("ไม่พบประเภทการลา (Leave type not found)");

  // Gender restriction (e.g. ลาคลอด = หญิง, ลาช่วยภริยาคลอด = ชาย)
  if (type.gender === 'male' || type.gender === 'female') {
    const teacher = getTeacherById(data.teacher_id);
    const prefix = teacher ? teacher.prefix : '';
    const MALE = ['นาย', 'ว่าที่ร้อยตรี'];
    const FEMALE = ['นาง', 'นางสาว', 'ว่าที่ร้อยตรีหญิง'];
    if (type.gender === 'female' && MALE.indexOf(prefix) > -1) throw new Error("ประเภทการลานี้สำหรับข้าราชการหญิงเท่านั้น");
    if (type.gender === 'male' && FEMALE.indexOf(prefix) > -1) throw new Error("ประเภทการลานี้สำหรับข้าราชการชายเท่านั้น");
  }

  // Recompute leave days by the type's counting mode (ignore client value)
  data.total_days = countLeaveDays(data.start_date, data.end_date, type.count_mode);
  if (data.total_days <= 0) throw new Error("จำนวนวันลาต้องมากกว่า 0 วัน");

  // Medical certificate required for long continuous sick leave (>= needs_cert_days)
  const certDays = Number(type.needs_cert_days) || 0;
  if (certDays > 0 && calendarDays(data.start_date, data.end_date) >= certDays && !data.fileBase64) {
    throw new Error("ลาป่วยติดต่อกันตั้งแต่ " + certDays + " วันขึ้นไป ต้องแนบใบรับรองแพทย์");
  }

  // Create attachment if exists
  let attachmentUrl = "";
  if (data.fileBase64 && CONFIG.DRIVE_FOLDER_ID && !CONFIG.DRIVE_FOLDER_ID.includes("YOUR_")) {
    attachmentUrl = uploadFileToDrive(data.fileBase64, data.fileName);
  }

  // Transaction: Quota check and update
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    // Check Quota
    const qData = qSheet.getDataRange().getValues();
    const qHeaders = qData[0];
    let quotaRowIdx = -1;
    let currentQuota = null;
    
    for (let i = 1; i < qData.length; i++) {
      if (qData[i][qHeaders.indexOf('teacher_id')] == data.teacher_id && qData[i][qHeaders.indexOf('leave_type_id')] == data.leave_type_id) {
        quotaRowIdx = i + 1;
        currentQuota = arrayToObject(qHeaders, qData[i]);
        break;
      }
    }
    
    if (!currentQuota) throw new Error("ไม่พบข้อมูลโควต้าการลา (Quota not found)");
    if (data.total_days > currentQuota.remaining_days) throw new Error("วันลาคงเหลือไม่เพียงพอ (Insufficient quota)");
    
    // Update Quota (Move remaining to pending)
    qSheet.getRange(quotaRowIdx, qHeaders.indexOf('pending_days') + 1).setValue(Number(currentQuota.pending_days) + Number(data.total_days));
    qSheet.getRange(quotaRowIdx, qHeaders.indexOf('remaining_days') + 1).setValue(Number(currentQuota.remaining_days) - Number(data.total_days));
    
    // Insert Request
    const reqId = "REQ" + new Date().getTime();
    reqSheet.appendRow([
      reqId, data.teacher_id, data.leave_type_id, data.start_date, data.end_date, 
      data.total_days, data.reason, attachmentUrl, 'Pending_HR', '', '', '', new Date().toISOString()
    ]);
    
    // Notification to HR
    notifyApprover(reqId, data, 'HR');
    
    return { success: true, reqId: reqId };
    
  } catch (e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function cancelLeaveRequest(reqId) {
   return updateLeaveStatusAPI(reqId, 'cancel', 'ผู้ใช้ยกเลิกเอง', 'Self', 'Self');
}

function updateLeaveStatusAPI(reqId, action, comments, approverId, approverRole) {
  const ss = getSpreadsheet();
  const reqSheet = ss.getSheetByName('LeaveRequests');
  const qSheet = ss.getSheetByName('LeaveQuotas');
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    const rData = reqSheet.getDataRange().getValues();
    const rHeaders = rData[0];
    let reqRowIdx = -1;
    let req = null;
    
    for (let i = 1; i < rData.length; i++) {
      if (rData[i][rHeaders.indexOf('id')] == reqId) {
        reqRowIdx = i + 1;
        req = arrayToObject(rHeaders, rData[i]);
        break;
      }
    }
    
    if (!req) throw new Error("ไม่พบข้อมูลการลา (Request not found)");
    if (req.status === 'Approved' || req.status === 'Rejected' || req.status === 'Cancelled') {
       throw new Error("ไม่สามารถเปลี่ยนสถานะได้ (Status already finalized)");
    }
    
    let newStatus = req.status;
    if (action === 'cancel') {
      newStatus = 'Cancelled';
    } else if (action === 'reject') {
      newStatus = 'Rejected';
    } else if (action === 'approve') {
      if (approverRole === 'HR' && req.status === 'Pending_HR') {
        newStatus = 'Pending_Director';
      } else if ((approverRole === 'Director' || approverRole === 'Admin') && req.status === 'Pending_Director') {
        newStatus = 'Approved';
      } else {
        throw new Error("สิทธิ์ไม่ถูกต้อง หรือผิดขั้นตอนการอนุมัติ");
      }
    }
    
    // Find Quota
    const qData = qSheet.getDataRange().getValues();
    const qHeaders = qData[0];
    let quotaRowIdx = -1;
    let currentQuota = null;
    
    for (let i = 1; i < qData.length; i++) {
      if (qData[i][qHeaders.indexOf('teacher_id')] == req.teacher_id && qData[i][qHeaders.indexOf('leave_type_id')] == req.leave_type_id) {
        quotaRowIdx = i + 1;
        currentQuota = arrayToObject(qHeaders, qData[i]);
        break;
      }
    }
    
    // Update Quota based on newStatus
    if (newStatus === 'Approved') {
      qSheet.getRange(quotaRowIdx, qHeaders.indexOf('pending_days') + 1).setValue(Number(currentQuota.pending_days) - Number(req.total_days));
      qSheet.getRange(quotaRowIdx, qHeaders.indexOf('used_days') + 1).setValue(Number(currentQuota.used_days) + Number(req.total_days));
    } else if (newStatus === 'Rejected' || newStatus === 'Cancelled') {
      qSheet.getRange(quotaRowIdx, qHeaders.indexOf('pending_days') + 1).setValue(Number(currentQuota.pending_days) - Number(req.total_days));
      qSheet.getRange(quotaRowIdx, qHeaders.indexOf('remaining_days') + 1).setValue(Number(currentQuota.remaining_days) + Number(req.total_days));
    }
    
    // Update Request
    reqSheet.getRange(reqRowIdx, rHeaders.indexOf('status') + 1).setValue(newStatus);
    reqSheet.getRange(reqRowIdx, rHeaders.indexOf('comments') + 1).setValue(comments || '');
    
    if (approverRole === 'HR') {
      reqSheet.getRange(reqRowIdx, rHeaders.indexOf('approver_l1_id') + 1).setValue(approverId);
    } else if (approverRole === 'Director' || approverRole === 'Admin') {
      reqSheet.getRange(reqRowIdx, rHeaders.indexOf('approver_l2_id') + 1).setValue(approverId);
    }
    
    // Notifications
    if (newStatus === 'Pending_Director') {
      notifyApprover(reqId, req, 'Director');
    } else {
      notifyTeacherStatusChange(req.teacher_id, newStatus, comments);
    }
    
    return { success: true };
    
  } catch (e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function getPendingRequestsForApprover(approverId, approverRole) {
  const ss = getSpreadsheet();
  const rSheet = ss.getSheetByName('LeaveRequests');
  if(!rSheet) return [];
  const rData = rSheet.getDataRange().getValues();
  if(rData.length < 2) return [];
  const rHeaders = rData[0];
  
  let pending = [];
  for (let i = 1; i < rData.length; i++) {
    let status = rData[i][rHeaders.indexOf('status')];
    if (approverRole === 'HR' && status === 'Pending_HR') {
      pending.push(arrayToObject(rHeaders, rData[i]));
    } else if ((approverRole === 'Director' || approverRole === 'Admin') && status === 'Pending_Director') {
      pending.push(arrayToObject(rHeaders, rData[i]));
    }
  }
  
  // Attach Teacher Names
  const tSheet = ss.getSheetByName('Teachers');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const teachers = tData.slice(1).map(r => arrayToObject(tHeaders, r));
  
  const types = getLeaveTypes();
  pending.forEach(p => {
    let teacher = teachers.find(t => t.id == p.teacher_id);
    if(teacher) {
      p.teacher_name = teacher.name + " " + teacher.surname;
      p.department = teacher.department;
      p.position = teacher.position || teacher.role;
    }
    let type = types.find(t => t.id == p.leave_type_id);
    p.type_name = type ? type.name : p.leave_type_id;
    p.color_code = type ? type.color_code : '#64748b';
    p.start_date = formatISODate(p.start_date);
    p.end_date = formatISODate(p.end_date);
  });

  return pending;
}

// -------------------------
// HR / Director / Admin endpoints
// -------------------------

// All leave requests joined with teacher + type info (for HR report, Director calendar, dashboards)
function getAllLeaveReport() {
  const ss = getSpreadsheet();
  const rSheet = ss.getSheetByName('LeaveRequests');
  if (!rSheet) return [];
  const rData = rSheet.getDataRange().getValues();
  if (rData.length < 2) return [];
  const rHeaders = rData[0];

  const tSheet = ss.getSheetByName('Teachers');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const teachers = tData.slice(1).map(r => arrayToObject(tHeaders, r));
  const types = getLeaveTypes();

  return rData.slice(1).map(row => {
    const req = arrayToObject(rHeaders, row);
    const teacher = teachers.find(t => t.id == req.teacher_id) || {};
    const type = types.find(t => t.id == req.leave_type_id) || {};
    req.teacher_name = teacher.name ? (teacher.name + ' ' + (teacher.surname || '')).trim() : req.teacher_id;
    req.department = teacher.department || '-';
    req.type_name = type.name || req.leave_type_id;
    req.color_code = type.color_code || '#64748b';
    req.start_date = formatISODate(req.start_date);
    req.end_date = formatISODate(req.end_date);
    return req;
  }).reverse();
}

// HR creates a leave record on behalf of a teacher (auto-approved, no quota block)
function createLeaveOnBehalf(data) {
  const ss = getSpreadsheet();
  const reqSheet = ss.getSheetByName('LeaveRequests');
  const type = getLeaveTypes().find(t => t.id == data.leave_type_id);
  const total = countLeaveDays(data.start_date, data.end_date, type ? type.count_mode : 'working');
  const reqId = "REQ" + new Date().getTime();
  reqSheet.appendRow([
    reqId, data.teacher_id, data.leave_type_id, data.start_date, data.end_date,
    total, data.reason, '', 'Approved', data.created_by || '', data.created_by || '',
    'บันทึกโดยฝ่ายบุคคล', new Date().toISOString()
  ]);
  // Move quota straight to used
  applyQuotaDelta(data.teacher_id, data.leave_type_id, { used: total, remaining: -total });
  return { success: true, reqId: reqId };
}

function getAllTeachers() {
  const ss = getSpreadsheet();
  const tSheet = ss.getSheetByName('Teachers');
  if (!tSheet) return [];
  const tData = tSheet.getDataRange().getValues();
  if (tData.length < 2) return [];
  const tHeaders = tData[0];
  return tData.slice(1)
    .map(r => arrayToObject(tHeaders, r))
    .filter(t => t.status === 'Active')
    .map(t => ({ ...t, start_date: t.start_date ? formatISODate(t.start_date) : '' }));
}

// Users awaiting admin approval
function getPendingUsers() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Teachers');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .map(r => arrayToObject(headers, r))
    .filter(t => t.status === 'Pending')
    .map(t => ({ ...t, start_date: t.start_date ? formatISODate(t.start_date) : '' }));
}

// Admin approves a pending user: activate + assign role + seed quotas
function approveUser(id, role) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Teachers');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  const statusIdx = headers.indexOf('status');
  const roleIdx = headers.indexOf('role');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] == id) {
      sheet.getRange(i + 1, statusIdx + 1).setValue('Active');
      if (role) sheet.getRange(i + 1, roleIdx + 1).setValue(role);
      initQuotasForUser(id);
      return { success: true };
    }
  }
  throw new Error("ไม่พบผู้ใช้งาน (User not found)");
}

// Admin rejects a pending user
function rejectUser(id) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Teachers');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  const statusIdx = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] == id) {
      sheet.getRange(i + 1, statusIdx + 1).setValue('Rejected');
      return { success: true };
    }
  }
  throw new Error("ไม่พบผู้ใช้งาน (User not found)");
}

// Create (no id) or update (with id) a teacher
function saveTeacher(obj) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Teachers');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');

  if (obj.id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] == obj.id) {
        ['prefix', 'name', 'surname', 'position', 'department', 'role', 'email', 'phone', 'start_date'].forEach(key => {
          const c = headers.indexOf(key);
          if (c > -1 && obj[key] !== undefined) sheet.getRange(i + 1, c + 1).setValue(obj[key]);
        });
        return getTeacherById(obj.id);
      }
    }
    throw new Error("ไม่พบผู้ใช้งาน (Teacher not found)");
  }

  // Create new
  let maxIdNum = 0;
  for (let i = 1; i < data.length; i++) {
    const cur = data[i][idIdx];
    if (cur && typeof cur === 'string' && cur.startsWith('T')) {
      const num = parseInt(cur.substring(1), 10);
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  }
  const newId = 'T' + String(maxIdNum + 1).padStart(3, '0');
  const newRow = headers.map(key => {
    if (key === 'id') return newId;
    if (key === 'role') return obj.role || 'Teacher';
    if (key === 'status') return 'Active'; // admin-created users are active immediately
    if (key === 'created_at') return new Date().toISOString();
    return obj[key] !== undefined ? obj[key] : '';
  });
  sheet.appendRow(newRow);
  initQuotasForUser(newId);
  return getTeacherById(newId);
}

// Soft delete (keeps history integrity)
function deleteTeacher(id) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Teachers');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  const statusIdx = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] == id) {
      sheet.getRange(i + 1, statusIdx + 1).setValue('Deleted');
      return { success: true };
    }
  }
  throw new Error("ไม่พบผู้ใช้งาน (Teacher not found)");
}

function updateLeaveTypeQuota(typeId, quotaDays) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('LeaveTypes');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  const qIdx = headers.indexOf('quota_days');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] == typeId) {
      sheet.getRange(i + 1, qIdx + 1).setValue(Number(quotaDays) || 0);
      return { success: true };
    }
  }
  throw new Error("ไม่พบประเภทการลา (Leave type not found)");
}

function getHolidays() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Holidays');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .map(r => arrayToObject(headers, r))
    .filter(h => h.date)
    .map(h => ({ ...h, date: formatISODate(h.date) }));
}

// Create (no id) or update (with id) a holiday
function saveHoliday(obj) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Holidays');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');

  if (obj.id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] == obj.id) {
        ['date', 'name'].forEach(key => {
          const c = headers.indexOf(key);
          if (c > -1 && obj[key] !== undefined) sheet.getRange(i + 1, c + 1).setValue(obj[key]);
        });
        return { success: true, id: obj.id };
      }
    }
    throw new Error("ไม่พบวันหยุด (Holiday not found)");
  }

  const newId = 'H' + new Date().getTime();
  const newRow = headers.map(key => {
    if (key === 'id') return newId;
    if (key === 'type') return obj.type || 'ราชการ';
    return obj[key] !== undefined ? obj[key] : '';
  });
  sheet.appendRow(newRow);
  return { success: true, id: newId };
}

function deleteHoliday(id) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Holidays');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] == id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error("ไม่พบวันหยุด (Holiday not found)");
}

// Yearly rollover: reset every quota's used/pending to 0, remaining = total
function yearlyReset() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('LeaveQuotas');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const totalIdx = headers.indexOf('total_quota');
  const pendingIdx = headers.indexOf('pending_days');
  const usedIdx = headers.indexOf('used_days');
  const remainIdx = headers.indexOf('remaining_days');
  for (let i = 1; i < data.length; i++) {
    const total = Number(data[i][totalIdx]) || 0;
    sheet.getRange(i + 1, pendingIdx + 1).setValue(0);
    sheet.getRange(i + 1, usedIdx + 1).setValue(0);
    sheet.getRange(i + 1, remainIdx + 1).setValue(total);
  }
  return { success: true, resetRows: data.length - 1 };
}

// Adjust a teacher's quota counters by deltas: { pending, used, remaining }
function applyQuotaDelta(teacherId, leaveTypeId, delta) {
  const ss = getSpreadsheet();
  const qSheet = ss.getSheetByName('LeaveQuotas');
  const qData = qSheet.getDataRange().getValues();
  const qHeaders = qData[0];
  for (let i = 1; i < qData.length; i++) {
    if (qData[i][qHeaders.indexOf('teacher_id')] == teacherId && qData[i][qHeaders.indexOf('leave_type_id')] == leaveTypeId) {
      const row = i + 1;
      const q = arrayToObject(qHeaders, qData[i]);
      if (delta.pending) qSheet.getRange(row, qHeaders.indexOf('pending_days') + 1).setValue(Number(q.pending_days) + delta.pending);
      if (delta.used) qSheet.getRange(row, qHeaders.indexOf('used_days') + 1).setValue(Number(q.used_days) + delta.used);
      if (delta.remaining) qSheet.getRange(row, qHeaders.indexOf('remaining_days') + 1).setValue(Number(q.remaining_days) + delta.remaining);
      return;
    }
  }
}

// Count leave days between two ISO dates.
// mode 'continuous' -> calendar days inclusive (นับรวมวันหยุด); otherwise working days (เว้นเสาร์อาทิตย์+วันหยุด)
function countLeaveDays(startIso, endIso, mode) {
  if (mode === 'continuous') {
    return Math.round((new Date(endIso) - new Date(startIso)) / 86400000) + 1;
  }
  const holidays = getHolidays().map(h => h.date);
  let count = 0;
  const cur = new Date(startIso);
  const end = new Date(endIso);
  while (cur <= end) {
    const dow = cur.getDay();
    const iso = formatISODate(cur);
    if (dow !== 0 && dow !== 6 && holidays.indexOf(iso) === -1) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Calendar days inclusive (for continuous-leave / medical-cert threshold checks)
function calendarDays(startIso, endIso) {
  return Math.round((new Date(endIso) - new Date(startIso)) / 86400000) + 1;
}

function formatISODate(d) {
  if (typeof d === 'string') return d.length > 10 ? d.substring(0, 10) : d;
  const dt = new Date(d);
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// -------------------------
// Upload Utils
// -------------------------
function uploadFileToDrive(base64, filename) {
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const contentType = base64.substring(5, base64.indexOf(';'));
    const bytes = Utilities.base64Decode(base64.split(',')[1]);
    const blob = Utilities.newBlob(bytes, contentType, filename);
    const file = folder.createFile(blob);
    return file.getUrl();
  } catch (e) {
    Logger.log("Drive upload failed: " + e.message);
    return "";
  }
}

// -------------------------
// LINE Notification Logics
// -------------------------

function notifyApprover(reqId, reqData, targetRole) {
  if(!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || CONFIG.LINE_CHANNEL_ACCESS_TOKEN.includes("YOUR_")) return;
  
  const ss = getSpreadsheet();
  const tSheet = ss.getSheetByName('Teachers');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const teachers = tData.slice(1).map(r => arrayToObject(tHeaders, r));
  
  const teacher = teachers.find(t => t.id == reqData.teacher_id);
  if(!teacher) return;
  
  const approvers = teachers.filter(t => t.role === targetRole && t.line_user_id);
  
  approvers.forEach(sup => {
    const flex = {
      "type": "flex",
      "altText": "คำขออนุมัติการลาใหม่",
      "contents": {
        "type": "bubble",
        "header": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "คำขออนุมัติการลาใหม่",
              "weight": "bold",
              "color": "#1DB446",
              "size": "sm"
            }
          ]
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": `${teacher.name} ${teacher.surname}`,
              "weight": "bold",
              "size": "xl",
              "margin": "md"
            },
            {
              "type": "text",
              "text": `วันที่: ${reqData.start_date} ถึง ${reqData.end_date}`,
              "size": "sm",
              "color": "#aaaaaa",
              "wrap": true
            },
            {
              "type": "text",
              "text": `เหตุผล: ${reqData.reason}`,
              "size": "sm",
              "color": "#666666",
              "wrap": true,
              "margin": "md"
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "horizontal",
          "spacing": "sm",
          "contents": [
            {
              "type": "button",
              "style": "primary",
              "height": "sm",
              "action": {
                "type": "postback",
                "label": "อนุมัติ",
                "data": `action=approve&reqId=${reqId}`,
                "displayText": "อนุมัติการลา"
              }
            },
            {
              "type": "button",
              "style": "secondary",
              "height": "sm",
              "color": "#e02424",
              "action": {
                "type": "postback",
                "label": "ไม่อนุมัติ",
                "data": `action=reject&reqId=${reqId}`,
                "displayText": "ไม่อนุมัติการลา"
              }
            }
          ]
        }
      }
    };
    sendLineMessage(sup.line_user_id, [flex]);
  });
}

function notifyTeacherStatusChange(teacherId, status, comment) {
  if(!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || CONFIG.LINE_CHANNEL_ACCESS_TOKEN.includes("YOUR_")) return;
  
  const teacher = getTeacherById(teacherId);
  if(teacher && teacher.line_user_id) {
    let msgText = `คำขอการลาของคุณมีสถานะเป็น: ${status}`;
    if(comment) msgText += `\nหมายเหตุ: ${comment}`;
    
    sendLineMessage(teacher.line_user_id, [{ "type": "text", "text": msgText }]);
  }
}

function sendLineMessage(to, messages) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN
    },
    'payload': JSON.stringify({
      'to': to,
      'messages': messages
    })
  };
  UrlFetchApp.fetch(url, options);
}

// -------------------------
// Cron Trigger: Reminders
// -------------------------
function setupRemindTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'cronDailyReminders') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger('cronDailyReminders')
           .timeBased()
           .atHour(9)
           .everyDays(1)
           .create();
}

function cronDailyReminders() {
  const ss = getSpreadsheet();
  const rSheet = ss.getSheetByName('LeaveRequests');
  const rData = rSheet.getDataRange().getValues();
  if(rData.length < 2) return;
  const rHeaders = rData[0];
  
  let now = new Date();
  
  for (let i = 1; i < rData.length; i++) {
    let status = rData[i][rHeaders.indexOf('status')];
    let createdStr = rData[i][rHeaders.indexOf('created_at')];
    if (status === 'Pending' || status === 'Approved_L1') {
      let createdDate = new Date(createdStr);
      let diffDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 2) {
        let reqId = rData[i][rHeaders.indexOf('id')];
        let reqData = arrayToObject(rHeaders, rData[i]);
        notifySupervisor(reqId, reqData); // Re-notify as reminder
      }
    }
  }
}

// -------------------------
// Helper Utils
// -------------------------
function arrayToObject(headers, row) {
  let obj = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i];
  }
  return obj;
}

function getTeacherById(teacherId) {
  const ss = getSpreadsheet();
  const tSheet = ss.getSheetByName('Teachers');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  for(let i=1; i<tData.length; i++){
    if(tData[i][tHeaders.indexOf('id')] == teacherId){
      return arrayToObject(tHeaders, tData[i]);
    }
  }
  return null;
}
