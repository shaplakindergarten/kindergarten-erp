// src/app/staff/salary/reports/monthly/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Download, Printer, Calendar, DollarSign, 
  Users, TrendingUp, TrendingDown, Filter, Search,
  FileText, PieChart, BarChart3, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, months, getCurrentMonth, getCurrentYear } from "@/lib/salary/salaryUtils";
import { PayrollReportCard } from "@/components/salary/PayrollReportCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface MonthlyReportData {
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_designation: string;
  staff_photo_url?: string;
  expected_salary: number;
  paid_amount: number;
  balance: number;
  payment_date?: string;
  payment_method?: string;
  status: string;
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

// বাংলা সংখ্যা কনভার্ট করার ফাংশন
const convertBengaliToEnglish = (str: string): string => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = '';
  for (let char of str) {
    const index = bengaliDigits.indexOf(char);
    if (index !== -1) {
      result += englishDigits[index];
    } else {
      result += char;
    }
  }
  return result;
};

// কাস্টম নাম্বার ইনপুট হুক
const useNumberInput = (initialValue: string = '') => {
  const [value, setValue] = useState(initialValue);
  const [displayValue, setDisplayValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value;
    let englishValue = convertBengaliToEnglish(rawValue);
    const cleaned = englishValue.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    let finalValue = cleaned;
    if (parts.length > 2) {
      finalValue = parts[0] + '.' + parts.slice(1).join('');
    }
    setValue(finalValue);
    setDisplayValue(rawValue);
  };

  const handleFocus = () => {
    if (value === '0' || value === '0.00' || value === '') {
      setValue('');
      setDisplayValue('');
    }
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 10);
  };

  const handleBlur = () => {
    if (value === '' || value === '.') {
      setValue('0');
      setDisplayValue('0');
    }
  };

  return {
    value,
    displayValue,
    setValue,
    setDisplayValue,
    handleChange,
    handleFocus,
    handleBlur,
    inputRef
  };
};

