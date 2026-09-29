// src/app/exams/components/shared/ExamTermSelector.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExamTerm {
  id: string;
  name: string;
  term_code: string;
  status: string;
  weightage_percentage: number;
}

interface ExamTermSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ExamTermSelector({ 
  value, 
  onChange, 
  placeholder = 'পরীক্ষা নির্বাচন করুন',
  disabled = false 
}: ExamTermSelectorProps) {
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    setLoading(true);
    const response = await fetch('/api/exams/terms');
    const result = await response.json();
    if (result.success) {
      setTerms(result.data);
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
        {terms.map((term) => (
          <SelectItem 
            key={term.id} 
            value={term.id}
            className="text-gray-900 hover:bg-gray-100 cursor-pointer"
          >
            {term.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}