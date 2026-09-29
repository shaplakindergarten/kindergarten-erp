'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw,
  Award,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface GradeRule {
  id: string;
  grade_name: string;
  min_mark: number;
  max_mark: number;
  grade_point: number;
  remarks: string;
  is_active: boolean;
}

export default function GradeSystemPage() {
  const [loading, setLoading] = useState(false);
  const [grades, setGrades] = useState<GradeRule[]>([]);
  const [open, setOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingGradeId, setDeletingGradeId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    grade_name: '',
    min_mark: 0,
    max_mark: 100,
    grade_point: 0,
    remarks: '',
    is_active: true,
  });

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('grading_rules')
      .select('*')
      .order('min_mark', { ascending: false });
    
    if (error) {
      console.error(error);
      toast.error('Failed to load grading rules');
    } else {
      setGrades(data || []);
    }
    setLoading(false);
  }, []);

  const checkOverlap = (minMark: number, maxMark: number, excludeId?: string): GradeRule | null => {
    return grades.find(g => 
      g.id !== excludeId &&
      minMark <= g.max_mark &&
      maxMark >= g.min_mark
    ) || null;
  };

  const checkDuplicateGradeName = (gradeName: string, excludeId?: string): GradeRule | null => {
    return grades.find(g => 
      g.id !== excludeId &&
      g.grade_name.trim().toLowerCase() === gradeName.trim().toLowerCase()
    ) || null;
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.grade_name || !formData.grade_name.trim()) {
      toast.error('Grade name is required');
      return;
    }
    
    if (formData.min_mark < 0) {
      toast.error('Minimum marks cannot be negative');
      return;
    }
    
    if (formData.max_mark < 0) {
      toast.error('Maximum marks cannot be negative');
      return;
    }
    
    if (formData.min_mark > formData.max_mark) {
      toast.error('Minimum marks cannot be greater than maximum marks');
      return;
    }
    
    // GPA validation
    if (formData.grade_point < 0 || formData.grade_point > 5) {
      toast.error('GPA must be between 0 and 5');
      return;
    }
    
    // Duplicate grade name check
    const duplicateGrade = checkDuplicateGradeName(formData.grade_name, editingGrade?.id);
    if (duplicateGrade) {
      toast.error(`Grade "${formData.grade_name}" already exists`);
      return;
    }
    
    // Overlap check
    const overlapping = checkOverlap(formData.min_mark, formData.max_mark, editingGrade?.id);
    if (overlapping) {
      toast.error(`Marks range overlaps with grade "${overlapping.grade_name}" (${overlapping.min_mark}-${overlapping.max_mark})`);
      return;
    }
    
    setLoading(true);
    
    try {
      let result;
      if (editingGrade) {
        result = await supabase
          .from('grading_rules')
          .update({
            grade_name: formData.grade_name.trim(),
            min_mark: formData.min_mark,
            max_mark: formData.max_mark,
            grade_point: formData.grade_point,
            remarks: formData.remarks,
            is_active: formData.is_active,
          })
          .eq('id', editingGrade.id);
      } else {
        result = await supabase
          .from('grading_rules')
          .insert([{
            academic_year_id: null,
            grade_name: formData.grade_name.trim(),
            min_mark: formData.min_mark,
            max_mark: formData.max_mark,
            grade_point: formData.grade_point,
            remarks: formData.remarks,
            is_active: formData.is_active,
          }]);
      }
      
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success(editingGrade ? 'Grade updated successfully' : 'Grade created successfully');
        setOpen(false);
        resetForm();
        fetchGrades();
      }
    } catch (err) {
      console.error('Error saving grade:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingGradeId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('grading_rules')
        .delete()
        .eq('id', deletingGradeId);
      
      if (error) {
        toast.error('Failed to delete: ' + error.message);
      } else {
        toast.success('Grade rule deleted successfully');
        fetchGrades();
      }
    } catch (err) {
      console.error('Error deleting grade:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setDeletingGradeId(null);
    }
  };

  const handleEdit = (grade: GradeRule) => {
    setEditingGrade(grade);
    setFormData({
      grade_name: grade.grade_name,
      min_mark: grade.min_mark,
      max_mark: grade.max_mark,
      grade_point: grade.grade_point,
      remarks: grade.remarks || '',
      is_active: grade.is_active,
    });
    setOpen(true);
  };

  const resetForm = () => {
    setEditingGrade(null);
    setFormData({
      grade_name: '',
      min_mark: 0,
      max_mark: 100,
      grade_point: 0,
      remarks: '',
      is_active: true,
    });
  };

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  // Default seed data suggestion
  const seedDefaultGrades = async () => {
    if (grades.length > 0) return;
    
    const defaultGrades = [
      { grade_name: 'A+', min_mark: 80, max_mark: 100, grade_point: 5.00, remarks: 'Excellent', is_active: true },
      { grade_name: 'A', min_mark: 70, max_mark: 79, grade_point: 4.00, remarks: 'Very Good', is_active: true },
      { grade_name: 'A-', min_mark: 60, max_mark: 69, grade_point: 3.50, remarks: 'Good', is_active: true },
      { grade_name: 'B', min_mark: 50, max_mark: 59, grade_point: 3.00, remarks: 'Satisfactory', is_active: true },
      { grade_name: 'C', min_mark: 40, max_mark: 49, grade_point: 2.00, remarks: 'Average', is_active: true },
      { grade_name: 'D', min_mark: 33, max_mark: 39, grade_point: 1.00, remarks: 'Pass', is_active: true },
      { grade_name: 'F', min_mark: 0, max_mark: 32, grade_point: 0.00, remarks: 'Fail', is_active: true },
    ];
    
    for (const grade of defaultGrades) {
      await supabase.from('grading_rules').insert([{
        academic_year_id: null,
        ...grade
      }]);
    }
    fetchGrades();
    toast.success('Default grading rules added');
  };

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-amber-700 via-orange-700 to-yellow-800 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/exams/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Award className="h-8 w-8" />
                Grading System
                <Badge className="bg-orange-400 text-black ml-2">Setup</Badge>
              </h1>
              <p className="text-amber-100 mt-2">Define grade and GPA calculation rules</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {grades.length === 0 && (
                <Button 
                  onClick={seedDefaultGrades}
                  variant="outline"
                  className="bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  <Award className="mr-2 h-4 w-4" />
                  Add Default Grades
                </Button>
              )}
              <Button 
                onClick={() => {
                  resetForm();
                  setOpen(true);
                }}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Grade
              </Button>
              <Button 
                onClick={fetchGrades} 
                disabled={loading}
                variant="outline" 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Grades Table */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-gray-900">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : grades.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Grade Rules Found</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Create grading rules to calculate student results.
              </p>
              <Button onClick={() => setOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Grade
              </Button>
            </CardContent>
          ) : (
            <Table>
              <TableHeader className="bg-gradient-to-r from-amber-500 to-orange-600">
                <TableRow>
                  <TableHead className="text-white">Grade</TableHead>
                  <TableHead className="text-white">Min Marks</TableHead>
                  <TableHead className="text-white">Max Marks</TableHead>
                  <TableHead className="text-white">GPA</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white">Remarks</TableHead>
                  <TableHead className="text-white text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell className="font-bold text-gray-900 dark:text-white">{grade.grade_name}</TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300">{grade.min_mark}</TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300">{grade.max_mark}</TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300">{grade.grade_point.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={grade.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}>
                        {grade.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 dark:text-gray-400">{grade.remarks || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(grade)} className="mr-2">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setDeletingGradeId(grade.id);
                          setDeleteDialogOpen(true);
                        }} 
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">{editingGrade ? 'Edit Grade' : 'New Grade'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Grade Name *</Label>
                <Input
                  value={formData.grade_name}
                  onChange={(e) => setFormData({ ...formData, grade_name: e.target.value })}
                  placeholder="e.g., A+, A, A-, B+, B, C, D, F"
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Min Marks *</Label>
                  <Input
                    type="number"
                    value={formData.min_mark}
                    onChange={(e) => setFormData({ ...formData, min_mark: Number(e.target.value) })}
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Max Marks *</Label>
                  <Input
                    type="number"
                    value={formData.max_mark}
                    onChange={(e) => setFormData({ ...formData, max_mark: Number(e.target.value) })}
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">GPA *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.grade_point}
                  onChange={(e) => setFormData({ ...formData, grade_point: Number(e.target.value) })}
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  min="0"
                  max="5"
                />
                <p className="text-xs text-gray-500 mt-1">GPA must be between 0 and 5</p>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-700 dark:text-gray-300">Active Status</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(value) => setFormData({ ...formData, is_active: value })}
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Remarks</Label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g., Excellent, Very Good, Good"
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingGrade ? 'Update' : 'Create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-white dark:bg-gray-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-white">Delete Grade Rule</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
                Are you sure you want to delete this grade rule? This action cannot be undone.
                Results calculated using this grade rule may be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ResponsiveLayout>
  );
}