// নাম্বার ইনপুট ফিল্ড কম্পোনেন্ট
const NumberInputField = ({ 
  label, 
  placeholder, 
  value, 
  onChange 
}: any) => {
  const {
    value: internalValue,
    displayValue,
    setValue,
    setDisplayValue,
    handleChange,
    handleFocus,
    handleBlur,
    inputRef
  } = useNumberInput(value);

  useEffect(() => {
    if (value !== internalValue) {
      setValue(value);
      setDisplayValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (onChange) {
      onChange(internalValue);
    }
  }, [internalValue]);

  return (
    <div className="space-y-1">
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Label>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-right font-mono"
        autoComplete="off"
        dir="ltr"
      />
    </div>
  );
};

export default function MonthlyReportPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [reportData, setReportData] = useState<MonthlyReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear().toString());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // মাসের নাম থেকে নাম্বার বের করার জন্য হেল্পার
  const monthIndex = months.indexOf(selectedMonth) + 1 || new Date().getMonth() + 1;

  useEffect(() => {
    loadReport();
    loadSchoolSettings();
  }, [selectedMonth, selectedYear]);

  async function loadSchoolSettings() {
    setSettingsLoading(true);
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error) {
        console.error("Error fetching school settings:", error);
        setSchoolSettings({
          id: 0,
          school_name: "Shapla Kindergarten & Pre-cadet",
          school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
          school_phone: "01923253454",
          school_email: "shapla.kindergarten@gmail.com",
          school_logo: "",
          school_watermark: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else if (data) {
        setSchoolSettings(data);
      } else {
        setSchoolSettings({
          id: 0,
          school_name: "Shapla Kindergarten & Pre-cadet",
          school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
          school_phone: "01923253454",
          school_email: "shapla.kindergarten@gmail.com",
          school_logo: "",
          school_watermark: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error loading school settings:", error);
      setSchoolSettings({
        id: 0,
        school_name: "Shapla Kindergarten & Pre-cadet",
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
  }

  async function loadReport() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [staffData, balancesData, paymentsData] = await Promise.all([
        getStaff(),
        supabase
          .from("salary_balances")
          .select("*, staff:staff_id(name, employee_id, designation, photo_url)")
          .eq("month", selectedMonth)
          .eq("year", parseInt(selectedYear)),
        supabase
          .from("salary_payments")
          .select("*, staff:staff_id(name)")
          .eq("month", selectedMonth)
          .eq("year", parseInt(selectedYear)),
      ]);

      setStaff(staffData || []);

      const report: MonthlyReportData[] = [];

      for (const staffMember of staffData || []) {
        const balance = balancesData.data?.find((b: any) => b.staff_id === staffMember.id);
        const payment = paymentsData.data?.find((p: any) => p.staff_id === staffMember.id);
        
        // ✅ FIX: Skip staff if month is entirely before their joining date
        if (staffMember.joining_date) {
          const monthIdx = months.indexOf(selectedMonth);
          const monthEnd = new Date(parseInt(selectedYear), monthIdx + 1, 0);
          const joining = new Date(staffMember.joining_date);
          if (monthEnd < joining) continue;
        }
        
        // ✅ FIX: Skip staff if month is entirely after their resign date
        if (staffMember.resign_date) {
          const monthIdx = months.indexOf(selectedMonth);
          const monthStart = new Date(parseInt(selectedYear), monthIdx, 1);
          const resign = new Date(staffMember.resign_date);
          if (monthStart > resign) continue;
        }
        
        // ✅ FIX: Use salary_balances.expected_salary (already business-rule applied)
        const expectedSalary = balance?.expected_salary || 0;
        const paidAmount = payment?.amount || balance?.paid_amount || 0;
        const balanceAmount = expectedSalary - paidAmount;

        report.push({
          staff_id: staffMember.id,
          staff_name: staffMember.name,
          staff_employee_id: staffMember.employee_id,
          staff_designation: staffMember.designation,
          staff_photo_url: staffMember.photo_url,
          expected_salary: expectedSalary,  // ✅ Now correct (uses business-rule applied value)
          paid_amount: paidAmount,
          balance: balanceAmount,
          payment_date: payment?.payment_date,
          payment_method: payment?.payment_method,
          status: balance?.status || (payment ? "paid" : "pending"),
        });
      }

      setReportData(report);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = reportData.filter(item => {
    if (searchTerm && !item.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.staff_employee_id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const statistics = {
    paidCount: filteredData.filter(item => item.status === "paid").length,
    partialCount: filteredData.filter(item => item.status === "partial").length,
    pendingCount: filteredData.filter(item => item.status === "pending").length,
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      "Staff ID": item.staff_employee_id,
      "Staff Name": item.staff_name,
      "Designation": item.staff_designation,
      "Expected Salary": item.expected_salary,
      "Paid Amount": item.paid_amount,
      "Balance": item.balance,
      "Payment Date": item.payment_date || "-",
      "Payment Method": item.payment_method || "-",
      "Status": item.status === "paid" ? "Paid" : item.status === "partial" ? "Partial" : "Pending",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Report");
    XLSX.writeFile(wb, `salary_report_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const margin = 14;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);
    const pageHeight = doc.internal.pageSize.height;
    
    const settings = schoolSettings || {
      school_name: "Shapla Kindergarten & Pre-cadet",
      school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
      school_phone: "01923253454",
      school_email: "shapla.kindergarten@gmail.com",
      school_logo: "",
    };
    
    let yOffset = margin;
    let logoHeight = 0;
    let logoWidth = 0;
    let textStartX = margin;
    let textY = yOffset + 3;
    
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
        textStartX = margin + logoWidth + 8;
      } catch (err) {
        console.error("Logo load error:", err);
      }
    }
    
    if (settings?.school_name) {
      doc.setFontSize(14);
      doc.setTextColor(99, 102, 241);
      doc.text(settings.school_name, textStartX, textY);
      textY += 7;
    }
    
    if (settings?.school_address) {
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const addressLines = doc.splitTextToSize(settings.school_address, contentWidth - 30);
      doc.text(addressLines, textStartX, textY);
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
      doc.text(contactText, textStartX, textY);
      textY += 4;
    }
    
    yOffset = Math.max(yOffset + logoHeight + 2, textY + 2);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yOffset, pageWidth - margin, yOffset);
    yOffset += 6;
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Monthly Salary Report", margin, yOffset);
    yOffset += 6;
    
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`${selectedMonth} ${selectedYear}`, margin, yOffset);
    yOffset += 4.5;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yOffset);
    yOffset += 8;
    
    const tableData = filteredData.map(item => [
      item.staff_employee_id,
      item.staff_name,
      item.staff_designation,
      `BDT ${item.expected_salary.toLocaleString('en-US')}`,
      `BDT ${item.paid_amount.toLocaleString('en-US')}`,
      `BDT ${Math.abs(item.balance).toLocaleString('en-US')}`,
      item.status === "paid" ? "Paid" : item.status === "partial" ? "Partial" : "Pending",
    ]);

    autoTable(doc, {
      head: [["ID", "Name", "Designation", "Expected", "Paid", "Balance", "Status"]],
      body: tableData,
      startY: yOffset,
      margin: { left: margin, right: margin, top: yOffset, bottom: 20 },
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 25, halign: 'left' },
        2: { cellWidth: 25, halign: 'left' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 16, halign: 'center' },
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        
        if (settings?.school_name) {
          doc.text(
            settings.school_name,
            margin,
            pageHeight - 6,
            { align: 'left' }
          );
        }
        
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 6,
          { align: 'center' }
        );
        
        doc.text(
          `Generated: ${new Date().toLocaleDateString()}`,
          pageWidth - margin,
          pageHeight - 6,
          { align: 'right' }
        );
      },
    });

    doc.save(`salary_report_${selectedMonth}_${selectedYear}.pdf`);
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const tableRows = filteredData.map(item => {
      const photoHtml = item.staff_photo_url 
        ? `<img src="${item.staff_photo_url}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" />`
        : `<div style="width:32px; height:32px; border-radius:50%; background:#e0e7ff; display:flex; align-items:center; justify-content:center; color:#4f46e5; font-weight:bold; font-size:14px;">${item.staff_name?.charAt(0).toUpperCase()}</div>`;
      
      const statusColor = item.status === "paid" ? "#22c55e" : 
                          item.status === "partial" ? "#eab308" : "#ef4444";
      const statusText = item.status === "paid" ? "Paid" : 
                         item.status === "partial" ? "Partial" : "Pending";
      
      return `
        <tr>
          <td style="padding:6px; border:1px solid #ddd; text-align:left;">
            <div style="display:flex; align-items:center; gap:8px;">
              ${photoHtml}
              <div>
                <div style="font-weight:500; font-size:12px;">${item.staff_name}</div>
                <div style="font-size:10px; color:#666;">${item.staff_employee_id}</div>
              </div>
            </div>
          </td>
          <td style="padding:6px; border:1px solid #ddd; text-align:left; font-size:12px;">${item.staff_designation}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:right; font-size:12px;">BDT ${item.expected_salary.toLocaleString()}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:right; font-size:12px; color:#22c55e; font-weight:600;">BDT ${item.paid_amount.toLocaleString()}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:right; font-size:12px; font-weight:600; color:${item.balance > 0 ? '#ef4444' : item.balance < 0 ? '#22c55e' : '#666'};">BDT ${Math.abs(item.balance).toLocaleString()}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center; font-size:12px;">
            <span style="background:${statusColor}; color:white; padding:2px 10px; border-radius:12px; font-size:11px; display:inline-block;">${statusText}</span>
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Monthly Salary Report - ${selectedMonth} ${selectedYear}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 15mm 10mm;
              background: white;
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
            }
            .report-title {
              font-size: 16px;
              font-weight: bold;
              margin-top: 10px;
              margin-bottom: 3px;
            }
            .report-subtitle {
              font-size: 11px;
              color: #666;
              margin-bottom: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
              font-size: 12px;
            }
            th {
              background-color: #4f46e5;
              color: white;
              font-weight: bold;
              padding: 8px 6px;
              border: 1px solid #4f46e5;
              text-align: left;
            }
            th:first-child { text-align: left; }
            th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
            th:last-child { text-align: center; }
            
            td {
              padding: 6px;
              border: 1px solid #ddd;
              text-align: left;
              vertical-align: middle;
            }
            td:first-child, td:nth-child(2) { text-align: left; }
            td:nth-child(3), td:nth-child(4), td:nth-child(5), td:last-child { text-align: right; }
            td:last-child { text-align: center; }
            
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e5e7eb;
              font-size: 10px;
              color: #999;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .footer-left { text-align: left; }
            .footer-center { text-align: center; }
            .footer-right { text-align: right; }
            
            @media print {
              body {
                padding: 15mm 10mm;
                width: 100%;
                min-height: 100vh;
              }
              .no-print { display: none !important; }
              th {
                background-color: #4f46e5 !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              td span {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            
            @page {
              size: A4;
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${getSchoolPrintHeader(
            { school_logo: schoolSettings?.school_logo, school_name: schoolSettings?.school_name, school_address: schoolSettings?.school_address, school_phone: schoolSettings?.school_phone, school_email: schoolSettings?.school_email },
            "Monthly Salary Report"
          )}

          <div class="report-title">${selectedMonth} ${selectedYear}</div>
          <div class="report-subtitle">Generated: ${new Date().toLocaleDateString()}</div>

          <table>
            <thead>
              <tr>
                <th style="width:25%;">Staff</th>
                <th style="width:20%;">Designation</th>
                <th style="width:15%; text-align:right;">Expected</th>
                <th style="width:15%; text-align:right;">Paid</th>
                <th style="width:15%; text-align:right;">Balance</th>
                <th style="width:10%; text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            <div class="footer-left">${schoolSettings?.school_name || 'Shapla Kindergarten & Pre-cadet'}</div>
            <div class="footer-center">Page 1 of 1</div>
            <div class="footer-right">${new Date().toLocaleDateString()}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 1500);
  };

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

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6 print:p-0">
        {/* Header - Vibrant Gradient */}
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
                  Monthly Salary Report
                </h1>
                <p className="text-white/80 text-sm drop-shadow">View and download monthly salary report</p>
              </div>
            </div>
            <div className="flex gap-2">
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

        {/* Filters */}
        <Card className="border-0 shadow-md rounded-2xl mt-6 print:hidden bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[150px] rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    {months.map((m) => (
                      <SelectItem key={m} value={m} className="text-gray-900 dark:text-white">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px] rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    {years.map((y) => (
                      <SelectItem key={y} value={y} className="text-gray-900 dark:text-white">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <Input
                  placeholder="Search by staff name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px] rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="all" className="text-gray-900 dark:text-white">All</SelectItem>
                  <SelectItem value="paid" className="text-gray-900 dark:text-white">Paid</SelectItem>
                  <SelectItem value="partial" className="text-gray-900 dark:text-white">Partial</SelectItem>
                  <SelectItem value="pending" className="text-gray-900 dark:text-white">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Payroll Report Card (RPC Integration) */}
        <div className="mt-6 print:hidden">
          <PayrollReportCard month={monthIndex} year={parseInt(selectedYear)} />
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-3 mt-6 print:hidden">
          <Card className="border-0 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{statistics.paidCount}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Paid</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-amber-50 dark:bg-amber-950/30 rounded-2xl">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{statistics.partialCount}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Partial</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-rose-50 dark:bg-rose-950/30 rounded-2xl">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{statistics.pendingCount}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Table */}
        <div className="print-content">
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 p-4 print:hidden">
              <CardHeader className="p-0">
                <CardTitle className="text-white text-lg font-semibold">Salary Report - {selectedMonth} {selectedYear}</CardTitle>
                <CardDescription className="text-white/70 text-sm">Detailed monthly salary payment report</CardDescription>
              </CardHeader>
            </div>
            
            <CardContent className="p-0 sm:p-6 overflow-x-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No data found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Staff</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold hidden md:table-cell">Designation</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Expected</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Paid</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Balance</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold hidden lg:table-cell">Date</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item, idx) => (
                        <motion.tr
                          key={item.staff_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.02 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={item.staff_photo_url} />
                                <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                                  {item.staff_name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm text-gray-900 dark:text-white">{item.staff_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.staff_employee_id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">{item.staff_designation}</TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300">{formatCurrency(item.expected_salary)}</TableCell>
                          <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.paid_amount)}</TableCell>
                          <TableCell className={`text-sm font-semibold ${item.balance > 0 ? 'text-rose-600 dark:text-rose-400' : item.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {formatCurrency(Math.abs(item.balance))} {item.balance > 0 ? '(Due)' : item.balance < 0 ? '(Advance)' : ''}
                          </TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell">{item.payment_date ? new Date(item.payment_date).toLocaleDateString("en-CA") : "-"}</TableCell>
                          <TableCell>
                            <Badge className={`rounded-xl ${
                              item.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                              item.status === "partial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                              "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                            }`}>
                              {item.status === "paid" ? "Paid" : item.status === "partial" ? "Partial" : "Pending"}
                            </Badge>
                          </TableCell>
                        </motion.tr>
                      ))}
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