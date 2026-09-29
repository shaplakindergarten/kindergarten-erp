'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface GenerationFiltersProps {
  onFiltersChange: (filters: {
    termId: string;
    classId: string;
    sectionId: string;
  }) => void;
  loading?: boolean;
}

export function GenerationFilters({ onFiltersChange, loading = false }: GenerationFiltersProps) {
  const [terms, setTerms] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  // Fetch terms
  useEffect(() => {
    const fetchTerms = async () => {
      const { data } = await supabase.from('exam_terms').select('id, name').order('created_at');
      if (data) setTerms(data);
    };
    fetchTerms();
  }, []);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from('classes').select('id, name').order('numeric_order');
      if (data) setClasses(data);
    };
    fetchClasses();
  }, []);

  // Fetch sections - FIXED: সরাসরি সব sections নিয়ে client-side এ filter
  useEffect(() => {
    const fetchAllSections = async () => {
      const { data } = await supabase.from('sections').select('id, name, class_id');
      if (data) {
        setSections(data);
      }
    };
    fetchAllSections();
  }, []);

  // Filter sections based on selected class
  const filteredSections = sections.filter(s => s.class_id === selectedClass);

  // Notify parent when all selected
  useEffect(() => {
    if (selectedTerm && selectedClass && selectedSection) {
      onFiltersChange({
        termId: selectedTerm,
        classId: selectedClass,
        sectionId: selectedSection
      });
    }
  }, [selectedTerm, selectedClass, selectedSection, onFiltersChange]);

  const handleRefresh = () => {
    if (selectedTerm && selectedClass && selectedSection) {
      onFiltersChange({
        termId: selectedTerm,
        classId: selectedClass,
        sectionId: selectedSection
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Term */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Exam Term</Label>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
                <SelectItem key={term.id} value={term.id}>
                  {term.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Class */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Class</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Section</Label>
          <Select 
            value={selectedSection} 
            onValueChange={setSelectedSection}
            disabled={!selectedClass || filteredSections.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={filteredSections.length === 0 ? "No sections" : "Select section"} />
            </SelectTrigger>
            <SelectContent>
              {filteredSections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Refresh */}
        <div className="flex items-end">
          <Button
            onClick={handleRefresh}
            disabled={loading || !selectedTerm || !selectedClass || !selectedSection}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}