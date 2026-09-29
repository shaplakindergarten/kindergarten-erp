// src/app/exams/components/shared/SubjectSelector.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Subject {
  id: string;
  name: string;
  code: string;
  subject_type?: string;
}

interface ExamSubject {
  id: string;
  subject_id: string;
  subject?: Subject;
  full_marks: number;
  pass_marks: number;
}

interface SubjectSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  termId: string;
  classId: string;
  sectionId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SubjectSelector({
  value,
  onChange,
  termId,
  classId,
  sectionId,
  placeholder = 'সাবজেক্ট নির্বাচন করুন',
  disabled = false,
}: SubjectSelectorProps) {
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (termId && classId) {
      fetchSubjects();
    }
  }, [termId, classId, sectionId]);

  const fetchSubjects = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      term_id: termId,
      class_id: classId,
    });
    if (sectionId) params.append('section_id', sectionId);

    const response = await fetch(`/api/exams/subjects?${params.toString()}`);
    const result = await response.json();

    if (result.success) {
      setSubjects(result.data);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="h-10 w-full bg-gray-100 animate-pulse rounded-xl" />;
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full rounded-xl border-gray-300 bg-white text-gray-900">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-white border border-gray-300 rounded-xl shadow-lg">
        {subjects.map((subject) => (
          <SelectItem 
            key={subject.id} 
            value={subject.id}
            className="text-gray-900 hover:bg-gray-100 cursor-pointer"
          >
            {subject.subject?.name} ({subject.full_marks} marks)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}