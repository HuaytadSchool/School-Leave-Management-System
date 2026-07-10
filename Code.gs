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
            if (approver && (approver.role === 'Supervisor' || approver.role === 'HR' || approver.role === 'Admin')) {
              const status = action === 'approve' ? 'Approved' : 'Rejected';
              updateLeaveStatusAPI(reqId, status, 'ผ่าน LINE', approver.id);
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
      'getLeaveQuotas', 
      'getLeaveTypes',
      'getLeaveHistory', 
      'submitLeaveRequest', 
      'cancelLeaveRequest', 
      'updateLeaveStatusAPI', 
      'getPendingRequestsForSupervisor'
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
    'Teachers': ['id', 'name', 'surname', 'email', 'role', 'department', 'line_user_id', 'phone', 'years_of_service', 'status'],
    'LeaveTypes': ['id', 'name', 'quota_days', 'color_code', 'apply_by_years_of_service'],
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
  }
  return "Database Setup Complete. (Please make sure to delete old Employees sheet if it exists)";
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
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][lineUserIdIdx] === lineUserId && data[i][headers.indexOf('status')] === 'Active') {
      return arrayToObject(headers, data[i]);
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
  
  // Check for duplicate Teacher ID
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] == dataObj.id) {
      throw new Error("รหัสประจำตัวครูซ้ำ (Teacher ID already exists)");
    }
  }
  
  // Append new teacher
  // Headers: ['id', 'name', 'surname', 'email', 'role', 'department', 'line_user_id', 'phone', 'years_of_service', 'status']
  const newRow = [];
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    if (key === 'id') newRow.push(dataObj.id);
    else if (key === 'name') newRow.push(dataObj.name);
    else if (key === 'surname') newRow.push(dataObj.surname);
    else if (key === 'department') newRow.push(dataObj.department);
    else if (key === 'phone') newRow.push(dataObj.phone);
    else if (key === 'line_user_id') newRow.push(dataObj.line_user_id);
    else if (key === 'role') newRow.push('Teacher'); // Default role
    else if (key === 'status') newRow.push('Active'); // Default status
    else if (key === 'years_of_service') newRow.push(0);
    else newRow.push('');
  }
  
  sheet.appendRow(newRow);
  
  return getTeacherByLineId(dataObj.line_user_id);
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
      history.push(req);
    }
  }
  return history.reverse(); // Newest first
}

function submitLeaveRequest(data) {
  const ss = getSpreadsheet();
  const reqSheet = ss.getSheetByName('LeaveRequests');
  const qSheet = ss.getSheetByName('LeaveQuotas');
  
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
      data.total_days, data.reason, attachmentUrl, 'Pending', '', '', '', new Date().toISOString()
    ]);
    
    // Notification to Supervisor
    notifySupervisor(reqId, data);
    
    return { success: true, reqId: reqId };
    
  } catch (e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function cancelLeaveRequest(reqId) {
   return updateLeaveStatusAPI(reqId, 'Cancelled', 'ผู้ใช้ยกเลิกเอง', 'Self');
}

function updateLeaveStatusAPI(reqId, newStatus, comments, approverId) {
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
    if (req.status !== 'Pending' && req.status !== 'Approved_L1') throw new Error("ไม่สามารถเปลี่ยนสถานะได้ (Status already finalized)");
    
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
    reqSheet.getRange(reqRowIdx, rHeaders.indexOf('approver_l1_id') + 1).setValue(approverId);
    
    // Notify Teacher
    notifyTeacherStatusChange(req.teacher_id, newStatus, comments);
    
    return { success: true };
    
  } catch (e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function getPendingRequestsForSupervisor(supervisorId) {
  const ss = getSpreadsheet();
  const rSheet = ss.getSheetByName('LeaveRequests');
  if(!rSheet) return [];
  const rData = rSheet.getDataRange().getValues();
  if(rData.length < 2) return [];
  const rHeaders = rData[0];
  
  let pending = [];
  for (let i = 1; i < rData.length; i++) {
    let status = rData[i][rHeaders.indexOf('status')];
    if (status === 'Pending' || status === 'Approved_L1') {
      pending.push(arrayToObject(rHeaders, rData[i]));
    }
  }
  
  // Attach Teacher Names
  const tSheet = ss.getSheetByName('Teachers');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const teachers = tData.slice(1).map(r => arrayToObject(tHeaders, r));
  
  pending.forEach(p => {
    let teacher = teachers.find(t => t.id == p.teacher_id);
    if(teacher) {
      p.teacher_name = teacher.name + " " + teacher.surname;
      p.department = teacher.department;
    }
  });
  
  return pending;
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

function notifySupervisor(reqId, reqData) {
  if(!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || CONFIG.LINE_CHANNEL_ACCESS_TOKEN.includes("YOUR_")) return;
  
  const ss = getSpreadsheet();
  const tSheet = ss.getSheetByName('Teachers');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const teachers = tData.slice(1).map(r => arrayToObject(tHeaders, r));
  
  const teacher = teachers.find(t => t.id == reqData.teacher_id);
  if(!teacher) return;
  
  const supervisors = teachers.filter(t => t.role === 'Supervisor' && t.department === teacher.department && t.line_user_id);
  
  supervisors.forEach(sup => {
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
