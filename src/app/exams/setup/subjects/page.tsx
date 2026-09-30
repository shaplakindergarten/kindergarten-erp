'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { 
  Loader2, 
  Plus, 
  Trash2, 
  RefreshCw,
  BookOpen,
  AlertCircle,
  ArrowLeft,
  Edit,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface ExamTerm {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  subject_type: string;
}

interface ExamSubject {
  id: string;
  term_id: string;
  class_id: string;
  section_id: string | null;
  subject_id: string;
  subject_type: string;
  full_marks: number;
  pass_marks: number;
  subject?: Subject;
}

// Subject order: Bangla, English, Mathematics, Religion, Science, BGS, Drawing
const SUBJECT_ORDER = [
  'Bangla', 'Bengali',
  'English',
  'Mathematics', 'Math',
  'Religion',
  'Science',
  'BGS', 'Social Science', 'Social Studies',
  'Drawing', 'Arts'
];

const getSubjectOrderIndex = (subjectName: string): number => {
  const lowerName = subjectName.toLowerCase();
  for (let i = 0; i < SUBJECT_ORDER.length; i++) {
    if (lowerName.includes(SUBJECT_ORDER[i].toLowerCase())) {
      return i;
    }
  }
  return 999;
};

export default function SubjectAssignmentPage() {
  const [loading, setLoading] = useState(false);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectFormData, setSubjectFormData] = useState({
    name: '',
    code: '',
    subject_type: 'compulsory',
  });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  
  const [deleteExamSubjectDialogOpen, setDeleteExamSubjectDialogOpen] = useState(false);
  const [deletingExamSubjectId, setDeletingExamSubjectId] = useState<string | null>(null);
  
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedSourceTerm, setSelectedSourceTerm] = useState<string>("");
  
  const [formData, setFormData] = useState({
    subject_id: '',
    subject_type: 'compulsory',
    full_marks: 100,
    pass_marks: 33,
  });

  const fetchSections = useCallback(async (classId: string) => {
    if (!classId) return;
    try {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name')
        .eq('class_id', classId);
      if (error) throw error;
      if (data) setSections(data);
      // Reset section when class changes
      setSelectedSection("all");
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  }, []);

  const fetchTerms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('exam_terms')
        .select('id, name')
        .order('created_at');
      if (error) throw error;
      if (data) setTerms(data);
      if (data && data.length > 0 && !selectedTerm) {
        setSelectedTerm(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching terms:', err);
    }
  }, [selectedTerm]);

  const fetchClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .order('numeric_order');
      if (error) throw error;
      if (data) setClasses(data);
      if (data && data.length > 0 && !selectedClass) {
        setSelectedClass(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  }, [selectedClass]);

  const fetchSubjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code, subject_type')
        .order('name');
      
      if (error) throw error;
      
      if (data) {
        const sorted = [...data].sort((a, b) => {
          const indexA = getSubjectOrderIndex(a.name);
          const indexB = getSubjectOrderIndex(b.name);
          if (indexA === indexB) {
            return a.name.localeCompare(b.name);
          }
          return indexA - indexB;
        });
        setSubjects(sorted);
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
      toast.error('Failed to load subjects');
    }
  }, []);

  const fetchExamSubjects = useCallback(async () => {
    if (!selectedTerm || !selectedClass) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('exam_subjects')
        .select(`
          id,
          subject_id,
          subject_type,
          full_marks,
          pass_marks,
          subject:subject_id(
            id,
            name,
            code
          )
        `)
        .eq('term_id', selectedTerm)
        .eq('class_id', selectedClass);
      
      if (selectedSection && selectedSection !== 'all') {
        query = query.eq('section_id', selectedSection);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data) {
        const typedData = data as unknown as ExamSubject[];
        const sorted = [...typedData].sort((a, b) => {
          const nameA = a.subject?.name || '';
          const nameB = b.subject?.name || '';
          const indexA = getSubjectOrderIndex(nameA);
          const indexB = getSubjectOrderIndex(nameB);
          if (indexA === indexB) {
            return nameA.localeCompare(nameB);
          }
          return indexA - indexB;
        });
        setExamSubjects(sorted);
      }
    } catch (err) {
      console.error('Error fetching exam subjects:', err);
      toast.error('Failed to load assigned subjects');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedClass, selectedSection]);

  const validateMarks = () => {
    if (!selectedTerm) {
      toast.error('Please select exam term');
      return false;
    }
    if (!selectedClass) {
      toast.error('Please select class');
      return false;
    }
    if (formData.full_marks <= 0) {
      toast.error('Full marks must be greater than 0');
      return false;
    }
    if (formData.pass_marks < 0) {
      toast.error('Pass marks cannot be negative');
      return false;
    }
    if (formData.pass_marks > formData.full_marks) {
      toast.error('Pass marks cannot exceed full marks');
      return false;
    }
    return true;
  };

  const handleBulkAdd = async () => {
    if (selectedSubjectIds.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }
    
    if (!validateMarks()) return;
    
    setLoading(true);
    
    try {
      const sectionId = selectedSection === 'all' ? null : selectedSection;
      
      const payload = selectedSubjectIds.map(subjectId => ({
        term_id: selectedTerm,
        class_id: selectedClass,
        section_id: sectionId,
        subject_id: subjectId,
        subject_type: formData.subject_type,
        full_marks: formData.full_marks,
        pass_marks: formData.pass_marks,
      }));
      
      const { error } = await supabase
        .from('exam_subjects')
        .upsert(payload, {
          onConflict: 'term_id, class_id, section_id, subject_id',
        });
      
      if (error) throw error;
      
      toast.success(`${selectedSubjectIds.length} subjects added successfully`);
      setSelectedSubjectIds([]);
      fetchExamSubjects();
    } catch (err) {
      console.error('Error in bulk add:', err);
      toast.error('Failed to add subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.subject_id) {
      toast.error('Please select a subject');
      return;
    }
    
    if (!validateMarks()) return;
    
    setLoading(true);
    
    try {
      const sectionId = selectedSection === 'all' ? null : selectedSection;
      
      const { error } = await supabase
        .from('exam_subjects')
        .upsert({
          term_id: selectedTerm,
          class_id: selectedClass,
          section_id: sectionId,
          subject_id: formData.subject_id,
          subject_type: formData.subject_type,
          full_marks: formData.full_marks,
          pass_marks: formData.pass_marks,
        }, {
          onConflict: 'term_id, class_id, section_id, subject_id',
        });
      
      if (error) throw error;
      
      toast.success('Subject added successfully');
      setFormData({
        subject_id: '',
        subject_type: 'compulsory',
        full_marks: 100,
        pass_marks: 33,
      });
      fetchExamSubjects();
    } catch (err) {
      console.error('Error adding subject:', err);
      toast.error('Failed to add subject');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExamSubject = async () => {
    if (!deletingExamSubjectId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('exam_subjects')
        .delete()
        .eq('id', deletingExamSubjectId);
      if (error) throw error;
      toast.success('Subject removed');
      fetchExamSubjects();
    } catch (err) {
      console.error('Error deleting exam subject:', err);
      toast.error('Failed to remove subject');
    } finally {
      setLoading(false);
      setDeleteExamSubjectDialogOpen(false);
      setDeletingExamSubjectId(null);
    }
  };

  const handleCopyFromTerm = async () => {
    if (!selectedSourceTerm) {
      toast.error('Please select a source term');
      return;
    }
    
    if (!selectedClass) {
      toast.error('Please select a class');
      return;
    }
    
    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      let query = supabase
        .from('exam_subjects')
        .select('subject_id, subject_type, full_marks, pass_marks')
        .eq('term_id', selectedSourceTerm)
        .eq('class_id', selectedClass);
      
      if (selectedSection && selectedSection !== 'all') {
        query = query.eq('section_id', selectedSection);
      }
      
      const { data: sourceSubjects, error } = await query;
      if (error) throw error;
      
      if (!sourceSubjects || sourceSubjects.length === 0) {
        toast.info('No subjects found in source term for this class');
        setLoading(false);
        setCopyDialogOpen(false);
        return;
      }
      
      const sectionId = selectedSection === 'all' ? null : selectedSection;
      
      const payload = sourceSubjects.map(sub => ({
        term_id: selectedTerm,
        class_id: selectedClass,
        section_id: sectionId,
        subject_id: sub.subject_id,
        subject_type: sub.subject_type,
        full_marks: sub.full_marks,
        pass_marks: sub.pass_marks,
      }));
      
      const { error: upsertError } = await supabase
        .from('exam_subjects')
        .upsert(payload, {
          onConflict: 'term_id, class_id, section_id, subject_id',
        });
      
      if (upsertError) throw upsertError;
      
      successCount = sourceSubjects.length;
      toast.success(`${successCount} subjects copied successfully`);
      
      fetchExamSubjects();
    } catch (err) {
      console.error('Error copying subjects:', err);
      toast.error('Failed to copy subjects');
    } finally {
      setLoading(false);
      setCopyDialogOpen(false);
      setSelectedSourceTerm('');
    }
  };

  const handleCreateSubject = async () => {
    if (!subjectFormData.name || !subjectFormData.name.trim()) {
      toast.error('Subject name is required');
      return;
    }
    
    setLoading(true);
    try {
      // Check for duplicate subject
      const { data: existing, error: checkError } = await supabase
        .from('subjects')
        .select('id')
        .ilike('name', subjectFormData.name.trim())
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existing) {
        toast.error('Subject already exists');
        setLoading(false);
        return;
      }
      
      const newSubject = {
        name: subjectFormData.name.trim(),
        code: subjectFormData.code.trim() || subjectFormData.name.trim().substring(0, 3).toUpperCase(),
        subject_type: subjectFormData.subject_type,
      };
      
      const { error } = await supabase
        .from('subjects')
        .insert([newSubject]);
      if (error) throw error;
      
      toast.success('Subject created successfully');
      setSubjectDialogOpen(false);
      resetSubjectForm();
      fetchSubjects();
    } catch (err) {
      console.error('Error creating subject:', err);
      toast.error('Failed to create subject');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateSubject = async () => {
    if (!editingSubject) return;
    if (!subjectFormData.name || !subjectFormData.name.trim()) {
      toast.error('Subject name is required');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          name: subjectFormData.name.trim(),
          code: subjectFormData.code.trim(),
          subject_type: subjectFormData.subject_type,
        })
        .eq('id', editingSubject.id);
      if (error) throw error;
      
      toast.success('Subject updated successfully');
      setSubjectDialogOpen(false);
      resetSubjectForm();
      fetchSubjects();
    } catch (err) {
      console.error('Error updating subject:', err);
      toast.error('Failed to update subject');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteSubject = async () => {
    if (!deletingSubjectId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', deletingSubjectId);
      if (error) {
        if (error.code === '23503') {
          toast.error('Cannot delete this subject because it is used in exams');
        } else {
          throw error;
        }
      } else {
        toast.success('Subject deleted successfully');
        fetchSubjects();
        fetchExamSubjects();
      }
    } catch (err) {
      console.error('Error deleting subject:', err);
      toast.error('Failed to delete subject');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setDeletingSubjectId(null);
    }
  };
  
  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectFormData({
      name: subject.name,
      code: subject.code || '',
      subject_type: subject.subject_type || 'compulsory',
    });
    setSubjectDialogOpen(true);
  };
  
  const resetSubjectForm = () => {
    setEditingSubject(null);
    setSubjectFormData({
      name: '',
      code: '',
      subject_type: 'compulsory',
    });
  };

  const toggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const toggleAllSubjects = () => {
    if (selectedSubjectIds.length === subjects.length) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(subjects.map(s => s.id));
    }
  };

  useEffect(() => {
    if (selectedClass) {
      fetchSections(selectedClass);
    }
  }, [selectedClass, fetchSections]);

  useEffect(() => {
    fetchTerms();
    fetchClasses();
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedTerm && selectedClass) {
      fetchExamSubjects();
    }
  }, [selectedTerm, selectedClass, selectedSection, fetchExamSubjects]);

  const needsSelection = !selectedTerm || !selectedClass;

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-6 shadow-2xl">
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
                <BookOpen className="h-8 w-8" />
                Subject Assignment
                <Badge className="bg-teal-400 text-black ml-2">Setup</Badge>
              </h1>
              <p className="text-emerald-100 mt-2">Assign subjects to exam terms and classes</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => {
                  resetSubjectForm();
                  setSubjectDialogOpen(true);
                }}
                variant="outline"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Subject
              </Button>
              <Button onClick={fetchExamSubjects} disabled={loading || needsSelection} variant="outline" className="bg-white/20 hover:bg-white/30 text-white border-0">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-r from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Exam Term *</Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Class *</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Section (Optional)</Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Copy Section */}
        {!needsSelection && terms.length > 1 && (
          <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-700 dark:text-gray-300">Copy subjects from another term for current selected class only:</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCopyDialogOpen(true)}
                  className="bg-white dark:bg-gray-800"
                >
                  <Copy className="mr-2 h-3 w-3" />
                  Copy from Term
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bulk Add Section */}
        {!needsSelection && subjects.length > 0 && (
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Add Multiple Subjects</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleAllSubjects}
                  className="text-sm"
                >
                  {selectedSubjectIds.length === subjects.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4 max-h-[200px] overflow-y-auto p-2 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                {subjects.map((subject) => (
                  <label key={subject.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                    <Checkbox
                      checked={selectedSubjectIds.includes(subject.id)}
                      onCheckedChange={() => toggleSubjectSelection(subject.id)}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 
                                 border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-800"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{subject.name}</span>
                    {subject.code && (
                      <span className="text-xs text-gray-400">({subject.code})</span>
                    )}
                  </label>
                ))}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Subject Type</Label>
                  <Select value={formData.subject_type} onValueChange={(v) => setFormData({ ...formData, subject_type: v })}>
                    <SelectTrigger className="bg-white dark:bg-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800">
                      <SelectItem value="compulsory">Compulsory</SelectItem>
                      <SelectItem value="elective">Elective</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Full Marks *</Label>
                  <Input
                    type="number"
                    value={formData.full_marks}
                    onChange={(e) => setFormData({ ...formData, full_marks: Number(e.target.value) })}
                    className="bg-white dark:bg-gray-800"
                    min="1"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Pass Marks *</Label>
                  <Input
                    type="number"
                    value={formData.pass_marks}
                    onChange={(e) => setFormData({ ...formData, pass_marks: Number(e.target.value) })}
                    className="bg-white dark:bg-gray-800"
                    min="0"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleBulkAdd} disabled={loading || selectedSubjectIds.length === 0} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Selected ({selectedSubjectIds.length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Single Subject */}
        {!needsSelection && (
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Single Subject</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Subject</Label>
                  <Select value={formData.subject_id} onValueChange={(v) => setFormData({ ...formData, subject_id: v })}>
                    <SelectTrigger className="bg-white dark:bg-gray-800">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                      {subjects.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.name} {sub.code && `(${sub.code})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Subject Type</Label>
                  <Select value={formData.subject_type} onValueChange={(v) => setFormData({ ...formData, subject_type: v })}>
                    <SelectTrigger className="bg-white dark:bg-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800">
                      <SelectItem value="compulsory">Compulsory</SelectItem>
                      <SelectItem value="elective">Elective</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Full Marks *</Label>
                  <Input
                    type="number"
                    value={formData.full_marks}
                    onChange={(e) => setFormData({ ...formData, full_marks: Number(e.target.value) })}
                    className="bg-white dark:bg-gray-800"
                    min="1"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAdd} disabled={loading} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Subject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subject List Table */}
        {!needsSelection && (
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-gray-900">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : examSubjects.length === 0 ? (
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="h-10 w-10 text-gray-400 mb-2" />
                <p className="text-gray-500">No subjects assigned for this exam class yet</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-teal-500 to-cyan-600">
                    <TableRow>
                      <TableHead className="text-white">Subject</TableHead>
                      <TableHead className="text-white">Code</TableHead>
                      <TableHead className="text-white">Type</TableHead>
                      <TableHead className="text-white">Full Marks</TableHead>
                      <TableHead className="text-white">Pass Marks</TableHead>
                      <TableHead className="text-white text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examSubjects.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-gray-900 dark:text-white">
                          <div>
                            <div>{item.subject?.name}</div>
                            <div className="text-xs text-muted-foreground">{item.subject?.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {item.subject?.code || '-'}
                          </code>
                        </TableCell>
                        <TableCell>
                          {item.subject_type === 'compulsory' ? 
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Compulsory</Badge> : 
                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Elective</Badge>}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{item.full_marks}</TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{item.pass_marks}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setDeletingExamSubjectId(item.id);
                              setDeleteExamSubjectDialogOpen(true);
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
              </div>
            )}
          </Card>
        )}

        {/* Subject CRUD Dialog */}
        <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">{editingSubject ? 'Edit Subject' : 'Create New Subject'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Subject Name *</Label>
                <Input
                  value={subjectFormData.name}
                  onChange={(e) => setSubjectFormData({ ...subjectFormData, name: e.target.value })}
                  placeholder="e.g., Bangla, English, Mathematics"
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">English or Bengali input allowed</p>
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Subject Code</Label>
                <Input
                  value={subjectFormData.code}
                  onChange={(e) => setSubjectFormData({ ...subjectFormData, code: e.target.value })}
                  placeholder="e.g., BAN, ENG, MATH"
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Subject Type</Label>
                <Select 
                  value={subjectFormData.subject_type} 
                  onValueChange={(v) => setSubjectFormData({ ...subjectFormData, subject_type: v })}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    <SelectItem value="compulsory">Compulsory</SelectItem>
                    <SelectItem value="elective">Elective</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSubjectDialogOpen(false)}>Cancel</Button>
              <Button onClick={editingSubject ? handleUpdateSubject : handleCreateSubject} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingSubject ? 'Update' : 'Create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Copy Dialog */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Copy Subjects from Another Term</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-500">Copy subjects for <strong>{classes.find(c => c.id === selectedClass)?.name}</strong> class</p>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Source Term</Label>
                <Select value={selectedSourceTerm} onValueChange={setSelectedSourceTerm}>
                  <SelectTrigger className="bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Select term to copy from" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    {terms.filter(t => t.id !== selectedTerm).map((term) => (
                      <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCopyFromTerm} disabled={loading || !selectedSourceTerm}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                Copy Subjects
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Subject Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-white dark:bg-gray-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-white">Delete Subject</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
                Are you sure you want to delete this subject? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSubject} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Exam Subject Delete Confirmation Dialog */}
        <AlertDialog open={deleteExamSubjectDialogOpen} onOpenChange={setDeleteExamSubjectDialogOpen}>
          <AlertDialogContent className="bg-white dark:bg-gray-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-white">Remove Subject</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
                Are you sure you want to remove this subject from this exam? This will delete all marks entered for this subject.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExamSubject} className="bg-red-600 hover:bg-red-700">
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ResponsiveLayout>
  );
}
