// H:\kindergarten-erp\src\app\fees\due\page.tsx

"use client";

import Link from "next/link";
import { ArrowLeft, Download, RefreshCw, Clock, Wallet, Receipt, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { useDueList } from "./hooks/useDueList";
import { useBulkActions } from "./hooks/useBulkActions";
import { DueStats } from "./components/DueStats";
import { DueTable } from "./components/DueTable";
import { FiltersBar } from "./components/FiltersBar";
import { BulkActions } from "./components/BulkActions";
import { ReminderDialog } from "./components/ReminderDialog";
import { StudentDrawer } from "./components/StudentDrawer";
import { dueService } from "./services/dueService";
import { DueStudent } from "./types";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdvanceBalance } from "@/lib/api/fees";

export default function DueListPage() {
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<DueStudent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<DueStudent | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  // ✅ নতুন স্টেট: অ্যাডভান্স ব্যালেন্স
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);

  // ✅ NEW: Client-only time display (prevents hydration mismatch)
  const [clientTime, setClientTime] = useState<string>("");

  const {
    loading,
    sortedList,
    uniqueClasses,
    uniqueSections,
    stats,
    lastSync,
    searchQuery,
    setSearchQuery,
    selectedClass,
    setSelectedClass,
    selectedSection,
    setSelectedSection,
    selectedDueLevel,
    setSelectedDueLevel,
    minDueAmount,
    setMinDueAmount,
    maxDueAmount,
    setMaxDueAmount,
    activeTab,
    setActiveTab,
    sortField,
    sortOrder,
    handleSort,
    refresh,
    resetFilters,
    // 📄 Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    paginatedList,
  } = useDueList();

  const {
    selectedIds,
    selectedStudents,
    isAllSelected,
    isIndeterminate,
    sendingReminders,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    sendBulkReminders,
    exportSelected,
  } = useBulkActions(sortedList);

  // ✅ NEW: Client-only time update (mounted on client only)
  // This prevents hydration mismatch between server and client time
  useEffect(() => {
    // Set initial time
    setClientTime(new Date().toLocaleTimeString());

    // Update every 30 seconds
    const timer = setInterval(() => {
      setClientTime(new Date().toLocaleTimeString());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // ✅ নতুন: স্টুডেন্ট ভিউ করার সময় অ্যাডভান্স ব্যালেন্স লোড করুন
  const handleViewStudent = async (student: DueStudent) => {
    setViewingStudent(student);
    setDrawerOpen(true);

    try {
      const balance = await getAdvanceBalance(student.id);
      setAdvanceBalance(balance?.remaining_balance || 0);
    } catch (error) {
      console.error('Error loading advance balance:', error);
      setAdvanceBalance(0);
    }
  };

  const handleSendReminder = async (student: DueStudent, type: string = 'all') => {
    setSelectedStudent(student);
    if (type !== 'all') {
      setSendingReminder(true);
      const result = await dueService.sendReminder({
        student_name: student.student_name,
        due_amount: student.due_amount,
        phone: student.phone,
        father_name: student.father_name,
        type,
      });
      setSendingReminder(false);
      if (result.success) {
        toast.success(`Reminder sent to ${student.student_name}`);
      } else {
        toast.error(result.message || 'Failed to send reminder');
      }
      setReminderModalOpen(false);
    } else {
      setReminderModalOpen(true);
    }
  };

  const handleReminderSend = async (type: string) => {
    if (!selectedStudent) return;
    setSendingReminder(true);
    const result = await dueService.sendReminder({
      student_name: selectedStudent.student_name,
      due_amount: selectedStudent.due_amount,
      phone: selectedStudent.phone,
      father_name: selectedStudent.father_name,
      type,
    });
    setSendingReminder(false);
    if (result.success) {
      toast.success(`Reminder sent to ${selectedStudent.student_name}`);
      setReminderModalOpen(false);
    } else {
      toast.error(result.message || 'Failed to send reminder');
    }
  };

  const handleWhatsApp = (student: DueStudent) => {
    const message = `Dear ${student.father_name || 'Guardian'},\n\nReminder: Fee for ${student.student_name} is due.\nDue Amount: ৳${student.due_amount.toLocaleString()}\n\nThank you.`;
    const whatsappUrl = `https://wa.me/${student.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleExportAll = () => {
    const csv = dueService.exportToCSV(sortedList);
    const filename = `fee-due-list-${new Date().toISOString().split('T')[0]}.csv`;
    dueService.downloadCSV(csv, filename);
    toast.success(`Exported ${sortedList.length} records`);
  };

  // ═══════════════════════════════════════════════════════════════════
  // ✅ Quick Payment — Redirect to /fees/receive with prefilled data
  // ═══════════════════════════════════════════════════════════════════
  const handleQuickPayment = async (student: DueStudent) => {
    try {
      // Build query params — /fees/receive page will read and prefill form
      const params = new URLSearchParams({
        student_id: student.id,
        student_name: student.student_name || '',
        admission_no: student.admission_no || '',
        class_name: student.class_name || '',
        section_name: student.section_name || '',
        roll_no: student.class_roll || '',
        due_amount: String(student.due_amount || 0),
        source: 'due-list',
      });

      toast.success(`Opening payment for ${student.student_name}...`);

      // Small delay so the toast is visible before navigation
      setTimeout(() => {
        window.location.href = `/fees/receive?${params.toString()}`;
      }, 250);
    } catch (error) {
      console.error('Quick payment navigation error:', error);
      toast.error('Failed to open payment page');
    }
  };

  // Table skeleton loader component
  const TableSkeleton = () => (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableHead>
              <TableHead className="w-[180px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[100px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[80px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[100px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[80px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[100px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[100px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[90px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[80px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[100px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[110px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <TableHead className="w-[100px] h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <ResponsiveLayout>
      <div className="space-y-4 sm:space-y-5 p-3 sm:p-4 md:p-6 max-w-full">

        {/* ✅ Header with Gradient Background */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 p-3 sm:p-4 md:p-5 shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 sm:w-40 h-32 sm:h-40 rounded-full bg-white/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 sm:w-40 h-32 sm:h-40 rounded-full bg-yellow-500/20 blur-3xl animate-pulse delay-1000" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-8 w-8 md:h-10 md:w-10 shrink-0"
              >
                <Link href="/fees">
                  <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
                </Link>
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight">
                  Fee Due Management
                </h1>
                <p className="text-white/80 text-xs sm:text-sm mt-0.5 truncate">
                  Track and manage pending fee payments
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* ✅ FIXED: Client-only time display */}
              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-white/80 bg-white/10 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">Last sync:</span>
                <span className="tabular-nums min-w-[68px] inline-block text-right">
                  {clientTime || "—:—:—"}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={refresh}
                className="bg-white/15 backdrop-blur-sm text-white border-white/25 hover:bg-white/25 transition-all duration-200 gap-1 h-7 sm:h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportAll}
                className="bg-white/15 backdrop-blur-sm text-white border-white/25 hover:bg-white/25 transition-all duration-200 gap-1 h-7 sm:h-8 text-xs"
              >
                <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Export All</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <DueStats
          stats={stats}
          studentCount={sortedList.length}
          onTabChange={setActiveTab}
        />

        {/* Filters */}
        <FiltersBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedClass={selectedClass}
          setSelectedClass={setSelectedClass}
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
          selectedDueLevel={selectedDueLevel}
          setSelectedDueLevel={setSelectedDueLevel}
          minDueAmount={minDueAmount}
          setMinDueAmount={setMinDueAmount}
          maxDueAmount={maxDueAmount}
          setMaxDueAmount={setMaxDueAmount}
          uniqueClasses={uniqueClasses}
          uniqueSections={uniqueSections}
          totalResults={sortedList.length}
          onReset={resetFilters}
        />

        {/* Table - Show skeleton while loading */}
        {loading ? <TableSkeleton /> : (
          <DueTable
            data={paginatedList}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            selectedIds={selectedIds}
            isAllSelected={isAllSelected}
            isIndeterminate={isIndeterminate}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onSendReminder={(student) => handleSendReminder(student, 'all')}
            onViewStudent={handleViewStudent}
            onWhatsApp={handleWhatsApp}
            onQuickPayment={handleQuickPayment}
          />
        )}

        {/* 📄 Pagination — Responsive Fix */}
        {!loading && sortedList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-800">
            {/* Left: Record count */}
            <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              Showing{" "}
              <strong className="text-foreground">
                {Math.min((currentPage - 1) * pageSize + 1, sortedList.length)}
              </strong>
              –
              <strong className="text-foreground">
                {Math.min(currentPage * pageSize, sortedList.length)}
              </strong>{" "}
              of <strong className="text-foreground">{sortedList.length}</strong> students
            </div>

            {/* Right: Page size + Pagination controls */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
              {/* Page size selector */}
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-16 sm:w-20 h-8 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>

              {/* Pagination buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                >
                  <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline ml-1">Previous</span>
                </Button>

                <span className="text-xs sm:text-sm whitespace-nowrap font-medium px-2 sm:px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-foreground">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                >
                  <span className="hidden sm:inline mr-1">Next</span>
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        <BulkActions
          selectedCount={selectedIds.length}
          onClear={clearSelection}
          onBulkReminder={() => sendBulkReminders('all')}
          onExport={exportSelected}
          sendingReminders={sendingReminders}
        />

        {/* Dialogs */}
        <ReminderDialog
          open={reminderModalOpen}
          onOpenChange={setReminderModalOpen}
          student={selectedStudent}
          onSend={handleReminderSend}
          sending={sendingReminder}
        />

        <StudentDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          student={viewingStudent}
          advanceBalance={advanceBalance}
          onSendReminder={(student) => handleSendReminder(student, 'all')}
          onWhatsApp={handleWhatsApp}
        />
      </div>
    </ResponsiveLayout>
  );
}