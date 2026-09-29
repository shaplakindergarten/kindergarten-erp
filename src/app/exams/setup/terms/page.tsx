'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw,
  Calendar,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface ExamTerm {
  id: string;
  name: string;
  term_code: string;
  weightage_percentage: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  result_status: string;
  academic_year_id: string;
}

interface AcademicYear {
  id: string;
  name: string;
  is_current: boolean;
}

export default function ExamTermsPage() {
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [open, setOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<ExamTerm | null>(null);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    term_code: '',
    weightage_percentage: 100,
    start_date: '',
    end_date: '',
    status: 'upcoming',
    academic_year_id: '',
  });

  const codeRegex = /^[a-z0-9_]+$/;

  // Check if term code is unique
  const checkTermCodeUniqueness = useCallback(async (code: string, excludeId?: string) => {
    if (!code || !formData.academic_year_id) {
      setCodeAvailable(null);
      return false;
    }
    
    setCheckingCode(true);
    
    let query = supabase
      .from('exam_terms')
      .select('id')
      .eq('term_code', code.toLowerCase())
      .eq('academic_year_id', formData.academic_year_id);
    
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    
    const { data, error } = await query;
    
    setCheckingCode(false);
    
    if (error) {
      console.error('Error checking code:', error);
      return false;
    }
    
    const isAvailable = !data || data.length === 0;
    setCodeAvailable(isAvailable);
    return isAvailable;
  }, [formData.academic_year_id]);

  const fetchAcademicYears = useCallback(async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, name, is_current')
      .order('name', { ascending: false });
    
    if (error) {
      console.error('Error fetching academic years:', error);
      toast.error('Failed to load academic years');
      return;
    }
    
    if (data && data.length > 0) {
      setAcademicYears(data);
      if (!formData.academic_year_id) {
        const currentYear = data.find(y => y.is_current);
        if (currentYear) {
          setFormData(prev => ({ ...prev, academic_year_id: currentYear.id }));
        } else if (data.length > 0) {
          setFormData(prev => ({ ...prev, academic_year_id: data[0].id }));
        }
      }
    } else {
      toast.error('No academic years found. Please create an academic year first.');
    }
  }, [formData.academic_year_id]);

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('exam_terms')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching terms:', error);
      toast.error('Failed to load terms');
    } else {
      setTerms(data || []);
    }
    setLoading(false);
  }, []);

  const checkLinkedData = async (termId: string): Promise<boolean> => {
    try {
      // Check exam_subjects
      const { count: subjectsCount, error: subjectsError } = await supabase
        .from('exam_subjects')
        .select('id', { count: 'exact', head: true })
        .eq('term_id', termId);
      
      if (subjectsError) {
        console.error('Error checking subjects:', subjectsError);
      } else if (subjectsCount && subjectsCount > 0) {
        toast.error(`Cannot delete: ${subjectsCount} subject(s) are linked to this term.`);
        return false;
      }
      
      // Check student_marks_new
      const { count: marksCount, error: marksError } = await supabase
        .from('student_marks_new')
        .select('id', { count: 'exact', head: true })
        .eq('term_id', termId);
      
      if (marksError) {
        console.error('Error checking marks:', marksError);
      } else if (marksCount && marksCount > 0) {
        toast.error(`Cannot delete: ${marksCount} mark(s) are linked to this term.`);
        return false;
      }
      
      // Check compiled_results
      const { count: resultsCount, error: resultsError } = await supabase
        .from('compiled_results')
        .select('id', { count: 'exact', head: true })
        .eq('term_id', termId);
      
      if (resultsError) {
        console.error('Error checking results:', resultsError);
      } else if (resultsCount && resultsCount > 0) {
        toast.error(`Cannot delete: ${resultsCount} result(s) are linked to this term.`);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error checking linked data:', err);
      return false;
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name || !formData.name.trim()) {
      toast.error('Term name is required');
      return;
    }
    
    if (!formData.term_code || !formData.term_code.trim()) {
      toast.error('Term code is required');
      return;
    }
    
    // Regex validation for term_code
    if (!codeRegex.test(formData.term_code)) {
      toast.error('Only lowercase letters, numbers and underscores allowed for term code');
      return;
    }
    
    if (!formData.academic_year_id) {
      toast.error('Academic year is required');
      return;
    }
    
    // Weightage validation
    if (formData.weightage_percentage < 1 || formData.weightage_percentage > 100) {
      toast.error('Weightage must be between 1 and 100');
      return;
    }
    
    // Date validation
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      toast.error('End date must be after start date');
      return;
    }
    
    // Check if term code is unique (for new term only)
    if (!editingTerm) {
      const isUnique = await checkTermCodeUniqueness(formData.term_code);
      if (!isUnique) {
        toast.error(`Term code "${formData.term_code}" already exists in this academic year. Please use a different code.`);
        return;
      }
    } else {
      // For editing, check if code is unique excluding current term
      // Only check if code or academic year changed
      const codeChanged = formData.term_code !== editingTerm.term_code;
      const yearChanged = formData.academic_year_id !== editingTerm.academic_year_id;
      
      if (codeChanged || yearChanged) {
        const isUnique = await checkTermCodeUniqueness(formData.term_code, editingTerm.id);
        if (!isUnique) {
          toast.error(`Term code "${formData.term_code}" already exists in this academic year. Please use a different code.`);
          return;
        }
      } else {
        setCodeAvailable(true);
      }
    }
    
    setLoading(true);
    
    try {
      const termData = {
        name: formData.name.trim(),
        term_code: formData.term_code.trim().toLowerCase(),
        academic_year_id: formData.academic_year_id,
        weightage_percentage: formData.weightage_percentage || 100,
        status: formData.status || 'upcoming',
      };
      
      if (formData.start_date) {
        (termData as any).start_date = formData.start_date;
      }
      if (formData.end_date) {
        (termData as any).end_date = formData.end_date;
      }
      
      if (!editingTerm) {
        (termData as any).result_status = 'draft';
      }
      
      let result;
      if (editingTerm) {
        result = await supabase
          .from('exam_terms')
          .update(termData)
          .eq('id', editingTerm.id);
      } else {
        result = await supabase
          .from('exam_terms')
          .insert(termData);
      }
      
      if (result.error) {
        if (result.error.code === '23505') {
          toast.error('This term code already exists. Please use a different term code.');
        } else {
          toast.error(`Failed to save: ${result.error.message}`);
        }
      } else {
        toast.success(editingTerm ? 'Term updated successfully' : 'Term created successfully');
        setOpen(false);
        resetForm();
        fetchTerms();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // First check if term has linked data
    const canDelete = await checkLinkedData(id);
    if (!canDelete) {
      return;
    }
    
    if (!confirm('Delete this term? All related data (subjects, marks, results) will be lost. This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('exam_terms')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting term:', error);
        toast.error('Failed to delete: ' + error.message);
      } else {
        toast.success('Term deleted successfully');
        fetchTerms();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (term: ExamTerm) => {
    setEditingTerm(term);
    setFormData({
      name: term.name,
      term_code: term.term_code,
      weightage_percentage: term.weightage_percentage || 100,
      start_date: term.start_date || '',
      end_date: term.end_date || '',
      status: term.status || 'upcoming',
      academic_year_id: term.academic_year_id,
    });
    setCodeAvailable(true);
    setOpen(true);
  };

  const resetForm = () => {
    setEditingTerm(null);
    setCodeAvailable(null);
    const defaultAcademicYearId = academicYears.find(y => y.is_current)?.id || academicYears[0]?.id || '';
    setFormData({
      name: '',
      term_code: '',
      weightage_percentage: 100,
      start_date: '',
      end_date: '',
      status: 'upcoming',
      academic_year_id: defaultAcademicYearId,
    });
  };

  // Check code when term_code or academic_year changes
  useEffect(() => {
    if (formData.term_code && formData.term_code.trim() && formData.academic_year_id) {
      // For edit mode, check if code or year changed from original
      if (editingTerm) {
        const codeChanged = formData.term_code !== editingTerm.term_code;
        const yearChanged = formData.academic_year_id !== editingTerm.academic_year_id;
        
        if (!codeChanged && !yearChanged) {
          setCodeAvailable(true);
          return;
        }
      }
      
      const delayDebounce = setTimeout(() => {
        checkTermCodeUniqueness(formData.term_code, editingTerm?.id);
      }, 500);
      return () => clearTimeout(delayDebounce);
    } else {
      setCodeAvailable(null);
    }
  }, [formData.term_code, formData.academic_year_id, editingTerm, checkTermCodeUniqueness]);

  useEffect(() => {
    fetchAcademicYears();
    fetchTerms();
  }, [fetchAcademicYears, fetchTerms]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Upcoming</Badge>;
      case 'ongoing':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Ongoing</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getResultStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">Draft</Badge>;
      case 'processing':
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Processing</Badge>;
      case 'generated':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Generated</Badge>;
      case 'published':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Published</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
                <Calendar className="h-8 w-8" />
                Exam Terms
                <Badge className="bg-purple-400 text-black ml-2">Setup</Badge>
              </h1>
              <p className="text-indigo-100 mt-2">Create, edit and manage exam terms</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => {
                  resetForm();
                  setOpen(true);
                }}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Term
              </Button>
              <Button 
                onClick={fetchTerms} 
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

        {/* Terms Table */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-gray-900">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : terms.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Exam Terms Found</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Create your first exam term to get started.
              </p>
              <Button onClick={() => setOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Term
              </Button>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-indigo-500 to-purple-600">
                  <TableRow>
                    <TableHead className="text-white">Term Name</TableHead>
                    <TableHead className="text-white">Code</TableHead>
                    <TableHead className="text-white">Weightage</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white">Result</TableHead>
                    <TableHead className="text-white text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((term) => (
                    <TableRow key={term.id}>
                      <TableCell className="font-medium text-gray-900 dark:text-white">{term.name}</TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                          {term.term_code}
                        </code>
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">{term.weightage_percentage}%</TableCell>
                      <TableCell>{getStatusBadge(term.status)}</TableCell>
                      <TableCell>{getResultStatusBadge(term.result_status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(term)}
                          className="mr-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(term.id)}
                          className="text-red-500 hover:text-red-700"
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

        {/* Add/Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">{editingTerm ? 'Edit Exam Term' : 'Create New Exam Term'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Academic Year *</Label>
                <Select 
                  value={formData.academic_year_id} 
                  onValueChange={(v) => setFormData({ ...formData, academic_year_id: v })}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id} className="text-gray-900 dark:text-gray-100">
                        {year.name} {year.is_current && '(Current)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Term Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 1st Month Examination"
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Term Code *</Label>
                <div className="relative">
                  <Input
                    value={formData.term_code}
                    onChange={(e) => setFormData({ ...formData, term_code: e.target.value })}
                    placeholder="e.g., monthly_1, semester_1, annual"
                    className={`bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                      codeAvailable === true ? 'border-green-500 pr-10' : ''
                    } ${
                      codeAvailable === false ? 'border-red-500 pr-10' : ''
                    }`}
                  />
                  {checkingCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  )}
                  {codeAvailable === true && !checkingCode && formData.term_code && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                  {codeAvailable === false && !checkingCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <XCircle className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use lowercase letters, numbers, and underscores only. Must be unique per academic year.
                </p>
                {codeAvailable === false && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ This term code already exists. Please use a different code.
                  </p>
                )}
                {codeAvailable === true && !editingTerm && formData.term_code && (
                  <p className="text-xs text-green-500 mt-1">
                    ✓ Term code is available
                  </p>
                )}
              </div>
              
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Weightage (%) *</Label>
                <Input
                  type="number"
                  value={formData.weightage_percentage}
                  onChange={(e) => setFormData({ ...formData, weightage_percentage: Number(e.target.value) })}
                  placeholder="100"
                  min="1"
                  max="100"
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Must be between 1 and 100</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Start Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    <SelectItem value="upcoming" className="text-gray-900 dark:text-gray-100">Upcoming</SelectItem>
                    <SelectItem value="ongoing" className="text-gray-900 dark:text-gray-100">Ongoing</SelectItem>
                    <SelectItem value="completed" className="text-gray-900 dark:text-gray-100">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSave} 
                disabled={loading || checkingCode || codeAvailable === false}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingTerm ? 'Update Term' : 'Create Term')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  );
}
