// H:\kindergarten-erp\src\app\fees\due\hooks\useBulkActions.ts

"use client";

import { useState, useCallback, useMemo } from "react";
import { DueStudent } from "../types";
import { dueService } from "../services/dueService";
import { toast } from "sonner";

export function useBulkActions(students: DueStudent[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendingReminders, setSendingReminders] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === students.length && students.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map(s => s.id));
    }
  }, [selectedIds, students]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const isAllSelected = students.length > 0 && selectedIds.length === students.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < students.length;

  const selectedStudents = useMemo(() => 
    students.filter(s => selectedIds.includes(s.id)),
    [students, selectedIds]
  );

  const sendBulkReminders = useCallback(async (type: string = 'whatsapp') => {
    if (selectedStudents.length === 0) {
      toast.error('No students selected');
      return;
    }
    
    setSendingReminders(true);
    
    try {
      for (const student of selectedStudents) {
        await dueService.sendReminder({
          student_name: student.student_name,
          due_amount: student.due_amount,
          phone: student.phone,
          father_name: student.father_name,
          type
        });
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      toast.success(`Reminders sent to ${selectedStudents.length} students`);
      clearSelection();
    } catch (error) {
      console.error('Error sending bulk reminders:', error);
      toast.error('Failed to send some reminders');
    } finally {
      setSendingReminders(false);
    }
  }, [selectedStudents, clearSelection]);

  const exportSelected = useCallback(() => {
    if (selectedStudents.length === 0) {
      toast.error('No students selected');
      return;
    }
    
    const csv = dueService.exportToCSV(students, selectedIds);
    const filename = `fee-due-list-${new Date().toISOString().split('T')[0]}.csv`;
    dueService.downloadCSV(csv, filename);
    toast.success(`Exported ${selectedStudents.length} records`);
  }, [selectedStudents, students, selectedIds]);

  return {
    selectedIds,
    selectedStudents,
    isAllSelected,
    isIndeterminate,
    sendingReminders,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    sendBulkReminders,
    exportSelected
  };
}