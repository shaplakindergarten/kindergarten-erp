// lib/pdf-generator.ts
import { format } from "date-fns";

interface SchoolInfo {
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email?: string;
  school_logo?: string;
}

interface StaffWithAttendance {
  id: string;
  name: string;
  employee_id: string;
  designation: string;
  role: string;
  phone?: string;
  email?: string;
  photo_url?: string;
  status: string;
  joining_date?: string;
  attendance_status?: string;
  attendance_remarks?: string;
  check_in?: string;
  check_out?: string;
}

// PDF ডাউনলোড ফাংশন - উন্নত error handling সহ
export async function generatePDFWithPuppeteer(html: string, filename: string): Promise<void> {
  try {
    console.log("Sending PDF generation request...");
    
    const response = await fetch("/api/generate-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ html, filename }),
    });
    
    console.log("Response status:", response.status);
    
    if (!response.ok) {
      let errorMessage = "PDF generation failed";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.details || errorMessage;
      } catch (e) {
        // JSON না হলে টেক্সট পড়ার চেষ্টা
        try {
          const textError = await response.text();
          if (textError) errorMessage = textError;
        } catch (textErr) {
          // ইগনোর
        }
      }
      throw new Error(errorMessage);
    }
    
    const contentType = response.headers.get("content-type");
    console.log("Content-Type:", contentType);
    
    if (!contentType || !contentType.includes("application/pdf")) {
      throw new Error("Response is not a PDF file. Content-Type: " + contentType);
    }
    
    const blob = await response.blob();
    console.log("PDF blob size:", blob.size, "bytes");
    
    if (blob.size === 0) {
      throw new Error("Generated PDF is empty");
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log("PDF downloaded successfully:", filename);
    
  } catch (error) {
    console.error("PDF Download Error:", error);
    throw error;
  }
}

