'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface SubjectLockStatus {
  exam_subject_id: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
  total_students: number;
  locked_count: number;
  is_fully_locked: boolean;
}

interface SubjectSelectionProps {
  subjects: SubjectLockStatus[];
  selectedSubjectIds: string[];
  onSubjectToggle: (subjectId: string) => void;
  onSelectAll: () => void;
  onGenerateSelected: () => void;
  onGenerateAll: () => void;
  generating: boolean;
  summary?: {
    term_name: string;
    class_name: string;
    section_name: string;
    total_students: number;
  };
}

export function SubjectSelection({
  subjects,
  selectedSubjectIds,
  onSubjectToggle,
  onSelectAll,
  onGenerateSelected,
  onGenerateAll,
  generating,
  summary
}: SubjectSelectionProps) {
  const lockableSubjects = subjects.filter(s => s.is_fully_locked);
  const lockableCount = lockableSubjects.length;
  const allSelected = lockableCount > 0 && selectedSubjectIds.length === lockableCount;

  if (subjects.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      {summary && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-2xl p-5 border border-purple-100 dark:border-purple-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {summary.term_name} | {summary.class_name} | {summary.section_name}
              </h3>
              <div className="flex gap-4 mt-1 text-sm text-gray-500">
                <span>Students: <strong>{summary.total_students}</strong></span>
                <span>Subjects: <strong>{subjects.length}</strong></span>
                <span>Locked: <strong className="text-green-600">{lockableCount}</strong></span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onGenerateAll}
                disabled={lockableCount === 0 || generating}
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate All ({lockableCount})
              </Button>
              <Button
                onClick={onGenerateSelected}
                disabled={lockableCount === 0 || generating || selectedSubjectIds.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                Generate Selected ({selectedSubjectIds.length})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Select All Row */}
      {lockableCount > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onSelectAll}
            />
            <span className="font-medium">Select All Locked Subjects</span>
          </label>
          <Badge variant="outline">
            {selectedSubjectIds.length} / {lockableCount} selected
          </Badge>
        </div>
      )}

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 gap-3">
        {subjects.map((subject) => {
          const isSelectable = subject.is_fully_locked;
          const isSelected = selectedSubjectIds.includes(subject.exam_subject_id);
          const lockPercentage = subject.total_students > 0
            ? Math.round((subject.locked_count / subject.total_students) * 100)
            : 0;

          return (
            <div
              key={subject.exam_subject_id}
              className={`bg-white dark:bg-gray-900 rounded-xl border p-4 transition-all ${
                isSelectable ? 'border-gray-200 dark:border-gray-700 hover:shadow-md' : 'border-gray-100 dark:border-gray-800 opacity-75'
              }`}
            >
              <div className="flex items-center gap-4">
                <Checkbox
                  id={`sub-${subject.exam_subject_id}`}
                  checked={isSelectable && isSelected}
                  onCheckedChange={() => isSelectable && onSubjectToggle(subject.exam_subject_id)}
                  disabled={!isSelectable}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label
                      htmlFor={`sub-${subject.exam_subject_id}`}
                      className="font-medium text-gray-900 dark:text-white cursor-pointer"
                    >
                      {subject.subject_name}
                    </label>
                    <span className="text-xs text-gray-500">Full: {subject.full_marks}</span>
                    <span className="text-xs text-gray-400">Pass: {subject.pass_marks}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={lockPercentage} className="h-1.5 flex-1" />
                    <span className="text-xs text-gray-500 w-12">{lockPercentage}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {subject.locked_count}/{subject.total_students}
                  </div>
                  <div className="text-xs text-gray-500">locked</div>
                </div>
                <div>
                  {subject.is_fully_locked ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Pending
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}