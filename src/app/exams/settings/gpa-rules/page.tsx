'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw,
  Percent,
  AlertCircle,
  ArrowLeft,
  Save,
  CheckCircle,
  Calculator,
  TrendingUp,
  Award
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface GradeRule {
  id: string;
  academic_year_id: string | null;
  grade_name: string;
  min_mark: number;
  max_mark: number;
  grade_point: number;
  remarks: string;
  is_default: boolean;
  is_active: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  is_current: boolean;
}

interface BonusPolicy {
  elective_bonus_points: number;
  apply_bonus_if_all_elective_pass: boolean;
}

export default function GPARulesPage() {
  const [loading, setLoading] = useState(false);
  const [grades, setGrades] = useState<GradeRule[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [open, setOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRule | null>(null);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("all");
  
  // Bonus Policy State
  const [bonusPolicy, setBonusPolicy] = useState<BonusPolicy>({
    elective_bonus_points: 2,
    apply_bonus_if_all_elective_pass: true,
  });
  const [savingBonus, setSavingBonus] = useState(false);
  
  const [formData, setFormData] = useState({
    grade_name: '',
    min_mark: 0,
    max_mark: 100,
    grade_point: 0,
    remarks: '',
    is_default: false,
    is_active: true,
  });

  const fetchAcademicYears = useCallback(async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, name, is_current')
      .order('year_name', { ascending: false });
    
    if (error) {
      console.error('Error fetching academic years:', error);
      return;
    }
    if (data) setAcademicYears(data);
  }, []);

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('grading_rules')
      .select('*')
      .order('min_mark', { ascending: false });
    
    if (selectedAcademicYear !== 'all') {
      query = query.eq('academic_year_id', selectedAcademicYear);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching grades:', error);
      toast.error('Failed to load grading rules');
    } else {
      setGrades(data || []);
    }
    setLoading(false);
  }, [selectedAcademicYear]);

  const fetchBonusPolicy = useCallback(async () => {
    const { data, error } = await supabase
      .from('exam_settings_new')
      .select('setting_value')
      .eq('setting_key', 'bonus_policy')
      .maybeSingle();
    
    if (!error && data) {
      setBonusPolicy(data.setting_value as BonusPolicy);
    }
  }, []);

  const saveBonusPolicy = async () => {
    setSavingBonus(true);
    
    const { error } = await supabase
      .from('exam_settings_new')
      .upsert({
        setting_key: 'bonus_policy',
        setting_value: bonusPolicy,
        description: 'Elective subject bonus policy - adds points to GPA',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'setting_key',
      });
    
    if (error) {
      console.error('Error saving bonus policy:', error);
      toast.error('Failed to save bonus policy');
    } else {
      toast.success('Bonus policy saved successfully');
    }
    
    setSavingBonus(false);
  };

  const handleSave = async () => {
    if (!formData.grade_name || formData.min_mark < 0 || formData.max_mark < 0) {
      toast.error('Please fill all required fields correctly');
      return;
    }
    
    setLoading(true);
    
    try {
      const gradeData = {
        academic_year_id: selectedAcademicYear === 'all' ? null : selectedAcademicYear,
        grade_name: formData.grade_name,
        min_mark: formData.min_mark,
        max_mark: formData.max_mark,
        grade_point: formData.grade_point,
        remarks: formData.remarks,
        is_default: formData.is_default,
        is_active: formData.is_active,
      };
      
      if (gradeData.is_default) {
        await supabase
          .from('grading_rules')
          .update({ is_default: false })
          .eq('academic_year_id', gradeData.academic_year_id);
      }
      
      let result;
      if (editingGrade) {
        result = await supabase
          .from('grading_rules')
          .update(gradeData)
          .eq('id', editingGrade.id);
      } else {
        result = await supabase
          .from('grading_rules')
          .insert([gradeData]);
      }
      
      if (result.error) throw result.error;
      
      toast.success(editingGrade ? 'Grade rule updated' : 'Grade rule created');
      setOpen(false);
      resetForm();
      fetchGrades();
    } catch (err) {
      console.error('Error saving grade:', err);
      toast.error('Failed to save grade rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('grading_rules')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete grade rule');
    } else {
      toast.success('Grade rule deleted');
      fetchGrades();
    }
    setLoading(false);
  };

  const handleEdit = (grade: GradeRule) => {
    setEditingGrade(grade);
    setFormData({
      grade_name: grade.grade_name,
      min_mark: grade.min_mark,
      max_mark: grade.max_mark,
      grade_point: grade.grade_point,
      remarks: grade.remarks || '',
      is_default: grade.is_default,
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
      is_default: false,
      is_active: true,
    });
  };

  const loadDefaultGrades = async () => {
    const defaultGrades = [
      { grade_name: 'A+', min_mark: 80, max_mark: 100, grade_point: 5.00, remarks: 'Excellent' },
      { grade_name: 'A', min_mark: 70, max_mark: 79, grade_point: 4.00, remarks: 'Very Good' },
      { grade_name: 'A-', min_mark: 60, max_mark: 69, grade_point: 3.50, remarks: 'Good' },
      { grade_name: 'B', min_mark: 50, max_mark: 59, grade_point: 3.00, remarks: 'Satisfactory' },
      { grade_name: 'C', min_mark: 40, max_mark: 49, grade_point: 2.00, remarks: 'Average' },
      { grade_name: 'D', min_mark: 33, max_mark: 39, grade_point: 1.00, remarks: 'Pass' },
      { grade_name: 'F', min_mark: 0, max_mark: 32, grade_point: 0.00, remarks: 'Fail' },
    ];
    
    setLoading(true);
    
    for (const grade of defaultGrades) {
      const { error } = await supabase
        .from('grading_rules')
        .insert([{
          academic_year_id: selectedAcademicYear === 'all' ? null : selectedAcademicYear,
          ...grade,
          is_default: grade.grade_name === 'A+',
          is_active: true,
        }]);
      
      if (error) {
        console.error('Error loading default grade:', error);
      }
    }
    
    toast.success('Default grade rules loaded');
    fetchGrades();
    setLoading(false);
  };

  useEffect(() => {
    fetchAcademicYears();
    fetchBonusPolicy();
  }, []);

  useEffect(() => {
    fetchGrades();
  }, [selectedAcademicYear, fetchGrades]);

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-800 p-6 shadow-2xl">
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
                <Percent className="h-8 w-8" />
                GPA Rules
                <Badge className="bg-purple-400 text-black ml-2">Settings</Badge>
              </h1>
              <p className="text-indigo-100 mt-2">Configure grade and GPA calculation rules</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={loadDefaultGrades}
                variant="outline"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                Load Default Grades
              </Button>
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

        {/* Academic Year Filter */}
        <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-r from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
          <CardContent className="p-6">
            <div className="max-w-md">
              <Label>Filter by Academic Year</Label>
              <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                <SelectTrigger className="bg-white dark:bg-gray-800">
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Academic Years</SelectItem>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name} {year.is_current && '(Current)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="grades" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="grades">Grading Rules</TabsTrigger>
            <TabsTrigger value="bonus">Bonus Policy</TabsTrigger>
          </TabsList>
          
          <TabsContent value="grades" className="mt-6">
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
                    Create grading rules or load default grades.
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={loadDefaultGrades}>
                      Load Default Grades
                    </Button>
                    <Button onClick={() => setOpen(true)} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Manually
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-indigo-500 to-purple-600">
                      <TableRow>
                        <TableHead className="text-white">Grade</TableHead>
                        <TableHead className="text-white">Min Mark</TableHead>
                        <TableHead className="text-white">Max Mark</TableHead>
                        <TableHead className="text-white">GPA</TableHead>
                        <TableHead className="text-white">Remarks</TableHead>
                        <TableHead className="text-white">Default</TableHead>
                        <TableHead className="text-white">Status</TableHead>
                        <TableHead className="text-white text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grades.map((grade) => (
                        <TableRow key={grade.id}>
                          <TableCell className="font-bold text-lg">{grade.grade_name}</TableCell>
                          <TableCell>{grade.min_mark}</TableCell>
                          <TableCell>{grade.max_mark}</TableCell>
                          <TableCell>{grade.grade_point.toFixed(2)}</TableCell>
                          <TableCell>{grade.remarks || '-'}</TableCell>
                          <TableCell>
                            {grade.is_default && (
                              <Badge className="bg-green-100 text-green-700">Default</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {grade.is_active ? (
                              <Badge className="bg-green-100 text-green-700">Active</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(grade)}
                              className="mr-1"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(grade.id)}
                              className="text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="bonus" className="mt-6">
            <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Elective Subject Bonus Policy</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Configure how bonus points are added for elective subjects
                    </p>
                  </div>
                  
                  <div className="space-y-4 max-w-md">
                    <div>
                      <Label>Bonus Points to Add</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={bonusPolicy.elective_bonus_points}
                        onChange={(e) => setBonusPolicy({
                          ...bonusPolicy,
                          elective_bonus_points: parseFloat(e.target.value) || 0
                        })}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Additional GPA points added to total GPA when bonus conditions are met
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={bonusPolicy.apply_bonus_if_all_elective_pass}
                        onChange={(e) => setBonusPolicy({
                          ...bonusPolicy,
                          apply_bonus_if_all_elective_pass: e.target.checked
                        })}
                        className="h-4 w-4"
                      />
                      <Label className="cursor-pointer">
                        Apply bonus only if all elective subjects are passed
                      </Label>
                    </div>
                    
                    <div className="pt-4">
                      <Button onClick={saveBonusPolicy} disabled={savingBonus}>
                        {savingBonus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Bonus Policy
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      How GPA is Calculated
                    </h4>
                    <div className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <p>1. Calculate GPA from all subjects: <strong>Sum(GPA × Credit) / Total Credits</strong></p>
                      <p>2. If bonus conditions are met: <strong>Final GPA = Calculated GPA + Bonus Points</strong></p>
                      <p>3. Maximum GPA is capped at 5.00</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>{editingGrade ? 'Edit Grade Rule' : 'Create New Grade Rule'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Grade Name *</Label>
                <Input
                  value={formData.grade_name}
                  onChange={(e) => setFormData({ ...formData, grade_name: e.target.value.toUpperCase() })}
                  placeholder="e.g., A+, A, A-, B+"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Mark *</Label>
                  <Input
                    type="number"
                    value={formData.min_mark}
                    onChange={(e) => setFormData({ ...formData, min_mark: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Max Mark *</Label>
                  <Input
                    type="number"
                    value={formData.max_mark}
                    onChange={(e) => setFormData({ ...formData, max_mark: Number(e.target.value) })}
                  />
                </div>
              </div>
              
              <div>
                <Label>Grade Point (GPA) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.grade_point}
                  onChange={(e) => setFormData({ ...formData, grade_point: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <Label>Remarks</Label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g., Excellent, Very Good"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label className="cursor-pointer">Set as Default Grade Rule</Label>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label className="cursor-pointer">Active</Label>
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
      </div>
    </ResponsiveLayout>
  );
}
