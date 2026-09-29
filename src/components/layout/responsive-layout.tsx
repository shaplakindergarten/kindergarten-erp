"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, Coins, Boxes, FileText, Settings,
  LogOut, Menu, X, ChevronRight, Bell, Search, Moon, Sun, User, ShieldCheck, TrendingUp,
  AlertCircle, Calendar, ClipboardCheck, Download, Megaphone, History, UserPlus, UserCheck,
  Upload, FolderTree, Printer, CreditCard, Award, Percent, BookMarked, Receipt, Package,
  ShoppingCart, Banknote, ArrowRightLeft, PieChart, Clock, Sparkles, CheckSquare, ScrollText,
  TableProperties, Lock, Send, BookOpen, Gift, Loader2, Activity, TrendingDown,
  Wallet, DollarSign, Bookmark, FileBarChart, Building2, Trophy, ScanFace, CalendarDays, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
  roles?: string[];
  badgeCount?: number;         // 🆕 Optional badge count (runtime injected)
  badgeColor?: string;         // 🆕 Optional badge color class
}

interface SchoolSettings {
  school_name: string;
  school_subtitle: string;
  school_logo: string | null;
  school_address: string | null;
  school_phone: string | null;
  school_email: string | null;
  theme_primary_color: string;
  theme_secondary_color: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  role: string;
  initials: string;
  avatar: string;
  isLoading: boolean;
}