// Student Report HTML Generator
export function generateReportHTML(
  schoolInfo: SchoolInfo,
  selectedDate: string,
  stats: { total: number; present: number; absent: number; late: number; pct: number },
  filteredStudents: any[],
  attendance: Record<string, any>,
  fmtDisplay: (date: string) => string
): string {
  const getStatusClass = (status: string) => {
    if (status === 'present') return 'present-cell';
    if (status === 'absent') return 'absent-cell';
    if (status === 'late') return 'late-cell';
    return '';
  };
  
  const getStatusBangla = (status: string) => {
    if (status === 'present') return 'উপস্থিত';
    if (status === 'absent') return 'অনুপস্থিত';
    if (status === 'late') return 'দেরিতে';
    return status;
  };
  
  const getStatusEnglish = (status: string) => {
    if (status === 'present') return 'Present';
    if (status === 'absent') return 'Absent';
    if (status === 'late') return 'Late';
    return status;
  };
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Student Attendance Report - ${fmtDisplay(selectedDate)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Hind Siliguri', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; padding: 20px; font-size: 12px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #2563eb; }
    .school-name { font-size: 24px; font-weight: 700; color: #2563eb; margin-bottom: 5px; }
    .school-address { font-size: 11px; color: #4b5563; margin-bottom: 3px; }
    .school-phone { font-size: 11px; color: #4b5563; }
    .title { text-align: center; margin: 20px 0 10px; }
    .title-main { font-size: 18px; font-weight: 700; color: #1f2937; }
    .title-sub { font-size: 14px; font-weight: 600; color: #4b5563; }
    .date { text-align: center; font-size: 12px; color: #6b7280; margin-bottom: 20px; }
    .stats-bar { background: #f0fdf4; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; text-align: center; margin: 20px 0; }
    .stats-bar span { margin: 0 12px; font-size: 12px; }
    .stat-total { color: #2563eb; font-weight: 700; }
    .stat-present { color: #059669; font-weight: 700; }
    .stat-absent { color: #dc2626; font-weight: 700; }
    .stat-late { color: #d97706; font-weight: 700; }
    .stat-percent { color: #7c3aed; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; }
    th { background: #e5e7eb; font-weight: 700; font-size: 12px; color: #1f2937; }
    td { font-size: 11px; }
    .text-left { text-align: left; }
    .present-cell { color: #059669; font-weight: 700; }
    .absent-cell { color: #dc2626; font-weight: 700; }
    .late-cell { color: #d97706; font-weight: 700; }
    .footer { text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="school-name">${schoolInfo.school_name}</div>
      <div class="school-address">${schoolInfo.school_address}</div>
      <div class="school-phone">📞 ${schoolInfo.school_phone}</div>
    </div>
    
    <div class="title">
      <div class="title-main">ছাত্রদের উপস্থিতি রিপোর্ট</div>
      <div class="title-sub">Student Attendance Report</div>
    </div>
    <div class="date">তারিখ: ${fmtDisplay(selectedDate)}</div>
    
    <div class="stats-bar">
      <span>📊 মোট ছাত্র: <span class="stat-total">${stats.total}</span></span>
      <span>✓ উপস্থিত: <span class="stat-present">${stats.present}</span></span>
      <span>✗ অনুপস্থিত: <span class="stat-absent">${stats.absent}</span></span>
      <span>⏰ দেরিতে: <span class="stat-late">${stats.late}</span></span>
      <span>📈 উপস্থিতির হার: <span class="stat-percent">${stats.pct}%</span></span>
    </div>
    
    <table>
      <thead>
        <tr><th>#</th><th>রোল</th><th class="text-left">ছাত্রের নাম</th><th>শ্রেণী</th><th>সেকশন</th><th>স্ট্যাটাস</th><th class="text-left">মন্তব্য</th></tr>
      </thead>
      <tbody>
        ${filteredStudents.map((s, i) => {
          const status = attendance[s.id]?.status || "present";
          return `
            <tr>
              <td>${i + 1}</td>
              <td>${s.class_roll}</td>
              <td class="text-left">${s.name}</td>
              <td>${s.class_name}</td>
              <td>${s.section_name}</td>
              <td class="${getStatusClass(status)}">${getStatusBangla(status)} (${getStatusEnglish(status)})</td>
              <td class="text-left">${attendance[s.id]?.remarks || ''}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    
    <div class="footer">
      ${schoolInfo.school_name} | জেনারেট করা হয়েছে: ${new Date().toLocaleString('bn-BD')}
    </div>
  </div>
</body>
</html>`;
}

// Staff Report HTML Generator
export function generateStaffReportHTML(
  schoolInfo: SchoolInfo,
  selectedDate: Date,
  stats: { total: number; present: number; absent: number; late: number; leave: number; pct: number },
  filteredStaff: StaffWithAttendance[],
  fmtDisplay: (date: Date) => string
): string {
  const getStatusClass = (status: string) => {
    if (status === 'present') return 'present-cell';
    if (status === 'absent') return 'absent-cell';
    if (status === 'late') return 'late-cell';
    if (status === 'leave') return 'leave-cell';
    return '';
  };
  
  const getStatusBangla = (status: string) => {
    if (status === 'present') return 'উপস্থিত';
    if (status === 'absent') return 'অনুপস্থিত';
    if (status === 'late') return 'দেরিতে';
    if (status === 'leave') return 'ছুটি';
    return status;
  };
  
  const getStatusEnglish = (status: string) => {
    if (status === 'present') return 'Present';
    if (status === 'absent') return 'Absent';
    if (status === 'late') return 'Late';
    if (status === 'leave') return 'Leave';
    return status;
  };
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Staff Attendance Report - ${fmtDisplay(selectedDate)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Hind Siliguri', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; padding: 20px; font-size: 12px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #2563eb; }
    .school-name { font-size: 24px; font-weight: 700; color: #2563eb; margin-bottom: 5px; }
    .school-address { font-size: 11px; color: #4b5563; margin-bottom: 3px; }
    .school-phone { font-size: 11px; color: #4b5563; }
    .title { text-align: center; margin: 20px 0 10px; }
    .title-main { font-size: 18px; font-weight: 700; color: #1f2937; }
    .title-sub { font-size: 14px; font-weight: 600; color: #4b5563; }
    .date { text-align: center; font-size: 12px; color: #6b7280; margin-bottom: 20px; }
    .stats-bar { background: #f0fdf4; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; text-align: center; margin: 20px 0; }
    .stats-bar span { margin: 0 12px; font-size: 12px; }
    .stat-total { color: #2563eb; font-weight: 700; }
    .stat-present { color: #059669; font-weight: 700; }
    .stat-absent { color: #dc2626; font-weight: 700; }
    .stat-late { color: #d97706; font-weight: 700; }
    .stat-leave { color: #8b5cf6; font-weight: 700; }
    .stat-percent { color: #7c3aed; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; }
    th { background: #e5e7eb; font-weight: 700; font-size: 12px; color: #1f2937; }
    td { font-size: 11px; }
    .text-left { text-align: left; }
    .present-cell { color: #059669; font-weight: 700; }
    .absent-cell { color: #dc2626; font-weight: 700; }
    .late-cell { color: #d97706; font-weight: 700; }
    .leave-cell { color: #8b5cf6; font-weight: 700; }
    .footer { text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="school-name">${schoolInfo.school_name}</div>
      <div class="school-address">${schoolInfo.school_address}</div>
      <div class="school-phone">📞 ${schoolInfo.school_phone}</div>
    </div>
    
    <div class="title">
      <div class="title-main">কর্মকর্তা/কর্মচারীদের উপস্থিতি রিপোর্ট</div>
      <div class="title-sub">Staff Attendance Report</div>
    </div>
    <div class="date">তারিখ: ${fmtDisplay(selectedDate)}</div>
    
    <div class="stats-bar">
      <span>📊 মোট স্টাফ: <span class="stat-total">${stats.total}</span></span>
      <span>✓ উপস্থিত: <span class="stat-present">${stats.present}</span></span>
      <span>✗ অনুপস্থিত: <span class="stat-absent">${stats.absent}</span></span>
      <span>⏰ দেরিতে: <span class="stat-late">${stats.late}</span></span>
      <span>🌴 ছুটি: <span class="stat-leave">${stats.leave}</span></span>
      <span>📈 উপস্থিতির হার: <span class="stat-percent">${stats.pct}%</span></span>
    </div>
    
    <table>
      <thead>
        <tr><th>#</th><th>ID</th><th class="text-left">নাম</th><th>পদবি</th><th>স্ট্যাটাস</th><th>চেক-ইন</th><th>চেক-আউট</th><th class="text-left">মন্তব্য</th></tr>
      </thead>
      <tbody>
        ${filteredStaff.map((s, i) => {
          const status = s.attendance_status || "absent";
          return `
            <tr>
              <td>${i + 1}</td>
              <td>${s.employee_id}</td>
              <td class="text-left">${s.name}</td>
              <td>${s.designation || '-'}</td>
              <td class="${getStatusClass(status)}">${getStatusBangla(status)} (${getStatusEnglish(status)})</td>
              <td>${s.check_in || '-'}</td>
              <td>${s.check_out || '-'}</td>
              <td class="text-left">${s.attendance_remarks || ''}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    
    <div class="footer">
      ${schoolInfo.school_name} | জেনারেট করা হয়েছে: ${new Date().toLocaleString('bn-BD')}
    </div>
  </div>
</body>
</html>`;
}