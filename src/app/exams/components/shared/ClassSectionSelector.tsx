// src/app/exams/components/shared/ClassSectionSelector.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClassItem {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
}

interface ClassSectionSelectorProps {
  classId?: string;
  sectionId?: string;
  onClassChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  showSection?: boolean;
  classPlaceholder?: string;
  sectionPlaceholder?: string;
  disabled?: boolean;
}

export function ClassSectionSelector({
  classId,
  sectionId,
  onClassChange,
  onSectionChange,
  showSection = true,
  classPlaceholder = 'ক্লাস নির্বাচন করুন',
  sectionPlaceholder = 'সেকশন নির্বাচন করুন',
  disabled = false,
}: ClassSectionSelectorProps) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (classId && showSection) {
      fetchSections(classId);
    } else {
      setSections([]);
    }
  }, [classId, showSection]);

  const fetchClasses = async () => {
    const response = await fetch('/api/classes?order_by=numeric_order');
    const result = await response.json();
    if (result.success) {
      setClasses(result.data);
    }
    setLoadingClasses(false);
  };

  const fetchSections = async (classId: string) => {
    setLoadingSections(true);
    const response = await fetch(`/api/sections?class_id=${classId}`);
    const result = await response.json();
    if (result.success) {
      setSections(result.data);
    }
    setLoadingSections(false);
  };

  if (loadingClasses) {
    return <div className="h-10 w-full bg-gray-100 animate-pulse rounded-xl" />;
  }

  return (
    <div className="flex gap-2">
      <Select value={classId} onValueChange={onClassChange} disabled={disabled}>
        <SelectTrigger className="flex-1 rounded-xl border-gray-300 bg-white text-gray-900">
          <SelectValue placeholder={classPlaceholder} />
        </SelectTrigger>
        <SelectContent className="bg-white border border-gray-300 rounded-xl shadow-lg">
          {classes.map((cls) => (
            <SelectItem 
              key={cls.id} 
              value={cls.id}
              className="text-gray-900 hover:bg-gray-100 cursor-pointer"
            >
              {cls.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showSection && (
        <Select 
          value={sectionId} 
          onValueChange={onSectionChange} 
          disabled={disabled || !classId}
        >
          <SelectTrigger className="flex-1 rounded-xl border-gray-300 bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed">
            <SelectValue placeholder={sectionPlaceholder} />
          </SelectTrigger>
          <SelectContent className="bg-white border border-gray-300 rounded-xl shadow-lg">
            {loadingSections ? (
              <div className="p-2 text-center text-sm text-gray-500">লোড হচ্ছে...</div>
            ) : sections.length === 0 ? (
              <div className="p-2 text-center text-sm text-gray-500">কোন সেকশন নেই</div>
            ) : (
              sections.map((section) => (
                <SelectItem 
                  key={section.id} 
                  value={section.id}
                  className="text-gray-900 hover:bg-gray-100 cursor-pointer"
                >
                  {section.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}