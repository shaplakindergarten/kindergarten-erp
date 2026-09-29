// H:\kindergarten-erp\src\components\fees\ScholarshipForm.tsx

"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Award, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { applyScholarship, getScholarshipsByStudent } from '@/lib/api/fees';
import { ScholarshipApplication } from '@/types/fees';
import { format } from 'date-fns';

// Schema
const scholarshipSchema = z.object({
  student_id: z.string().min(1, 'Student is required'),
  discount_id: z.string().min(1, 'Discount is required'),
  academic_year_id: z.string().min(1, 'Academic year is required'),
  percentage: z.number().min(0).max(100),
  amount: z.number().optional(),
  reason: z.string().min(3, 'Reason is required'),
  valid_from: z.string().min(1, 'Valid from date is required'),
  valid_to: z.string().min(1, 'Valid to date is required'),
});

type ScholarshipFormData = z.infer<typeof scholarshipSchema>;

interface ScholarshipFormProps {
  studentId?: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function ScholarshipForm({ studentId, onSuccess, trigger }: ScholarshipFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scholarships, setScholarships] = useState<ScholarshipApplication[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScholarshipFormData>({
    resolver: zodResolver(scholarshipSchema),
    defaultValues: {
      student_id: studentId || '',
      percentage: 0,
    },
  });

  const selectedStudentId = watch('student_id');

  // Load data
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      // Load academic years
      const { data: years } = await supabase
        .from('academic_years')
        .select('id, name, year_name')
        .eq('is_active', true)
        .order('year_name', { ascending: false });

      setAcademicYears(years || []);

      // Load discounts
      const { data: discountsData } = await supabase
        .from('fee_discounts')
        .select('id, name, type, value')
        .eq('is_active', true);

      setDiscounts(discountsData || []);

      // Load students (if not pre-selected)
      if (!studentId) {
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, name, student_id')
          .eq('status', 'active')
          .order('name');

        setStudents(studentsData || []);
      }

      // Load existing scholarships for student
      if (studentId) {
        const data = await getScholarshipsByStudent(studentId);
        setScholarships(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onSubmit = async (data: ScholarshipFormData) => {
    setLoading(true);
    try {
      const result = await applyScholarship({
        ...data,
        status: 'pending',
      });

      toast.success('Scholarship application submitted successfully!');
      setOpen(false);
      reset();
      if (onSuccess) onSuccess();

      // Reload scholarships
      if (studentId) {
        const data = await getScholarshipsByStudent(studentId);
        setScholarships(data || []);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply scholarship');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Award className="h-4 w-4" />
            Apply Scholarship
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            Apply Scholarship / Discount
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Existing Scholarships */}
          {scholarships.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Existing Scholarships</Label>
              <div className="space-y-2">
                {scholarships.map((sch) => (
                  <div
                    key={sch.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {sch.percentage}% Discount
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sch.reason} • Valid: {format(new Date(sch.valid_from), 'PPP')} - {format(new Date(sch.valid_to), 'PPP')}
                      </p>
                    </div>
                    <Badge
                      variant={
                        sch.status === 'approved' ? 'success' :
                        sch.status === 'pending' ? 'warning' :
                        'destructive'
                      }
                    >
                      {sch.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Scholarship Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!studentId && (
              <div>
                <Label htmlFor="student_id">Student</Label>
                <Select
                  value={selectedStudentId}
                  onValueChange={(value) => setValue('student_id', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.student_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.student_id && (
                  <p className="text-xs text-red-500 mt-1">{errors.student_id.message}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="academic_year_id">Academic Year</Label>
                <Select
                  onValueChange={(value) => setValue('academic_year_id', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.year_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.academic_year_id && (
                  <p className="text-xs text-red-500 mt-1">{errors.academic_year_id.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="discount_id">Discount Type</Label>
                <Select
                  onValueChange={(value) => setValue('discount_id', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select discount" />
                  </SelectTrigger>
                  <SelectContent>
                    {discounts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.type}: {d.value}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.discount_id && (
                  <p className="text-xs text-red-500 mt-1">{errors.discount_id.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="percentage">Discount Percentage</Label>
                <Input
                  id="percentage"
                  type="number"
                  {...register('percentage', { valueAsNumber: true })}
                  className="mt-1"
                />
                {errors.percentage && (
                  <p className="text-xs text-red-500 mt-1">{errors.percentage.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="amount">Amount (Optional)</Label>
                <Input
                  id="amount"
                  type="number"
                  {...register('amount', { valueAsNumber: true })}
                  className="mt-1"
                  placeholder="Leave empty for percentage based"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="valid_from">Valid From</Label>
                <Input
                  id="valid_from"
                  type="date"
                  {...register('valid_from')}
                  className="mt-1"
                />
                {errors.valid_from && (
                  <p className="text-xs text-red-500 mt-1">{errors.valid_from.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="valid_to">Valid To</Label>
                <Input
                  id="valid_to"
                  type="date"
                  {...register('valid_to')}
                  className="mt-1"
                />
                {errors.valid_to && (
                  <p className="text-xs text-red-500 mt-1">{errors.valid_to.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                {...register('reason')}
                className="mt-1"
                placeholder="Enter reason for scholarship/discount..."
                rows={3}
              />
              {errors.reason && (
                <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Apply Scholarship
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}