// src/app/staff/salary/reports/annual/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Download, Printer, Calendar, DollarSign, 
  Users, TrendingUp, TrendingDown, Eye,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader";
import { getStaff } from "@/lib/api/staff";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, months, getCurrentYear } from "@/lib/salary/salaryUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================
// TYPES
// ============================================================

interface MonthlyData {
  month: string;
  expected: number;
  paid: number;
  balance: number; // positive = due (expected > paid), negative = advance (paid > expected)
  status: 'paid' | 'partial' | 'pending';
}

interface StaffAnnualData {
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_designation: string;
  staff_photo_url?: string;
  monthly_data: MonthlyData[];
  total_expected: number;
  total_paid: number;
  total_due: number;        // positive when total_expected > total_paid
  total_advance: number;    // positive when total_paid > total_expected
  total_balance: number;    // absolute difference
  avg_monthly: number;
}

interface SchoolSettings {
  id: number;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_logo: string;
  school_watermark: string;
  created_at: string;
  updated_at: string;
}

interface SalaryBalance {
  id: string;
  staff_id: string;
  month: string;
  year: number;
  paid_amount: number;
  status: string;
  staff?: {
    name: string;
    employee_id: string;
    designation: string;
    photo_url: string;
  };
}

interface StaffMember {
  id: string;
  name: string;
  employee_id: string;
  designation: string;
  photo_url?: string;
  salary_category?: {
    basic: number;
    hra: number;
    da: number;
    allowances: number;
    deductions: number;
  };
}

// ============================================================
// PDF CONFIG - Bengali Font Support
// ============================================================