// ═══════════════════════════════════════════════════════
// COMPLETE NAVIGATION
// ═══════════════════════════════════════════════════════
const navigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ["admin", "teacher", "staff"],
  },
  // 🆕 Pending Admissions — badge injected at runtime
  {
    title: "Pending Admissions",
    href: "/dashboard/admissions",
    icon: <UserPlus className="h-5 w-5" />,
    roles: ["admin", "teacher"],
  },
  {
    title: "Student Management",
    href: "/students",
    icon: <Users className="h-5 w-5" />,
    roles: ["admin", "teacher", "staff"],
    children: [
      { title: "New Admission", href: "/students/new", icon: <UserPlus className="h-4 w-4" />, roles: ["admin"] },
      { title: "Student List", href: "/students/list", icon: <UserCheck className="h-4 w-4" />, roles: ["admin", "teacher", "staff"] },
      { title: "Pending Admissions", href: "/students/pending", icon: <UserPlus className="h-4 w-4" />, roles: ["admin", "teacher"] },
      { title: "Bulk Upload", href: "/students/bulk-upload", icon: <Upload className="h-4 w-4" />, roles: ["admin"] },
      { title: "Promotion", href: "/students/promotion", icon: <TrendingUp className="h-4 w-4" />, roles: ["admin"] },
      { title: "Class Setup", href: "/students/classes", icon: <FolderTree className="h-4 w-4" />, roles: ["admin"] },
      { title: "Print Reports", href: "/students/print-reports", icon: <Printer className="h-4 w-4" />, roles: ["admin", "teacher", "staff"] },
    ],
  },
  {
    title: "Teacher & Staff",
    href: "/staff",
    icon: <GraduationCap className="h-5 w-5" />,
    roles: ["admin", "teacher", "staff"],
    children: [
      { title: "Add Staff", href: "/staff/new", icon: <UserPlus className="h-4 w-4" />, roles: ["admin"] },
      { title: "Staff List", href: "/staff/list", icon: <UserCheck className="h-4 w-4" />, roles: ["admin", "teacher"] },
      { title: "Vacations", href: "/staff/vacations", icon: <Calendar className="h-4 w-4" />, roles: ["admin", "teacher", "staff"] },
      {
        title: "Salary",
        href: "/staff/salary",
        icon: <DollarSign className="h-4 w-4" />,
        roles: ["admin"],
        children: [
          { title: "Dashboard", href: "/staff/salary", icon: <LayoutDashboard className="h-3 w-3" />, roles: ["admin"] },
          { title: "Staff Salary", href: "/staff/salary/staff-salary", icon: <Users className="h-3 w-3" />, roles: ["admin"] },
          { title: "Categories", href: "/staff/salary/categories", icon: <Settings className="h-3 w-3" />, roles: ["admin"] },
          { title: "Salary Payment", href: "/staff/salary/payment", icon: <DollarSign className="h-3 w-3" />, roles: ["admin"] },
          { title: "Pay Slip", href: "/staff/salary/pay-slip", icon: <FileText className="h-3 w-3" />, roles: ["admin"] },
          { title: "Advance & Loan", href: "/staff/salary/advance", icon: <CreditCard className="h-3 w-3 text-white" />, roles: ["admin"] },
          { title: "Increment", href: "/staff/salary/increment", icon: <TrendingUp className="h-3 w-3" />, roles: ["admin"] },
          { title: "Promotion", href: "/staff/salary/promotion", icon: <Award className="h-3 w-3" />, roles: ["admin"] },
          { title: "Notifications", href: "/staff/salary/notifications", icon: <Bell className="h-3 w-3" />, roles: ["admin"] },
          {
            title: "Reports",
            href: "/staff/salary/reports",
            icon: <FileBarChart className="h-3 w-3" />,
            roles: ["admin"],
            children: [
              { title: "Monthly Report", href: "/staff/salary/reports/monthly", icon: <Calendar className="h-2.5 w-2.5" />, roles: ["admin"] },
              { title: "Annual Report", href: "/staff/salary/reports/annual", icon: <CalendarDays className="h-2.5 w-2.5" />, roles: ["admin"] },
              { title: "Staff-wise Report", href: "/staff/salary/reports/staff-wise", icon: <Users className="h-2.5 w-2.5" />, roles: ["admin"] },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Fees Management",
    href: "/fees",
    icon: <Wallet className="h-5 w-5" />,
    roles: ["admin", "accountant"],
    children: [
      { title: "Dashboard", href: "/fees", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["admin", "accountant"] },
      {
        title: "Setup",
        href: "/fees/setup",
        icon: <Settings className="h-4 w-4" />,
        roles: ["admin"],
        children: [
          { title: "Fee Categories", href: "/fees/categories", icon: <Bookmark className="h-4 w-4" />, roles: ["admin"] },
          { title: "Fee Structure", href: "/fees/structure", icon: <FolderTree className="h-4 w-4" />, roles: ["admin"] },
          { title: "Fine Rules", href: "/fees/fine", icon: <AlertCircle className="h-4 w-4" />, roles: ["admin"] },
          { title: "Discounts", href: "/fees/discounts", icon: <Gift className="h-4 w-4" />, roles: ["admin"] },
        ],
      },
      {
        title: "Advanced",
        href: "/fees/advanced",
        icon: <ShieldCheck className="h-4 w-4" />,
        roles: ["admin"],
        children: [{ title: "Fee Assignment", href: "/fees/assign", icon: <UserPlus className="h-4 w-4" />, roles: ["admin"] }],
      },
      { title: "Receive Fees", href: "/fees/receive", icon: <Receipt className="h-4 w-4" />, roles: ["admin", "accountant"] },
      { title: "Fees Ledger", href: "/fees/ledger", icon: <BookMarked className="h-4 w-4" />, roles: ["admin", "accountant"] },
      { title: "Due List", href: "/fees/due", icon: <Bell className="h-4 w-4" />, roles: ["admin", "accountant"] },
      {
        title: "Reports",
        href: "/fees/reports",
        icon: <FileBarChart className="h-4 w-4" />,
        roles: ["admin", "accountant"],
        children: [
          { title: "Master Fee Ledger", href: "/fees/reports/master-ledger", icon: <FileBarChart className="h-4 w-4" />, roles: ["admin", "accountant"] },
          { title: "Daily Collection", href: "/fees/reports/daily", icon: <Calendar className="h-4 w-4" />, roles: ["admin", "accountant"] },
          { title: "Monthly Report", href: "/fees/reports/monthly", icon: <Calendar className="h-4 w-4" />, roles: ["admin", "accountant"] },
          { title: "Class-wise Collection", href: "/fees/reports/class-wise", icon: <Users className="h-4 w-4" />, roles: ["admin", "accountant"] },
          { title: "Student-wise Ledger", href: "/fees/reports/student-ledger", icon: <UserCheck className="h-4 w-4" />, roles: ["admin", "accountant"] },
          { title: "Due Summary", href: "/fees/reports/due-summary", icon: <AlertCircle className="h-4 w-4" />, roles: ["admin", "accountant"] },
          { title: "Outstanding", href: "/fees/reports/outstanding", icon: <AlertCircle className="h-4 w-4" />, roles: ["admin", "accountant"] },
          { title: "Year Closing", href: "/fees/reports/year-closing", icon: <Calendar className="h-4 w-4" />, roles: ["admin"] },
        ],
      },
    ],
  },
  {
    title: "Attendance",
    href: "/attendance",
    icon: <ClipboardCheck className="h-5 w-5" />,
    roles: ["admin", "teacher", "staff"],
    children: [
      { title: "Student Attendance", href: "/attendance/students", icon: <Users className="h-4 w-4" />, roles: ["admin", "teacher"] },
      { title: "Staff Attendance", href: "/attendance/staff", icon: <GraduationCap className="h-4 w-4" />, roles: ["admin"] },
      { title: "Holidays", href: "/attendance/holidays", icon: <CalendarDays className="h-4 w-4" />, roles: ["admin", "teacher"] },
      { title: "Student Leave", href: "/attendance/student-leave", icon: <ShieldCheck className="h-4 w-4" />, roles: ["admin", "teacher", "staff"] },
      { title: "Leave Approval", href: "/attendance/leave-approval", icon: <CheckSquare className="h-4 w-4" />, roles: ["admin", "teacher"] },
      { title: "Device Sync", href: "/attendance/devices", icon: <ScanFace className="h-4 w-4" />, roles: ["admin"] },
      {
        title: "Reports",
        href: "/attendance/reports",
        icon: <FileBarChart className="h-4 w-4" />,
        roles: ["admin", "teacher"],
        children: [
          { title: "Daily Report", href: "/attendance/reports/daily", icon: <Calendar className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Monthly Report", href: "/attendance/reports/monthly", icon: <Calendar className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Yearly Report", href: "/attendance/reports/yearly", icon: <CalendarDays className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Class-wise Report", href: "/attendance/reports/class-wise", icon: <Users className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Section-wise Report", href: "/attendance/reports/section-wise", icon: <Building2 className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Student-wise Report", href: "/attendance/reports/student-wise", icon: <UserCheck className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Staff-wise Report", href: "/attendance/reports/staff-wise", icon: <GraduationCap className="h-3 w-3" />, roles: ["admin"] },
          { title: "Late Summary", href: "/attendance/reports/late-summary", icon: <Clock className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Absent Summary", href: "/attendance/reports/absent-summary", icon: <AlertCircle className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Attendance Percentage", href: "/attendance/reports/attendance-percentage", icon: <Percent className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Top Attendance", href: "/attendance/reports/top-attendance", icon: <Trophy className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Low Attendance", href: "/attendance/reports/low-attendance", icon: <TrendingDown className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Biometric Logs", href: "/attendance/reports/biometric-log", icon: <ScanFace className="h-3 w-3" />, roles: ["admin"] },
          { title: "Export Center", href: "/attendance/reports/export-center", icon: <Download className="h-3 w-3" />, roles: ["admin"] },
        ],
      },
      { title: "Analytics", href: "/attendance/analytics", icon: <Activity className="h-4 w-4" />, roles: ["admin", "teacher"] },
      { title: "Settings", href: "/attendance/settings", icon: <Settings className="h-4 w-4" />, roles: ["admin"] },
    ],
  },
  {
    title: "Examination",
    href: "/exams",
    icon: <FileText className="h-5 w-5" />,
    roles: ["admin", "teacher", "staff"],
    children: [
      { title: "Exam Dashboard", href: "/exams/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["admin", "teacher", "staff"] },
      {
        title: "Exam Setup",
        href: "/exams/setup",
        icon: <Settings className="h-4 w-4" />,
        roles: ["admin"],
        children: [
          { title: "Exam Terms", href: "/exams/setup/terms", icon: <Calendar className="h-3 w-3" />, roles: ["admin"] },
          { title: "Subject Assignment", href: "/exams/setup/subjects", icon: <BookMarked className="h-3 w-3" />, roles: ["admin"] },
          { title: "Grade System", href: "/exams/setup/grades", icon: <Award className="h-3 w-3" />, roles: ["admin"] },
        ],
      },
      {
        title: "Marks Management",
        href: "/exams/marks",
        icon: <ClipboardCheck className="h-4 w-4" />,
        roles: ["admin", "teacher", "staff"],
        children: [
          { title: "Marks Entry", href: "/exams/marks/entry", icon: <FileText className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Submit Marks", href: "/exams/marks/submit", icon: <Upload className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Verify Marks", href: "/exams/marks/verify", icon: <ShieldCheck className="h-3 w-3" />, roles: ["admin"] },
          { title: "Lock Marks", href: "/exams/marks/lock", icon: <Lock className="h-3 w-3" />, roles: ["admin"] },
        ],
      },
      {
        title: "Result Processing",
        href: "/exams/results",
        icon: <TrendingUp className="h-4 w-4" />,
        roles: ["admin", "teacher"],
        children: [
          { title: "Generate Result", href: "/exams/results/generate", icon: <Sparkles className="h-3 w-3" />, roles: ["admin"] },
          { title: "Publish Result", href: "/exams/results/publish", icon: <Bell className="h-3 w-3" />, roles: ["admin"] },
          { title: "Result Dashboard", href: "/exams/results/dashboard", icon: <LayoutDashboard className="h-3 w-3" />, roles: ["admin", "teacher"] },
        ],
      },
      {
        title: "Reports",
        href: "/exams/reports",
        icon: <FileBarChart className="h-4 w-4" />,
        roles: ["admin", "teacher"],
        children: [
          { title: "Tabulation Sheet", href: "/exams/reports/tabulation", icon: <TableProperties className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Progress Card", href: "/exams/reports/progress-card", icon: <TrendingUp className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Transcript", href: "/exams/reports/transcript", icon: <ScrollText className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Merit List", href: "/exams/reports/merit-list", icon: <Trophy className="h-3 w-3" />, roles: ["admin", "teacher"] },
          { title: "Fail List", href: "/exams/reports/fail-list", icon: <AlertCircle className="h-3 w-3" />, roles: ["admin", "teacher"] },
        ],
      },
      {
        title: "Certificates",
        href: "/exams/certificates",
        icon: <Award className="h-4 w-4" />,
        roles: ["admin"],
        children: [
          { title: "Certificate Templates", href: "/exams/certificates/templates", icon: <FileText className="h-3 w-3" />, roles: ["admin"] },
          { title: "Generate Certificates", href: "/exams/certificates/generate", icon: <Sparkles className="h-3 w-3" />, roles: ["admin"] },
        ],
      },
      {
        title: "Exam Settings",
        href: "/exams/settings",
        icon: <Settings className="h-4 w-4" />,
        roles: ["admin"],
        children: [
          { title: "GPA Rules", href: "/exams/settings/gpa-rules", icon: <Percent className="h-3 w-3" />, roles: ["admin"] },
          { title: "Position Rules", href: "/exams/settings/position-rules", icon: <Trophy className="h-3 w-3" />, roles: ["admin"] },
          { title: "Pass Rules", href: "/exams/settings/pass-rules", icon: <CheckSquare className="h-3 w-3" />, roles: ["admin"] },
          { title: "Print Settings", href: "/exams/settings/print", icon: <Printer className="h-3 w-3" />, roles: ["admin"] },
        ],
      },
    ],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: <Package className="h-5 w-5" />,
    roles: ["admin", "store", "accountant"],
    children: [
      { title: "Dashboard", href: "/inventory", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["admin", "store", "accountant"] },
      { title: "Items/Products", href: "/inventory/items", icon: <Package className="h-4 w-4" />, roles: ["admin", "store", "accountant"] },
      { title: "Suppliers", href: "/inventory/suppliers", icon: <UserPlus className="h-4 w-4" />, roles: ["admin", "store", "accountant"] },
      { title: "Purchases", href: "/inventory/purchases", icon: <ShoppingCart className="h-4 w-4" />, roles: ["admin", "store", "accountant"] },
      { title: "Issuances", href: "/inventory/issuances", icon: <ShieldCheck className="h-4 w-4" />, roles: ["admin", "store", "accountant"] },
      { title: "Sales", href: "/inventory/sales", icon: <DollarSign className="h-4 w-4" />, roles: ["admin", "store", "accountant"] },
      {
        title: "Reports",
        href: "/inventory/reports",
        icon: <FileBarChart className="h-4 w-4" />,
        roles: ["admin", "store", "accountant"],
        children: [
          { title: "Overview", href: "/inventory/reports", icon: <LayoutDashboard className="h-3 w-3" />, roles: ["admin", "store", "accountant"] },
          { title: "Purchase Report", href: "/inventory/reports/purchase", icon: <ShoppingCart className="h-3 w-3" />, roles: ["admin", "store", "accountant"] },
          { title: "Stock Report", href: "/inventory/reports/stock", icon: <Package className="h-3 w-3" />, roles: ["admin", "store", "accountant"] },
          { title: "Sales Report", href: "/inventory/reports/sales", icon: <DollarSign className="h-3 w-3" />, roles: ["admin", "store", "accountant"] },
          { title: "Issue Report", href: "/inventory/reports/issue", icon: <FileText className="h-3 w-3" />, roles: ["admin", "store", "accountant"] },
        ],
      },
    ],
  },
  {
    title: "Finance",
    href: "/finance",
    icon: <DollarSign className="h-5 w-5" />,
    roles: ["admin", "accountant"],
    children: [
      { title: "Dashboard", href: "/finance", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["admin", "accountant"] },
      {
        title: "Transactions",
        href: "/finance/transactions",
        icon: <Receipt className="h-4 w-4" />,
        roles: ["admin", "accountant"],
        children: [
          { title: "All Vouchers", href: "/finance/transactions", icon: <FileText className="h-3 w-3" />, roles: ["admin", "accountant"] },
          { title: "New Voucher", href: "/finance/transactions/new", icon: <Plus className="h-3 w-3" />, roles: ["admin", "accountant"] },
        ],
      },
      { title: "Income", href: "/finance/income", icon: <TrendingUp className="h-4 w-4" />, roles: ["admin", "accountant"] },
      { title: "Expense", href: "/finance/expense", icon: <TrendingDown className="h-4 w-4" />, roles: ["admin", "accountant"] },
      { title: "Transfer", href: "/finance/transfer", icon: <ArrowRightLeft className="h-4 w-4" />, roles: ["admin", "accountant"] },
      { title: "Chart of Accounts", href: "/finance/accounts", icon: <BookOpen className="h-4 w-4" />, roles: ["admin", "accountant"] },
      { title: "Bank & Cash", href: "/finance/bank-cash", icon: <Banknote className="h-4 w-4" />, roles: ["admin", "accountant"] },
      {
        title: "Reports",
        href: "/finance/reports",
        icon: <FileBarChart className="h-4 w-4" />,
        roles: ["admin", "accountant"],
        children: [
          { title: "Cashbook", href: "/finance/reports/cashbook", icon: <FileText className="h-3 w-3" />, roles: ["admin", "accountant"] },
          { title: "General Ledger", href: "/finance/reports/general-ledger", icon: <BookOpen className="h-3 w-3" />, roles: ["admin", "accountant"] },
          { title: "Trial Balance", href: "/finance/reports/trial-balance", icon: <DollarSign className="h-3 w-3" />, roles: ["admin", "accountant"] },
          { title: "Income Statement", href: "/finance/reports/income-statement", icon: <TrendingUp className="h-3 w-3" />, roles: ["admin", "accountant"] },
          { title: "Balance Sheet", href: "/finance/reports/balance-sheet", icon: <DollarSign className="h-3 w-3" />, roles: ["admin", "accountant"] },
          { title: "Source-wise Report", href: "/finance/reports/source-wise", icon: <PieChart className="h-3 w-3" />, roles: ["admin", "accountant"] },
        ],
      },
    ],
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: <Bell className="h-5 w-5" />,
    roles: ["admin"],
    children: [
      { title: "Dashboard", href: "/notifications", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["admin"] },
      { title: "Send Notification", href: "/notifications/send", icon: <Send className="h-4 w-4" />, roles: ["admin"] },
      { title: "Notice Board", href: "/notifications/notice", icon: <Megaphone className="h-4 w-4" />, roles: ["admin"] },
      { title: "Notification History", href: "/notifications/history", icon: <History className="h-4 w-4" />, roles: ["admin"] },
    ],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: <FileBarChart className="h-5 w-5" />,
    roles: ["admin"],
    children: [
      { title: "Admit Card", href: "/reports/admit", icon: <BookOpen className="h-4 w-4" />, roles: ["admin"] },
      { title: "ID Card", href: "/reports/idcard", icon: <GraduationCap className="h-4 w-4" />, roles: ["admin"] },
      { title: "Transfer Certificate", href: "/reports/tc", icon: <FileText className="h-4 w-4" />, roles: ["admin"] },
      { title: "Testimonial", href: "/reports/testimonial", icon: <Award className="h-4 w-4" />, roles: ["admin"] },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: <Settings className="h-5 w-5" />,
    roles: ["admin"],
  },
  // ═══════════════ STUDENT-ONLY MENUS ═══════════════
  {
    title: "আমার প্রোফাইল",
    href: "/my-profile",
    icon: <User className="h-5 w-5" />,
    roles: ["student"],
  },
  {
    title: "আমার ফলাফল",
    href: "/my-results",
    icon: <Award className="h-5 w-5" />,
    roles: ["student"],
  },
  {
    title: "আমার হাজিরা",
    href: "/my-attendance",
    icon: <CalendarCheck className="h-5 w-5" />,
    roles: ["student"],
  },
  {
    title: "আমার ফি",
    href: "/my-fees",
    icon: <Wallet className="h-5 w-5" />,
    roles: ["student"],
  },
];

// ═══════════════════════════════════════════════════════
// MENU COLOR MAP (gradient per menu)
// ═══════════════════════════════════════════════════════
const menuColors: Record<string, string> = {
  Dashboard: "from-indigo-500 to-indigo-600",
  "Pending Admissions": "from-amber-500 to-orange-600",     // 🆕
  "Student Management": "from-sky-500 to-blue-600",
  "Teacher & Staff": "from-violet-500 to-purple-600",
  "Fees Management": "from-emerald-500 to-green-600",
  Attendance: "from-amber-500 to-orange-600",
  Examination: "from-rose-500 to-red-600",
  Inventory: "from-teal-500 to-cyan-600",
  Finance: "from-cyan-500 to-sky-600",
  Settings: "from-slate-500 to-slate-600",
  Notifications: "from-blue-500 to-blue-600",
  Reports: "from-purple-500 to-purple-600",
  "আমার প্রোফাইল": "from-sky-500 to-blue-600",
  "আমার ফলাফল": "from-purple-500 to-indigo-600",
  "আমার হাজিরা": "from-emerald-500 to-teal-600",
  "আমার ফি": "from-amber-500 to-orange-600",
};

// ═══════════════════════════════════════════════════════
// MENU ITEM COMPONENT
// ═══════════════════════════════════════════════════════
const MenuItem = React.memo(function MenuItem({
  item, level, collapsed, showLabels, activeMap, expandedHrefs, onToggle, menuColor, onClick,
}: {
  item: NavItem;
  level: number;
  collapsed: boolean;
  showLabels: boolean;
  activeMap: Set<string>;
  expandedHrefs: string[];
  onToggle: (href: string) => void;
  menuColor: string;
  onClick?: () => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedHrefs.includes(item.href);
  const active = activeMap.has(item.href);
  const compactMode = collapsed || !showLabels;
  const paddingLeft = compactMode ? 0 : level === 0 ? 12 : level * 16 + 12;

  // 🆕 Badge renderer (used in both parent & leaf)
  const renderBadge = () => {
    if (item.badgeCount === undefined || item.badgeCount <= 0) return null;
    return (
      <span
        className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0",
          item.badgeColor || "bg-blue-500"
        )}
      >
        {item.badgeCount > 99 ? "99+" : item.badgeCount}
      </span>
    );
  };

  if (hasChildren) {
    return (
      <li className="relative">
        <button
          type="button"
          onClick={() => onToggle(item.href)}
          className={cn(
            "w-full flex items-center justify-between py-2 text-[13px] font-medium rounded-lg group mb-1 px-3 transition-colors",
            active || isExpanded ? `bg-gradient-to-r ${menuColor} text-white shadow-md` : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
            compactMode && "justify-center px-0"
          )}
          style={{ paddingLeft: compactMode ? 0 : `${paddingLeft}px` }}
          title={item.title}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0">{item.icon}</span>
            {showLabels && <span className="truncate max-w-[160px]">{item.title}</span>}
          </div>
          {showLabels && (
            <div className="flex items-center gap-1.5 shrink-0">
              {renderBadge()}
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isExpanded && "rotate-90")} />
            </div>
          )}
        </button>
        {isExpanded && (
          <ul className="mt-1 ml-3 border-l border-slate-800/80 space-y-1 overflow-hidden">
            {item.children?.map((child) => (
              <MenuItem
                key={child.href}
                item={child}
                level={level + 1}
                collapsed={collapsed}
                showLabels={showLabels}
                activeMap={activeMap}
                expandedHrefs={expandedHrefs}
                onToggle={onToggle}
                menuColor={menuColors[child.title] || menuColor}
                onClick={onClick}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          "flex items-center py-2 text-[13px] font-medium duration-150 rounded-lg group mb-1 transition-colors",
          collapsed || !showLabels ? "justify-center px-0" : "gap-2.5 px-3",
          active ? `bg-gradient-to-r ${menuColor} text-white shadow-sm` : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
        )}
        style={{ paddingLeft: !collapsed && showLabels ? `${paddingLeft}px` : undefined }}
        title={item.title}
      >
        <span className="shrink-0">{item.icon}</span>
        {showLabels && <span className="truncate max-w-[160px]">{item.title}</span>}
        {showLabels && <span className="ml-auto">{renderBadge()}</span>}
      </Link>
    </li>
  );
});

// ═══════════════════════════════════════════════════════
// MAIN RESPONSIVE LAYOUT
// ═══════════════════════════════════════════════════════
export function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [schoolSettings, setSchoolSettings] = React.useState<SchoolSettings>({
    school_name: "KinderERP",
    school_subtitle: "Education Suite",
    school_logo: null,
    school_address: null,
    school_phone: null,
    school_email: null,
    theme_primary_color: "#4f46e5",
    theme_secondary_color: "#7c3aed",
  });

  const [userProfile, setUserProfile] = React.useState<UserProfile>({
    name: "",
    email: "",
    role: "",
    initials: "",
    avatar: "",
    isLoading: true,
  });

  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [expandedHrefs, setExpandedHrefs] = React.useState<string[]>([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

  // 🆕 Pending Admissions counter
  const [pendingAdmissionsCount, setPendingAdmissionsCount] = React.useState(0);

  const notifRef = React.useRef<HTMLDivElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Auto-close on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    setIsNotificationsOpen(false);
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Auto expand parent menus based on active pathname
  React.useEffect(() => {
    const parentHrefs: string[] = [];
    const findParents = (items: NavItem[]) => {
      items.forEach((item) => {
        if (item.children) {
          if (item.children.some((child) => pathname === child.href || pathname.startsWith(child.href + "/"))) {
            parentHrefs.push(item.href);
          }
          findParents(item.children);
        }
      });
    };
    findParents(navigation);
    if (parentHrefs.length > 0) {
      setExpandedHrefs((prev) => Array.from(new Set([...prev, ...parentHrefs])));
    }
  }, [pathname]);

  // Dark mode toggle
  React.useEffect(() => {
    const isDark = localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDarkMode(isDark);
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  // ═══════════════════════════════════════════════════
  // 🆕 PENDING ADMISSIONS — count + realtime
  // ═══════════════════════════════════════════════════
  React.useEffect(() => {
    const supabase = createClient();
    const fetchCount = async () => {
      try {
        const { count } = await supabase
          .from("pending_admissions")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        setPendingAdmissionsCount(count || 0);
      } catch (err) {
        console.error("Failed to fetch pending admissions count:", err);
      }
    };
    fetchCount();

    const channel = supabase
      .channel("pending-admissions-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_admissions" },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Supabase Data Loading (profiles Table & settings)
  React.useEffect(() => {
    const supabase = createClient();
    async function loadData() {
      // 1. Fetch School Settings
      try {
        const { data: schoolData } = await supabase.from("school_settings").select("*").limit(1).single();
        if (schoolData) {
          setSchoolSettings({
            school_name: schoolData.school_name || "KinderERP",
            school_subtitle: schoolData.school_address || "Education Suite",
            school_logo: schoolData.school_logo || null,
            school_address: schoolData.school_address || null,
            school_phone: schoolData.school_phone || null,
            school_email: schoolData.school_email || null,
            theme_primary_color: "#4f46e5",
            theme_secondary_color: "#7c3aed",
          });
        }
      } catch (err) {
        console.error("Error loading school settings:", err);
      }

      // 2. Fetch User Profile
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("full_name, email, role, avatar_url")
            .eq("id", user.id)
            .single();

          const fullName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || "User";
          const userEmail = profile?.email || user.email || "";
          const userRole = profile?.role || user.user_metadata?.role || "user";
          const userAvatar = profile?.avatar_url || "";

          const initials = fullName.trim().charAt(0).toUpperCase() || "U";

          setUserProfile({
            name: fullName,
            email: userEmail,
            role: userRole,
            initials: initials,
            avatar: userAvatar,
            isLoading: false,
          });
        } else {
          setUserProfile((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        console.error("Error fetching profile from DB:", err);
        setUserProfile((prev) => ({ ...prev, isLoading: false }));
      }

      // 3. Load Notifications
      try {
        const { data: notifData } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);
        if (notifData && notifData.length > 0) {
          setNotifications(notifData.map((n: any) => ({ id: n.id, title: n.title, message: n.message, is_read: n.is_read })));
        }
      } catch {}
    }
    loadData();
  }, []);

  // Responsive collapse
  React.useEffect(() => {
    const handleResize = () => setIsCollapsed(window.innerWidth < 1280);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Global Search
  React.useEffect(() => {
    const supabase = createClient();
    const runSearch = async () => {
      if (!searchValue.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const [students, staff] = await Promise.all([
          supabase.from("students").select("id, name, student_id").ilike("name", `%${searchValue}%`).limit(5),
          supabase.from("staff").select("id, name").ilike("name", `%${searchValue}%`).limit(5),
        ]);
        const results = [
          ...(students.data || []).map((s: any) => ({ title: s.name, subtitle: s.student_id, href: `/students/${s.id}` })),
          ...(staff.data || []).map((s: any) => ({ title: s.name, subtitle: "Staff", href: `/staff/list` })),
        ];
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };
    const debounceTimer = setTimeout(runSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchValue]);

  // Active Map Calculation
  const activeMap = React.useMemo(() => {
    const map = new Set<string>();
    const traverse = (items: NavItem[]) => {
      items.forEach((item) => {
        if (pathname === item.href || (pathname.startsWith(item.href + "/") && item.href !== "/")) {
          map.add(item.href);
        }
        if (item.children) traverse(item.children);
      });
    };
    traverse(navigation);
    return map;
  }, [pathname]);

  const toggleExpand = (href: string) => {
    setExpandedHrefs((prev) => (prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]));
  };

  // Logout
  const handleLogout = async () => {
    const confirmed = window.confirm("আপনি কি নিশ্চিত যে আপনি লগআউট করতে চান?");
    if (!confirmed) return;

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // ═══════════════════════════════════════════════════
  // NAVIGATION FILTERING + BADGE INJECTION
  // ═══════════════════════════════════════════════════
  const filteredNavigation = React.useMemo(() => {
    const normalizedRole = (userProfile.role || "").toLowerCase().trim();

    if (!normalizedRole) return [];

    const filterByRole = (items: NavItem[]): NavItem[] => {
      return items
        .map((item) => {
          const children = item.children ? filterByRole(item.children) : [];
          const hasAccess =
            !item.roles ||
            item.roles.length === 0 ||
            item.roles.some((r) => normalizedRole === r.toLowerCase());

          if (!hasAccess && children.length === 0) return null;

          if (!hasAccess && children.length > 0) {
            return { ...item, children };
          }

          return {
            ...item,
            children: children.length > 0 ? children : item.children,
          };
        })
        .filter(Boolean) as NavItem[];
    };

    const filtered = filterByRole(navigation);

    // 🆕 Inject badge count into Pending Admissions item
    return filtered.map((item) => {
      if (item.href === "/dashboard/admissions") {
        return {
          ...item,
          badgeCount: pendingAdmissionsCount,
          badgeColor: "bg-amber-500",
        };
      }
      return item;
    });
  }, [userProfile.role, pendingAdmissionsCount]);

  const showLabels = !isCollapsed;

  // Role-based profile link
  const profileHref = userProfile.role?.toLowerCase() === "student" ? "/my-profile" : "/profile";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* HEADER */}
      <header
        className="sticky top-0 z-40 text-white shadow-lg backdrop-blur-md"
        style={{ background: `linear-gradient(135deg, ${schoolSettings.theme_primary_color} 0%, ${schoolSettings.theme_secondary_color} 100%)` }}
      >
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white transition hover:bg-white/25 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/20 shadow-lg">
                {schoolSettings.school_logo ? (
                  <img src={schoolSettings.school_logo} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <GraduationCap className="h-6 w-6 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{schoolSettings.school_name}</div>
                <div className="truncate text-[11px] text-white/80">{schoolSettings.school_subtitle}</div>
              </div>
            </Link>
          </div>

          {/* Desktop Search */}
          <div className="hidden flex-1 max-w-xl mx-4 md:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search students, fees, staff..."
                className="w-full h-10 pl-10 pr-4 text-sm rounded-xl bg-white/15 border border-white/20 text-white placeholder:text-white/60 focus:bg-white/25 outline-none transition-all"
              />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white/80" />}
              {searchResults.length > 0 && (
                <div className="absolute left-0 top-full mt-2 w-full rounded-xl bg-white text-slate-800 shadow-xl overflow-hidden z-50">
                  {searchResults.map((result, index) => (
                    <Link
                      key={index}
                      href={result.href}
                      onClick={() => setSearchValue("")}
                      className="block px-4 py-2 hover:bg-slate-100 text-sm truncate"
                    >
                      {result.title} <span className="text-xs text-slate-500">({result.subtitle})</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white transition hover:bg-white/25 md:hidden"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white transition hover:bg-white/25"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white transition hover:bg-white/25"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
                    {notifications.filter((n) => !n.is_read).length > 9 ? "9+" : notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </button>
              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-white text-slate-800 shadow-xl overflow-hidden z-50 border border-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800">
                  <div className="p-3 border-b dark:border-slate-800">
                    <p className="font-semibold text-sm">Notifications</p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={async () => {
                            const supabase = createClient();
                            await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
                            setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, is_read: true } : item));
                          }}
                          className={cn("w-full text-left p-3 border-b hover:bg-slate-50 transition dark:border-slate-800 dark:hover:bg-slate-800", !n.is_read && "bg-indigo-50 dark:bg-indigo-950/30")}
                        >
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-2.5 py-1.5 text-white shadow-sm hover:bg-white/25 transition"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 font-semibold text-sm ring-1 ring-white/30 overflow-hidden shrink-0">
                  {userProfile.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : userProfile.avatar ? (
                    <img
                      src={userProfile.avatar}
                      alt={userProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    userProfile.initials
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  {userProfile.isLoading ? (
                    <div className="space-y-1">
                      <div className="h-3.5 w-20 bg-white/30 animate-pulse rounded" />
                      <div className="h-2.5 w-12 bg-white/20 animate-pulse rounded" />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-semibold truncate max-w-[130px] leading-tight">{userProfile.name}</div>
                      <div className="text-[10px] text-white/80 truncate max-w-[130px] capitalize tracking-wide">{userProfile.role}</div>
                    </>
                  )}
                </div>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden z-50 border border-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3.5 border-b bg-slate-50/70 dark:bg-slate-800/50 dark:border-slate-800">
                    <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">{userProfile.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{userProfile.email}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-medium uppercase bg-indigo-50 text-indigo-600 rounded-md dark:bg-indigo-950/60 dark:text-indigo-400">
                      {userProfile.role}
                    </span>
                  </div>

                  <div className="p-1">
                    <Link
                      href={profileHref}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <User className="h-4 w-4 text-slate-500" />
                      <span>Profile</span>
                    </Link>

                    {userProfile.role?.toLowerCase() !== "student" && (
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4 text-slate-500" />
                        <span>Settings</span>
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition font-medium mt-1"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search Overlay */}
        {searchOpen && (
          <div className="px-4 pb-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search..."
                className="w-full h-10 pl-10 pr-4 text-sm rounded-xl bg-white/15 border border-white/20 text-white placeholder:text-white/60 outline-none"
                autoFocus
              />
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-col h-full bg-slate-950 text-slate-200 border-r border-slate-800 transition-all duration-300 shrink-0",
            isCollapsed ? "w-16" : "w-64"
          )}
        >
          <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <ul className="space-y-1">
              {filteredNavigation.map((item) => (
                <MenuItem
                  key={item.href}
                  item={item}
                  level={0}
                  collapsed={isCollapsed}
                  showLabels={showLabels}
                  activeMap={activeMap}
                  expandedHrefs={expandedHrefs}
                  onToggle={toggleExpand}
                  menuColor={menuColors[item.title] || "from-slate-600 to-slate-700"}
                />
              ))}
            </ul>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 bg-slate-950 text-slate-200 shadow-2xl flex flex-col">
              <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {schoolSettings.school_logo ? (
                    <img src={schoolSettings.school_logo} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <GraduationCap className="h-8 w-8 text-white" />
                  )}
                  <span className="truncate font-bold text-white text-sm">{schoolSettings.school_name}</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white rounded p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <ul className="space-y-1">
                  {filteredNavigation.map((item) => (
                    <MenuItem
                      key={item.href}
                      item={item}
                      level={0}
                      collapsed={false}
                      showLabels={true}
                      activeMap={activeMap}
                      expandedHrefs={expandedHrefs}
                      onToggle={toggleExpand}
                      menuColor={menuColors[item.title] || "from-slate-600 to-slate-700"}
                      onClick={() => setIsMobileMenuOpen(false)}
                    />
                  ))}
                </ul>
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden min-w-0">
          <main className="flex-1 min-h-0 overflow-y-auto bg-background px-3 pb-4 pt-2 sm:px-4 md:px-6 md:pb-6 custom-scrollbar">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}