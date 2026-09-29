'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle, TrendingUp, ArrowLeft, RefreshCw, School, Users } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface Subject {
  exam_subject_id: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
  total_students: number;
  locked_count: number;
  is_fully_locked: boolean;
}

interface GenerationSummary {
  term_name: string;
  class_name: string;
  section_name: string;
  total_students: number;
  total_subjects: number;
  locked_subjects_count: number;
  is_generated: boolean;
  subjects: Subject[];
}

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
  class_id: string;
}

export default function GenerateResultPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  
  // Filters
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  // Load filters data
  useEffect(() => {
    const loadFilters = async () => {
      const [termsRes, classesRes] = await Promise.all([
        supabase.from('exam_terms').select('id, name').order('created_at'),
        supabase.from('classes').select('id, name').order('numeric_order')
      ]);
      if (termsRes.data) setTerms(termsRes.data);
      if (classesRes.data) setClasses(classesRes.data);
    };
    loadFilters();
  }, []);

  // Load sections when class changes
  useEffect(() => {
    const loadSections = async () => {
      if (!selectedClass) {
        setSections([]);
        return;
      }
      const { data } = await supabase
        .from('sections')
        .select('id, name, class_id')
        .eq('class_id', selectedClass);
      if (data) setSections(data);
    };
    loadSections();
  }, [selectedClass]);

  // Load summary when all filters selected
  useEffect(() => {
    if (selectedTerm && selectedClass && selectedSection) {
      loadData();
    }
  }, [selectedTerm, selectedClass, selectedSection]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_generation_summary', {
        p_term_id: selectedTerm,
        p_class_id: selectedClass,
        p_section_id: selectedSection
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (result) {
        setSummary(result);
        const subjectsList = result.subjects || [];
        setSubjects(subjectsList);
        
        const lockedIds = subjectsList
          .filter((s: Subject) => s.is_fully_locked)
          .map((s: Subject) => s.exam_subject_id);
        setSelectedIds(lockedIds);
        setIsGenerated(result.is_generated || false);
      }
    } catch (err) {
      console.error('Load error:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) {
      toast.info('No subjects selected');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_section_results', {
        p_term_id: selectedTerm,
        p_class_id: selectedClass,
        p_section_id: selectedSection,
        p_subject_ids: selectedIds
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (result?.success) {
        toast.success(result.message);
        await loadData();
        setSelectedIds([]);
      } else {
        toast.error(result?.message || 'Generation failed');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Failed to generate results');
    } finally {
      setGenerating(false);
    }
  };

  const toggleSubject = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allLockedIds = subjects.filter(s => s.is_fully_locked && !isGenerated).map(s => s.exam_subject_id);
    if (selectedIds.length === allLockedIds.length && allLockedIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allLockedIds);
    }
  };

  const handleRefresh = () => {
    if (selectedTerm && selectedClass && selectedSection) {
      loadData();
    }
  };

  const lockableCount = subjects.filter(s => s.is_fully_locked && !isGenerated).length;
  const allSelected = selectedIds.length === lockableCount && lockableCount > 0;
  const needsSelection = !selectedTerm || !selectedClass || !selectedSection;

  return (
    <ResponsiveLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-800 rounded-2xl p-6 text-white">
          <Link href="/exams/dashboard">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2 mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Generate Results</h1>
          <p className="text-purple-100 mt-1">Generate final results from locked marks</p>
        </div>

        {/* Filters Section */}
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Exam Term</Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Section</Label>
                <Select 
                  value={selectedSection} 
                  onValueChange={setSelectedSection}
                  disabled={!selectedClass || sections.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={sections.length === 0 ? "No sections" : "Select section"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleRefresh}
                  disabled={loading || needsSelection}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        )}

        {/* No Selection State */}
        {!loading && needsSelection && (
          <Card>
            <CardContent className="py-12 text-center">
              <School className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Please select Term, Class and Section to continue</p>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {!loading && !needsSelection && summary && (
          <>
            {/* Info Card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {summary.term_name} | {summary.class_name} | {summary.section_name}
                    </h3>
                    <div className="flex gap-4 mt-1 text-sm text-gray-500">
                      <span>📚 Students: <strong>{summary.total_students}</strong></span>
                      <span>📖 Subjects: <strong>{summary.total_subjects}</strong></span>
                      <span>🔒 Locked: <strong className="text-green-600">{lockableCount}</strong></span>
                    </div>
                  </div>
                  {!isGenerated && lockableCount > 0 && (
                    <Button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                      Generate Results ({selectedIds.length} subjects)
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Already Generated Message */}
            {isGenerated && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-5 text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                  <p className="text-green-700 font-medium text-lg">Results Already Generated!</p>
                  <p className="text-green-600 text-sm mt-1">You can now publish these results.</p>
                  <Link href="/exams/results/publish">
                    <Button variant="outline" className="mt-3">Go to Publish →</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Select All - Only show if not already generated */}
            {!isGenerated && lockableCount > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={allSelected} onCheckedChange={selectAll} />
                  <span className="font-medium">Select All Locked Subjects</span>
                </label>
                <Badge variant="outline">{selectedIds.length} / {lockableCount} selected</Badge>
              </div>
            )}

            {/* Subjects List */}
            <div className="space-y-3">
              {subjects.map((subject) => {
                const isSelectable = subject.is_fully_locked && !isGenerated;
                const isSelected = selectedIds.includes(subject.exam_subject_id);
                const percentage = subject.total_students > 0 
                  ? Math.round((subject.locked_count / subject.total_students) * 100) 
                  : 0;

                return (
                  <Card key={subject.exam_subject_id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {!isGenerated && (
                          <Checkbox
                            checked={isSelectable && isSelected}
                            onCheckedChange={() => isSelectable && toggleSubject(subject.exam_subject_id)}
                            disabled={!isSelectable}
                            className="mt-1"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div>
                              <p className="font-medium text-gray-900">{subject.subject_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Full Marks: {subject.full_marks} | Pass: {subject.pass_marks}
                              </p>
                            </div>
                            <Badge className={subject.is_fully_locked ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                              {subject.is_fully_locked ? "✓ Ready" : `${subject.locked_count}/${subject.total_students} Locked`}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <Progress value={percentage} className="h-2 flex-1" />
                            <span className="text-xs text-gray-500 w-12">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Generating Status */}
            {generating && (
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  <span className="text-purple-900">Generating results in database...</span>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