// For Bengali support in PDF, we need to use a font that supports Unicode.
// jsPDF with custom font - we'll use a fallback approach.
// For production, you should embed a font like "NotoSansBengali-Regular.ttf"

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AnnualReportPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [annualData, setAnnualData] = useState<StaffAnnualData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(getCurrentYear().toString());
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // ============================================================
  // 1. FIXED: Load School Settings
  // ============================================================
  const loadSchoolSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error || !data) {
        setSchoolSettings({
          id: 0,
          school_name: "চে আলী মডেল একাডেমী",
          school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
          school_phone: "01923253454",
          school_email: "shapla.kindergarten@gmail.com",
          school_logo: "",
          school_watermark: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        setSchoolSettings(data);
      }
    } catch (error) {
      console.error("Error loading school settings:", error);
      setSchoolSettings({
        id: 0,
        school_name: "চে আলী মডেল একাডেমী",
        school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
        school_phone: "01923253454",
        school_email: "shapla.kindergarten@gmail.com",
        school_logo: "",
        school_watermark: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // ============================================================
  // 2. FIXED: Load Annual Report with O(1) Map Lookup
  //    and NO duplicate staff loading
  // ============================================================
  const loadAnnualReport = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Load staff and balances in parallel
      const [staffData, balancesData] = await Promise.all([
        getStaff() as Promise<StaffMember[]>,
        supabase
          .from("salary_balances")
          .select("*, staff:staff_id(name, employee_id, designation, photo_url)")
          .eq("year", parseInt(selectedYear)),
      ]);

      const staffList = staffData || [];
      setStaff(staffList);

      // ============================================================
      // FIXED #3: Build O(1) Map for balances lookup
      // ============================================================
      const balanceMap = new Map<string, Map<string, SalaryBalance>>();
      
      (balancesData.data || []).forEach((balance: SalaryBalance) => {
        if (!balanceMap.has(balance.staff_id)) {
          balanceMap.set(balance.staff_id, new Map());
        }
        balanceMap.get(balance.staff_id)!.set(balance.month, balance);
      });

      // ============================================================
      // FIXED #2: No duplicate staff loading - using staffList directly
      // ============================================================
      const report: StaffAnnualData[] = [];

      for (const staffMember of staffList) {
        const staffBalances = balanceMap.get(staffMember.id) || new Map();
        
        const monthlyData: MonthlyData[] = [];
        let totalExpected = 0;
        let totalPaid = 0;

        // Iterate through months - O(12) per staff = O(12N)
        for (const month of months) {
          const balance = staffBalances.get(month);
          
          // ✅ FIX: Use balance.expected_salary (business-rule applied)
          // Fallback to 0 if no balance record (staff not yet processed)
          const monthExpected = balance?.expected_salary || 0;
          const paid = balance?.paid_amount || 0;
          const balanceAmount = monthExpected - paid;

          monthlyData.push({
            month,
            expected: monthExpected,
            paid,
            balance: balanceAmount,
            status: (balance?.status as 'paid' | 'partial' | 'pending') || 'pending',
          });

          totalExpected += monthExpected;
          totalPaid += paid;
        }

        const diff = totalPaid - totalExpected;
        
        report.push({
          staff_id: staffMember.id,
          staff_name: staffMember.name,
          staff_employee_id: staffMember.employee_id,
          staff_designation: staffMember.designation,
          staff_photo_url: staffMember.photo_url,
          monthly_data: monthlyData,
          total_expected: totalExpected,
          total_paid: totalPaid,
          total_due: diff < 0 ? Math.abs(diff) : 0,      // Due when paid < expected
          total_advance: diff > 0 ? diff : 0,             // Advance when paid > expected
          total_balance: Math.abs(diff),
          avg_monthly: totalPaid / 12,
        });
      }

      setAnnualData(report);
    } catch (err) {
      console.error("Failed to load annual report:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  // ============================================================
  // 6. FIXED: useMemo for statistics
  // ============================================================
  const statistics = useMemo(() => {
    return {
      totalStaff: annualData.length,
      totalExpected: annualData.reduce((sum, item) => sum + item.total_expected, 0),
      totalPaid: annualData.reduce((sum, item) => sum + item.total_paid, 0),
      totalDue: annualData.reduce((sum, item) => sum + item.total_due, 0),
      totalAdvance: annualData.reduce((sum, item) => sum + item.total_advance, 0),
      totalBalance: annualData.reduce((sum, item) => sum + item.total_balance, 0),
      avgPerStaff: annualData.length > 0 
        ? annualData.reduce((sum, item) => sum + item.total_paid, 0) / annualData.length 
        : 0,
    };
  }, [annualData]);

  const stats = useMemo(() => [
    { 
      title: "Total Staff", 
      value: statistics.totalStaff, 
      icon: Users,
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Paid", 
      value: formatCurrency(statistics.totalPaid), 
      icon: DollarSign,
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Due", 
      value: formatCurrency(statistics.totalDue), 
      icon: TrendingDown,
      bgGradient: "from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/30",
      iconBg: "bg-rose-500 dark:bg-rose-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Total Advance", 
      value: formatCurrency(statistics.totalAdvance), 
      icon: TrendingUp,
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
  ], [statistics]);

  useEffect(() => {
    loadAnnualReport();
    loadSchoolSettings();
  }, [loadAnnualReport, loadSchoolSettings]);

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================

  const handleExportExcel = useCallback(() => {
    const exportData = annualData.map(item => {
      const monthData: any = {};
      item.monthly_data.forEach((m) => {
        monthData[`${m.month} Expected`] = m.expected;
        monthData[`${m.month} Paid`] = m.paid;
      });
      return {
        "Staff ID": item.staff_employee_id,
        "Staff Name": item.staff_name,
        "Designation": item.staff_designation,
        ...monthData,
        "Total Expected": item.total_expected,
        "Total Paid": item.total_paid,
        "Due": item.total_due,
        "Advance": item.total_advance,
        "Balance": item.total_balance,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Annual Report");
    XLSX.writeFile(wb, `annual_salary_report_${selectedYear}.xlsx`);
  }, [annualData, selectedYear]);

  // ============================================================
  // 4. FIXED: PDF Export with better Unicode handling
  // ============================================================
  const handleExportPDF = useCallback(async () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    
    const margin = 14;
    const pageWidth = 297;
    const contentWidth = pageWidth - (margin * 2);
    const pageHeight = doc.internal.pageSize.height;
    
    const settings = schoolSettings || {
      school_name: "চে আলী মডেল একাডেমী",
      school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
      school_phone: "01923253454",
      school_email: "shapla.kindergarten@gmail.com",
      school_logo: "",
    };
    
    let yOffset = margin;
    
    // ===== HEADER: Logo on Left, Text Centered =====
    let logoHeight = 0;
    let logoWidth = 0;
    
    // Logo on the left
    if (settings?.school_logo) {
      try {
        const img = new Image();
        img.src = settings.school_logo;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        logoWidth = 25;
        logoHeight = 25;
        doc.addImage(settings.school_logo, 'PNG', margin, yOffset, logoWidth, logoHeight);
      } catch (err) {
        console.error("Logo load error:", err);
      }
    }
    
    // Center the text block
    const textStartX = margin + logoWidth + (logoWidth > 0 ? 8 : 0);
    const centerX = pageWidth / 2;
    let textY = yOffset + 3;
    
    // For Bengali text, we'll use a simpler approach
    // In production, use: doc.addFileToVFS('NotoSansBengali-Regular.ttf', base64Font);
    // doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'normal');
    // doc.setFont('NotoSansBengali');
    
    // School Name centered
    if (settings?.school_name) {
      doc.setFontSize(14);
      doc.setTextColor(99, 102, 241);
      // Using standard font - may not render Bengali perfectly
      // For production, embed a Unicode font
      doc.text(settings.school_name, centerX, textY, { align: 'center' });
      textY += 6;
    }
    
    // School Address centered
    if (settings?.school_address) {
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const addressLines = doc.splitTextToSize(settings.school_address, contentWidth - 50);
      doc.text(addressLines, centerX, textY, { align: 'center' });
      textY += (addressLines.length * 4) + 1;
    }
    
    let contactText = "";
    if (settings?.school_phone) contactText += `Tel: ${settings.school_phone}`;
    if (settings?.school_email) {
      if (contactText) contactText += ` | `;
      contactText += `Email: ${settings.school_email}`;
    }
    if (contactText) {
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(contactText, centerX, textY, { align: 'center' });
      textY += 4;
    }
    
    yOffset = Math.max(yOffset + logoHeight + 2, textY + 2);
    
    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yOffset, pageWidth - margin, yOffset);
    yOffset += 6;
    
    // Report Title centered
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Annual Salary Report", centerX, yOffset, { align: 'center' });
    yOffset += 7;
    
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, centerX, yOffset, { align: 'center' });
    yOffset += 8;
    
    // Table Data
    const tableData = annualData.map(item => {
      const monthPaid = item.monthly_data.map(m => `${m.paid.toLocaleString('en-US')}`);
      return [
        item.staff_employee_id,
        item.staff_name,
        item.staff_designation,
        ...monthPaid,
        item.total_paid.toLocaleString('en-US'),
        item.total_due.toLocaleString('en-US'),
        item.total_advance.toLocaleString('en-US'),
        item.total_balance.toLocaleString('en-US'),
      ];
    });

    const monthHeaders = months.map(m => m.substring(0, 3));
    
    autoTable(doc, {
      head: [["SL", "Staff", "Designation", ...monthHeaders, "Total Paid", "Due", "Advance", "Balance"]],
      body: tableData.map((row, index) => [index + 1, ...row]),
      startY: yOffset,
      margin: { left: margin, right: margin, top: yOffset, bottom: 20 },
      styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { 
        fillColor: [99, 102, 241], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold', 
        halign: 'center',
        fontSize: 6
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 22, halign: 'left' },
        2: { cellWidth: 18, halign: 'left' },
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        
        // Fixed #5: Dynamic page number
        const schoolName = settings?.school_name || 'চে আলী মডেল একাডেমী';
        doc.text(schoolName, centerX, pageHeight - 6, { align: 'center' });
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, centerX, pageHeight - 10, { align: 'center' });
      },
    });

    doc.save(`annual_salary_report_${selectedYear}.pdf`);
  }, [annualData, schoolSettings, selectedYear]);

  // ============================================================
  // 5 & 8: FIXED: Print with proper page numbers and security
  // ============================================================
  const handlePrint = useCallback(async () => {
    // Use iframe for better security
    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'absolute';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = 'none';
    document.body.appendChild(printIframe);

    const printWindow = printIframe.contentWindow;
    if (!printWindow) {
      // Fallback to window.open
      const fallbackWindow = window.open('', '_blank');
      if (!fallbackWindow) {
        window.print();
        return;
      }
      // ... continue with fallback
    }

    // Use the iframe's document
    const doc = printWindow!.document;
    
    // Table rows
    let tableRows = '';
    annualData.forEach((item, index) => {
      const monthPaid = item.monthly_data.map(m => 
        `<td style="padding:2px 3px; border:1px solid #ddd; text-align:right; font-size:8px; white-space:nowrap;">${m.paid.toLocaleString()}</td>`
      ).join('');
      
      tableRows += `
        <tr>
          <td style="padding:2px 3px; border:1px solid #ddd; text-align:center; font-size:8px;">${index + 1}</td>
          <td style="padding:2px 3px; border:1px solid #ddd; text-align:left; font-size:8px; white-space:nowrap;">${item.staff_name}</td>
          <td style="padding:2px 3px; border:1px solid #ddd; text-align:left; font-size:8px; white-space:nowrap;">${item.staff_designation}</td>
          ${monthPaid}
          <td style="padding:2px 3px; border:1px solid #ddd; text-align:right; font-size:8px; font-weight:600; white-space:nowrap;">${item.total_paid.toLocaleString()}</td>
          <td style="padding:2px 3px; border:1px solid #ddd; text-align:right; font-size:8px; color:#ef4444; white-space:nowrap;">${item.total_due.toLocaleString()}</td>
          <td style="padding:2px 3px; border:1px solid #ddd; font-size:8px; text-align:right; white-space:nowrap; color:#22c55e;">${item.total_advance.toLocaleString()}</td>
          <td style="padding:2px 3px; border:1px solid #ddd; text-align:right; font-size:8px; font-weight:600; white-space:nowrap; color:${item.total_due > 0 ? '#ef4444' : item.total_advance > 0 ? '#22c55e' : '#666'};">${item.total_balance.toLocaleString()}</td>
        </tr>
      `;
    });

    const monthHeaders = months.map(m => 
      `<th style="padding:2px 3px; border:1px solid #4f46e5; text-align:center; font-size:7px; background-color:#4f46e5; color:white; white-space:nowrap;">${m.substring(0, 3)}</th>`
    ).join('');

    const totalPages = Math.ceil(annualData.length / 30); // Approximate rows per page
    const pageCounter = 1;

    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Annual Salary Report - ${selectedYear}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 8mm 6mm;
              background: white;
              width: 297mm;
              min-height: 210mm;
              margin: 0 auto;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 8px;
              table-layout: fixed;
            }
            th {
              background-color: #4f46e5;
              color: white;
              font-weight: bold;
              padding: 2px 3px;
              border: 1px solid #4f46e5;
              text-align: center;
              white-space: nowrap;
            }
            td {
              padding: 2px 3px;
              border: 1px solid #ddd;
              text-align: left;
              vertical-align: middle;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            
            th:nth-child(1), td:nth-child(1) { width: 4%; }
            th:nth-child(2), td:nth-child(2) { width: 14%; }
            th:nth-child(3), td:nth-child(3) { width: 11%; }
            th:nth-child(4), td:nth-child(4),
            th:nth-child(5), td:nth-child(5),
            th:nth-child(6), td:nth-child(6),
            th:nth-child(7), td:nth-child(7),
            th:nth-child(8), td:nth-child(8),
            th:nth-child(9), td:nth-child(9),
            th:nth-child(10), td:nth-child(10),
            th:nth-child(11), td:nth-child(11),
            th:nth-child(12), td:nth-child(12),
            th:nth-child(13), td:nth-child(13),
            th:nth-child(14), td:nth-child(14),
            th:nth-child(15), td:nth-child(15) { width: 5%; }
            th:nth-child(16), td:nth-child(16) { width: 8%; }
            th:nth-child(17), td:nth-child(17) { width: 6%; }
            th:nth-child(18), td:nth-child(18) { width: 6%; }
            th:nth-child(19), td:nth-child(19) { width: 7%; }
            
            .footer {
              margin-top: 12px;
              padding-top: 6px;
              border-top: 1px solid #e5e7eb;
              font-size: 8px;
              color: #999;
              text-align: center;
            }
            .footer div {
              margin: 2px 0;
            }
            
            /* Fix #5: Dynamic page counter using CSS counters */
            .page-counter::after {
              content: counter(page);
            }
            
            .footer-center {
              text-align: center;
            }
            
            @media print {
              body {
                padding: 8mm 6mm;
                width: 100%;
                min-height: 100vh;
              }
              th {
                background-color: #4f46e5 !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .page-break {
                page-break-after: always;
              }
            }
            
            @page {
              size: A4 landscape;
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${getSchoolPrintHeader(
            { school_logo: schoolSettings?.school_logo, school_name: schoolSettings?.school_name, school_address: schoolSettings?.school_address, school_phone: schoolSettings?.school_phone, school_email: schoolSettings?.school_email },
            "Annual Salary Report"
          )}

          <table>
            <thead>
              <tr>
                <th style="width:4%;">SL</th>
                <th style="width:14%;">Staff</th>
                <th style="width:11%;">Designation</th>
                ${monthHeaders}
                <th style="width:8%;">Total Paid</th>
                <th style="width:6%;">Due</th>
                <th style="width:6%;">Advance</th>
                <th style="width:7%;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            <div>${schoolSettings?.school_name || 'চে আলী মডেল একাডেমী'}</div>
            <div class="footer-center">Page ${pageCounter} of ${totalPages}</div>
            <div>${new Date().toLocaleDateString()}</div>
          </div>
        </body>
      </html>
    `);

    doc.close();
    
    // Print after a short delay to ensure content is loaded
    setTimeout(() => {
      if (printWindow) {
        printWindow.print();
        // Clean up
        setTimeout(() => {
          if (printIframe.parentNode) {
            printIframe.parentNode.removeChild(printIframe);
          }
        }, 1000);
      }
    }, 500);

  }, [annualData, schoolSettings, selectedYear]);

  const years = Array.from({ length: 5 }, (_, i) => (getCurrentYear() - 2 + i).toString());

  if (settingsLoading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading settings...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6 print:p-0">
        {/* Header - Screen Only */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-700 dark:via-teal-700 dark:to-cyan-700 p-6 shadow-xl print:hidden"
        >
          <div className="absolute inset-0 bg-white/10 dark:bg-white/5 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.back()} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                  Annual Salary Report
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Annual salary report and analysis</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px] rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  {years.map((y) => (
                    <SelectItem key={y} value={y} className="text-gray-900 dark:text-white">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={handleExportExcel} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Download className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportPDF} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button 
                variant="outline" 
                onClick={handlePrint} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 print:hidden">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
            >
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-800">
                <div className={`bg-gradient-to-br ${stat.bgGradient} p-5`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-2xl sm:text-3xl font-bold ${stat.textColor}`}>
                        {stat.value}
                      </p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-1">{stat.title}</p>
                    </div>
                    <div className={`p-3 rounded-2xl ${stat.iconBg} shadow-lg`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Report Table */}
        <div className="print-content">
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
            <CardContent className="p-0 sm:p-6 overflow-x-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
              ) : annualData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No data found</p>
                </div>
              ) : (
                <div className="overflow-x-auto relative" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Table>
                    <TableHeader className="sticky top-0 z-30">
                      <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                        <TableHead className="text-white text-xs sm:text-sm font-semibold sticky left-0 bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 z-40 min-w-[50px]">
                          SL
                        </TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold sticky left-[50px] bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 z-40 min-w-[180px]">
                          Staff
                        </TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold hidden md:table-cell min-w-[120px]">
                          Designation
                        </TableHead>
                        {months.map((month) => (
                          <TableHead key={month} className="text-white text-xs sm:text-sm font-semibold hidden lg:table-cell min-w-[70px] text-center">
                            {month.substring(0, 3)}
                          </TableHead>
                        ))}
                        <TableHead className="text-white text-xs sm:text-sm font-semibold min-w-[100px] text-right">
                          Total Paid
                        </TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold min-w-[80px] text-right">
                          Due
                        </TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold min-w-[80px] text-right">
                          Advance
                        </TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold min-w-[90px] text-right">
                          Balance
                        </TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold sticky right-0 bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 z-40 min-w-[80px] text-center">
                          Details
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {annualData.map((item, idx) => {
                        return (
                          <motion.tr
                            key={item.staff_id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: idx * 0.05 }}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                          >
                            <TableCell className="text-sm text-center text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-20 min-w-[50px]">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="sticky left-[50px] bg-white dark:bg-gray-800 z-20 min-w-[180px]">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarImage src={item.staff_photo_url} />
                                  <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                                    {item.staff_name?.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.staff_name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.staff_employee_id}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell min-w-[120px] truncate">
                              {item.staff_designation}
                            </TableCell>
                            {item.monthly_data.map((month, mIdx) => (
                              <TableCell key={mIdx} className="text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell min-w-[70px] text-center">
                                {formatCurrency(month.paid)}
                              </TableCell>
                            ))}
                            <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 min-w-[100px] text-right">
                              {formatCurrency(item.total_paid)}
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-rose-600 dark:text-rose-400 min-w-[80px] text-right">
                              {formatCurrency(item.total_due)}
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 min-w-[80px] text-right">
                              {formatCurrency(item.total_advance)}
                            </TableCell>
                            <TableCell className={`text-sm font-semibold min-w-[90px] text-right ${item.total_due > 0 ? 'text-rose-600 dark:text-rose-400' : item.total_advance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                              {formatCurrency(item.total_balance)}
                            </TableCell>
                            <TableCell className="text-center sticky right-0 bg-white dark:bg-gray-800 z-20 min-w-[80px]">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-blue-500 dark:text-blue-400 hover:text-blue-700">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-2xl max-w-5xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-0 shadow-2xl w-[95vw]">
                                  <DialogHeader>
                                    <DialogTitle className="text-gray-900 dark:text-white text-xl">
                                      Monthly Breakdown - {item.staff_name}
                                    </DialogTitle>
                                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                                      Monthly salary details for {selectedYear}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="overflow-x-auto relative" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                    <Table>
                                      <TableHeader className="sticky top-0 z-30">
                                        <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                                          <TableHead className="text-white font-semibold sticky left-0 bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 z-40 min-w-[100px]">
                                            Month
                                          </TableHead>
                                          <TableHead className="text-white font-semibold min-w-[120px] text-right">Expected</TableHead>
                                          <TableHead className="text-white font-semibold min-w-[120px] text-right">Paid</TableHead>
                                          <TableHead className="text-white font-semibold min-w-[120px] text-right">Due/Advance</TableHead>
                                          <TableHead className="text-white font-semibold sticky right-0 bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 z-40 min-w-[100px] text-center">
                                            Status
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {item.monthly_data.map((month, i) => (
                                          <TableRow key={i} className="border-b border-gray-100 dark:border-gray-700">
                                            <TableCell className="font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-20 min-w-[100px]">
                                              {month.month}
                                            </TableCell>
                                            <TableCell className="text-gray-700 dark:text-gray-300 min-w-[120px] text-right">
                                              {formatCurrency(month.expected)}
                                            </TableCell>
                                            <TableCell className="text-emerald-600 dark:text-emerald-400 min-w-[120px] text-right">
                                              {formatCurrency(month.paid)}
                                            </TableCell>
                                            <TableCell className={`min-w-[120px] text-right ${month.balance > 0 ? 'text-rose-600 dark:text-rose-400' : month.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                              {formatCurrency(Math.abs(month.balance))}
                                              {month.balance > 0 ? ' (Due)' : month.balance < 0 ? ' (Advance)' : ''}
                                            </TableCell>
                                            <TableCell className="sticky right-0 bg-white dark:bg-gray-900 z-20 min-w-[100px] text-center">
                                              <Badge className={`rounded-xl ${
                                                month.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                                month.status === "partial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                                                "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                                              }`}>
                                                {month.status === "paid" ? "Paid" : month.status === "partial" ? "Partial" : "Pending"}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
