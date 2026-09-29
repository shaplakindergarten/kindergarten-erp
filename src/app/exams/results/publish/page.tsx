'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle, AlertCircle, ArrowLeft, Send, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

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
  class_id: string;
}

export default function PublishResultPage() {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  // Filters
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  
  // Publish info
  const [totalResults, setTotalResults] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [termName, setTermName] = useState('');
  const [className, setClassName] = useState('');
  const [sectionName, setSectionName] = useState('');

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

  // Load publish info when all filters selected
  useEffect(() => {
    if (selectedTerm && selectedClass && selectedSection) {
      fetchPublishInfo();
    }
  }, [selectedTerm, selectedClass, selectedSection]);

  const fetchPublishInfo = async () => {
    setLoading(true);
    try {
      // Get term, class, section names
      const [termRes, classRes, sectionRes] = await Promise.all([
        supabase.from('exam_terms').select('name').eq('id', selectedTerm).single(),
        supabase.from('classes').select('name').eq('id', selectedClass).single(),
        supabase.from('sections').select('name').eq('id', selectedSection).single()
      ]);
      
      if (termRes.data) setTermName(termRes.data.name);
      if (classRes.data) setClassName(classRes.data.name);
      if (sectionRes.data) setSectionName(sectionRes.data.name);
      
      // Get students in this section
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', selectedClass)
        .eq('section_id', selectedSection)
        .eq('status', 'active');
      
      const studentIds = students?.map(s => s.id) || [];
      
      if (studentIds.length === 0) {
        setTotalResults(0);
        setIsPublished(false);
        return;
      }
      
      // Get compiled results
      const { data: results } = await supabase
        .from('compiled_results')
        .select('id, is_published')
        .eq('term_id', selectedTerm)
        .in('student_id', studentIds);
      
      setTotalResults(results?.length || 0);
      setIsPublished(results?.some(r => r.is_published) || false);
      
    } catch (error) {
      console.error('Error fetching publish info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedTerm) return;

    setPublishing(true);
    try {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || '00000000-0000-0000-0000-000000000000';
      
      const { data, error } = await supabase.rpc('publish_term_results', {
        p_term_id: selectedTerm,
        p_published_by: userId,
        p_notes: `Published by ${userData?.user?.email || 'Admin'}`
      });

      console.log('Publish response:', { data, error });

      if (error) {
        toast.error(`Publish failed: ${error.message}`);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (result?.success) {
        toast.success(result.message);
        await fetchPublishInfo();
      } else {
        toast.error(result?.message || 'Publish failed');
      }
    } catch (error) {
      console.error('Error publishing results:', error);
      toast.error('Failed to publish results');
    } finally {
      setPublishing(false);
    }
  };

  const handleRefresh = () => {
    if (selectedTerm && selectedClass && selectedSection) {
      fetchPublishInfo();
    }
  };

  const needsSelection = !selectedTerm || !selectedClass || !selectedSection;

  return (
    <ResponsiveLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-700 to-green-800 rounded-2xl p-6 text-white">
          <Link href="/exams/dashboard">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2 mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Publish Results</h1>
          <p className="text-emerald-100 mt-1">Publish generated results to make them available to students</p>
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
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        )}

        {/* No Selection State */}
        {!loading && needsSelection && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Please select Term, Class and Section to continue</p>
            </CardContent>
          </Card>
        )}

        {/* Publish Info */}
        {!loading && !needsSelection && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{termName} | {className} | {sectionName}</h3>
                </div>
                
                {totalResults === 0 ? (
                  <>
                    <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="h-8 w-8 text-yellow-600" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No Results Found</h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Please generate results first before publishing.
                    </p>
                    <Link href="/exams/results/generate">
                      <Button className="mt-4">Go to Generate Results</Button>
                    </Link>
                  </>
                ) : isPublished ? (
                  <>
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Already Published!</h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                      {totalResults} results have already been published for this section.
                    </p>
                    <div className="mt-4 flex gap-4 justify-center">
                      <Link href="/exams/reports/tabulation">
                        <Button variant="outline">View Tabulation Sheet</Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                      <Send className="h-8 w-8 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Ready to Publish</h2>
                    <p className="text-gray-500 max-w-md mx-auto mb-4">
                      {totalResults} result records are ready to be published.
                    </p>
                    <Button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Publish Results
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Publishing Status */}
        {publishing && (
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-4 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              <span className="text-emerald-900">Publishing results...</span>
            </CardContent>
          </Card>
        )}
      </div>
    </ResponsiveLayout>
  );
}
