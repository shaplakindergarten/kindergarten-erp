"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertCircle, Users, Search } from 'lucide-react';
import { useFeeAssignments } from '@/hooks/useFeeAssignments';
import { FeeStructureSelector } from '@/components/fees/FeeStructureSelector';
import { AssignmentScope } from '@/types/fee-assignments';

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  structures: any[];
  academicYears: any[];
  scope: AssignmentScope & {
    mode: 'whole_class' | 'whole_section' | 'selected_students' | 'individual';
  };
  classes: any[];
  sections: any[];
  students: any[];
  isLoadingStudents?: boolean;
}

interface AssignmentSummary {
  assigned: number;
  skipped: number;
  failed: number;
  total: number;
  results: { student_id: string; success: boolean; message?: string }[];
}

export function BulkAssignDialog({
  open,
  onOpenChange,
  onSuccess,
  structures,
  academicYears,
  scope,
  classes,
  sections,
  students,
  isLoadingStudents = false,
}: BulkAssignDialogProps) {
  const { bulkAssign, isBulkAssigning } = useFeeAssignments();
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);

  useEffect(() => {
    if (!academicYearId && academicYears.length > 0) {
      const current = academicYears.find((year) => year.is_current) || academicYears[0];
      setAcademicYearId(current?.id || '');
    }
  }, [academicYears, academicYearId]);

  useEffect(() => {
    if (!open) {
      setSelectedStudentIds(new Set());
      setSelectedStudentId('');
      setSearchQuery('');
      setError('');
      setIsConfirmOpen(false);
      setIsSubmitting(false);
      setSummary(null);
      setFeeStructureId('');
      setEffectiveFrom(new Date().toISOString().split('T')[0]);
      setEffectiveTo('');
      setNotes('');
    }
  }, [open]);

  const unassignedStudents = useMemo(
    () => students.filter((student) => !student.is_assigned),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return students.filter((student) =>
      !query ||
      student.name.toLowerCase().includes(query) ||
      student.student_id.toLowerCase().includes(query) ||
      student.class_name.toLowerCase().includes(query) ||
      student.section_name.toLowerCase().includes(query) ||
      (student.father_name || '').toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  const scopeLabel = useMemo(() => {
    const selectedClass = classes.find((cls) => cls.id === scope.class_id)?.name || 'Class not selected';
    const selectedSection = sections.find((sec) => sec.id === scope.section_id)?.name || 'Section not selected';

    if (scope.mode === 'whole_class') {
      return scope.class_id ? `All students in ${selectedClass}` : 'Class not selected';
    }

    if (scope.mode === 'whole_section') {
      return scope.class_id && scope.section_id ? `${selectedSection} of ${selectedClass}` : 'Section not selected';
    }

    if (scope.mode === 'selected_students') {
      return scope.class_id ? `${selectedClass}${scope.section_id ? ` / ${selectedSection}` : ''}` : 'Selected students';
    }

    return scope.class_id ? `${selectedClass}${scope.section_id ? ` / ${selectedSection}` : ''}` : 'Individual student';
  }, [scope, classes, sections]);

  const selectedCount = useMemo(() => {
    if (scope.mode === 'selected_students') return selectedStudentIds.size;
    if (scope.mode === 'individual') return selectedStudentId ? 1 : 0;
    return unassignedStudents.length;
  }, [scope.mode, selectedStudentIds, selectedStudentId, unassignedStudents.length]);

  const assignScope = useMemo(() => {
    if (scope.mode === 'selected_students') {
      return {
        mode: 'selected_students',
        student_ids: Array.from(selectedStudentIds),
      } as AssignmentScope;
    }

    if (scope.mode === 'individual') {
      return {
        mode: 'individual',
        student_ids: selectedStudentId ? [selectedStudentId] : [],
      } as AssignmentScope;
    }

    return {
      mode: scope.mode,
      class_id: scope.class_id,
      section_id: scope.mode === 'whole_section' ? scope.section_id : undefined,
    } as AssignmentScope;
  }, [scope, selectedStudentIds, selectedStudentId]);

  const validateForm = () => {
    setError('');

    if (!feeStructureId) {
      setError('Please select a fee structure.');
      return false;
    }

    if (!academicYearId) {
      setError('Please select an academic year.');
      return false;
    }

    if (!effectiveFrom) {
      setError('Please select an effective start date.');
      return false;
    }

    if (effectiveTo && effectiveFrom > effectiveTo) {
      setError('Effective to date must be after the start date.');
      return false;
    }

    if (scope.mode === 'whole_class' && !scope.class_id) {
      setError('Please select a class for whole class assignment.');
      return false;
    }

    if (scope.mode === 'whole_section' && (!scope.class_id || !scope.section_id)) {
      setError('Please select a class and section for whole section assignment.');
      return false;
    }

    if (scope.mode === 'selected_students' && selectedStudentIds.size === 0) {
      setError('Please select at least one student.');
      return false;
    }

    if (scope.mode === 'individual' && !selectedStudentId) {
      setError('Please select one student.');
      return false;
    }

    if ((scope.mode === 'whole_class' || scope.mode === 'whole_section') && unassignedStudents.length === 0) {
      setError('There are no unassigned students in the selected scope.');
      return false;
    }

    return true;
  };

  const handleConfirm = () => {
    if (!validateForm()) return;
    setIsConfirmOpen(true);
  };

  const handleAssign = async () => {
    setIsConfirmOpen(false);
    setError('');
    setIsSubmitting(true);

    try {
      const result = await bulkAssign({
        scope: assignScope,
        fee_structure_id: feeStructureId,
        academic_year_id: academicYearId,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        notes: notes || undefined,
      });

      if (!result.success) {
        setError('Assignment failed. Please try again.');
        return;
      }

      setSummary({
        assigned: result.assigned,
        skipped: result.skipped,
        failed: result.failed,
        total: result.total,
        results: result.results,
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred during assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (summary) {
      onSuccess?.();
    }
  };

  const isSubmitDisabled = isSubmitting || isBulkAssigning || selectedCount === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assign Fee Structure
            </DialogTitle>
            <DialogDescription>
              Assign a fee structure by scope or individual students.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-muted/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Scope</p>
                <p className="mt-2 font-medium capitalize">{scope.mode.replace('_', ' ')}</p>
                <p className="text-sm text-muted-foreground mt-2">{scopeLabel}</p>
              </div>

              {(scope.mode === 'selected_students' || scope.mode === 'individual') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Students</Label>
                    <span className="text-xs text-muted-foreground">{filteredStudents.length} available</span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {scope.mode === 'selected_students' ? (
                    <div className="border rounded-lg overflow-hidden max-h-65 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No students found.</div>
                      ) : (
                        filteredStudents.map((student) => (
                          <div
                            key={student.id}
                            className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer"
                            onClick={() => {
                              if (!student.is_assigned) {
                                const ids = new Set(selectedStudentIds);
                                if (ids.has(student.id)) ids.delete(student.id);
                                else ids.add(student.id);
                                setSelectedStudentIds(ids);
                              }
                            }}
                          >
                            <Checkbox
                              checked={selectedStudentIds.has(student.id)}
                              onCheckedChange={() => {
                                if (!student.is_assigned) {
                                  const ids = new Set(selectedStudentIds);
                                  if (ids.has(student.id)) ids.delete(student.id);
                                  else ids.add(student.id);
                                  setSelectedStudentIds(ids);
                                }
                              }}
                              disabled={student.is_assigned}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{student.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {student.student_id} • {student.class_name} - {student.section_name}
                              </p>
                            </div>
                            {student.is_assigned && (
                              <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs">Assigned</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-65 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No students found.</div>
                      ) : (
                        filteredStudents.map((student) => (
                          <button
                            type="button"
                            key={student.id}
                            className={`flex w-full items-center gap-3 p-3 text-left ${selectedStudentId === student.id ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-muted/30'}`}
                            onClick={() => setSelectedStudentId(student.id)}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{student.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {student.student_id} • {student.class_name} - {student.section_name}
                              </p>
                            </div>
                            {selectedStudentId === student.id && (
                              <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">Selected</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fee Structure <span className="text-red-500">*</span></Label>
                  <FeeStructureSelector
                    structures={structures}
                    value={feeStructureId}
                    onChange={setFeeStructureId}
                    placeholder="Select fee structure..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Academic Year <span className="text-red-500">*</span></Label>
                  <Select value={academicYearId} onValueChange={setAcademicYearId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.year_name} - {year.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effective_from">Effective From <span className="text-red-500">*</span></Label>
                  <Input
                    id="effective_from"
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effective_to">Effective To</Label>
                  <Input
                    id="effective_to"
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for ongoing assignments.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>

              {(scope.mode === 'whole_class' || scope.mode === 'whole_section') && (
                <div className="rounded-xl border border-muted/50 p-4 bg-muted/50">
                  <p className="text-sm font-medium">Scope assignment summary</p>
                  <p className="text-sm text-muted-foreground mt-2">This will assign the selected fee structure to {unassignedStudents.length} unassigned student(s) in the chosen scope.</p>
                </div>
              )}

              {summary && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">Assignment completed</p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Assigned</p>
                      <p className="mt-2 text-2xl font-semibold">{summary.assigned}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Skipped</p>
                      <p className="mt-2 text-2xl font-semibold">{summary.skipped}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Failed</p>
                      <p className="mt-2 text-2xl font-semibold">{summary.failed}</p>
                    </div>
                  </div>
                  {summary.failed > 0 && (
                    <div className="mt-4 rounded-lg bg-white p-3">
                      <p className="text-sm font-medium">Errors</p>
                      <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground">
                        {summary.results.filter((item) => !item.success).slice(0, 3).map((item) => (
                          <li key={item.student_id}>{item.message || 'Assignment failed'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              {summary ? 'Close' : 'Cancel'}
            </Button>
            {!summary && (
              <Button
                onClick={handleConfirm}
                disabled={isSubmitDisabled}
                className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {(isSubmitting || isBulkAssigning) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Assign ({selectedCount})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm assignment</AlertDialogTitle>
            <AlertDialogDescription>
              {scope.mode === 'whole_section' || scope.mode === 'whole_class'
                ? `This will assign the selected fee structure to ${unassignedStudents.length} student(s).`
                : scope.mode === 'selected_students'
                ? `This will assign the selected fee structure to ${selectedStudentIds.size} student(s).`
                : `This will assign the selected fee structure to one student.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssign} disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
