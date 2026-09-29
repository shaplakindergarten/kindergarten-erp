"use client";

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Users, User, Layers, Grid3X3 } from 'lucide-react';

interface AssignmentScopeSelectorProps {
  academicYears: any[];
  classes: any[];
  sections: any[];
  onScopeChange: (scope: any) => void;
  isLoading?: boolean;
}

export function AssignmentScopeSelector({
  academicYears,
  classes,
  sections,
  onScopeChange,
  isLoading = false,
}: AssignmentScopeSelectorProps) {
  const [mode, setMode] = useState<'whole_class' | 'whole_section' | 'selected_students' | 'individual'>('whole_section');
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  useEffect(() => {
    if (academicYears.length > 0 && !academicYearId) {
      const currentYear = academicYears.find(y => y.is_current) || academicYears[0];
      setAcademicYearId(currentYear?.id || '');
    }
  }, [academicYears]);

  useEffect(() => {
    onScopeChange({
      mode,
      academic_year_id: academicYearId,
      class_id: classId || undefined,
      section_id: sectionId && sectionId !== 'all' ? sectionId : undefined,
    });
  }, [mode, academicYearId, classId, sectionId]);

  const availableSections = sections.filter(s => s.class_id === classId);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Academic Year */}
          <div className="space-y-2">
            <Label>Academic Year</Label>
            <Select value={academicYearId} onValueChange={setAcademicYearId}>
              <SelectTrigger>
                <SelectValue placeholder="Select academic year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.year_name} - {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <Label>Assignment Mode</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whole_class">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Whole Class
                  </div>
                </SelectItem>
                <SelectItem value="whole_section">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    Whole Section
                  </div>
                </SelectItem>
                <SelectItem value="selected_students">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Selected Students
                  </div>
                </SelectItem>
                <SelectItem value="individual">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Individual Student
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Class Selection */}
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
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

          {/* Section Selection */}
          <div className="space-y-2">
            <Label>Section</Label>
            <Select 
              value={sectionId} 
              onValueChange={setSectionId}
              disabled={!classId || mode === 'whole_class'}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  mode === 'whole_class' 
                    ? 'All Sections' 
                    : classId ? 'Select section' : 'Select class first'
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {availableSections.map((sec) => (
                  <SelectItem key={sec.id} value={sec.id}>
                    {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
          <div className="flex-1 text-sm">
            <span className="font-medium">Scope:</span>
            <span className="text-muted-foreground ml-2">
              {mode === 'whole_class' && 'All students in the selected class'}
              {mode === 'whole_section' && 'All students in the selected section'}
              {mode === 'selected_students' && 'Selected students from the list below'}
              {mode === 'individual' && 'Individual student selection'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}