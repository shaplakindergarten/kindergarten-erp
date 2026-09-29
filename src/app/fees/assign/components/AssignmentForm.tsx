"use client";

import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { useFeeAssignments } from '@/hooks/useFeeAssignments';
import { FeeStructureSelector } from '@/components/fees/FeeStructureSelector';

interface AssignmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: any;
  onSuccess?: () => void;
  structures: any[];
  academicYears: any[];
}

export function AssignmentForm({
  open,
  onOpenChange,
  assignment,
  onSuccess,
  structures,
  academicYears,
}: AssignmentFormProps) {
  const { createAssignment, updateAssignment, isCreating, isUpdating, unassignedStudents } = useFeeAssignments();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    student_id: '',
    fee_structure_id: '',
    academic_year_id: '',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    notes: '',
  });

  useEffect(() => {
    if (assignment) {
      setFormData({
        student_id: assignment.student_id || '',
        fee_structure_id: assignment.fee_structure_id || '',
        academic_year_id: assignment.academic_year_id || '',
        effective_from: assignment.effective_from?.split('T')[0] || new Date().toISOString().split('T')[0],
        effective_to: assignment.effective_to?.split('T')[0] || '',
        notes: assignment.notes || '',
      });
    } else {
      setFormData({
        student_id: '',
        fee_structure_id: '',
        academic_year_id: academicYears?.[0]?.id || '',
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
        notes: '',
      });
    }
    setError('');
  }, [assignment, academicYears]);

  const handleSubmit = async () => {
    setError('');

    if (!formData.student_id) {
      setError('Please select a student');
      return;
    }

    if (!formData.fee_structure_id) {
      setError('Please select a fee structure');
      return;
    }

    if (!formData.academic_year_id) {
      setError('Please select an academic year');
      return;
    }

    setLoading(true);

    try {
      if (assignment) {
        const result = await updateAssignment({
          id: assignment.id,
          data: {
            fee_structure_id: formData.fee_structure_id,
            effective_from: formData.effective_from,
            effective_to: formData.effective_to || null,
            notes: formData.notes || undefined,
            is_active: true,
          },
        });

        if (result.success) {
          toast.success('Fee assignment updated successfully');
          onSuccess?.();
        } else {
          setError(result.error || 'Failed to update assignment');
        }
      } else {
        const result = await createAssignment({
          student_id: formData.student_id,
          fee_structure_id: formData.fee_structure_id,
          academic_year_id: formData.academic_year_id,
          effective_from: formData.effective_from,
          effective_to: formData.effective_to || null,
          notes: formData.notes || undefined,
        });

        if (result.success) {
          toast.success('Fee assignment created successfully');
          onSuccess?.();
        } else {
          setError(result.error || 'Failed to create assignment');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {assignment ? 'Edit Fee Assignment' : 'New Fee Assignment'}
          </DialogTitle>
          <DialogDescription>
            {assignment
              ? 'Update the fee structure assignment for this student'
              : 'Assign a fee structure to a student'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="student">
              Student <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.student_id}
              onValueChange={(v) => setFormData({ ...formData, student_id: v })}
              disabled={!!assignment}
            >
              <SelectTrigger id="student">
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent className="max-h-50">
                {unassignedStudents.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No unassigned students found
                  </div>
                ) : (
                  unassignedStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{student.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {student.class_name} - {student.section_name}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!assignment && (
              <p className="text-xs text-muted-foreground">
                Only students without an active assignment are shown
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="structure">
              Fee Structure <span className="text-red-500">*</span>
            </Label>
            <FeeStructureSelector
              structures={structures}
              value={formData.fee_structure_id}
              onChange={(v) => setFormData({ ...formData, fee_structure_id: v })}
              placeholder="Select a fee structure..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="academic_year">
              Academic Year <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.academic_year_id}
              onValueChange={(v) => setFormData({ ...formData, academic_year_id: v })}
            >
              <SelectTrigger id="academic_year">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effective_from">
                Effective From <span className="text-red-500">*</span>
              </Label>
              <Input
                id="effective_from"
                type="date"
                value={formData.effective_from}
                onChange={(e) =>
                  setFormData({ ...formData, effective_from: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective_to">Effective To</Label>
              <Input
                id="effective_to"
                type="date"
                value={formData.effective_to}
                onChange={(e) =>
                  setFormData({ ...formData, effective_to: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for ongoing assignment
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || isCreating || isUpdating}
            className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            {(loading || isCreating || isUpdating) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {assignment ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}