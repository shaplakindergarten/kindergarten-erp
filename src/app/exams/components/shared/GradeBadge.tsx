// src/app/exams/components/shared/GradeBadge.tsx
'use client';

interface GradeBadgeProps {
  grade: string;
  gpa?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function GradeBadge({ grade, gpa, size = 'md' }: GradeBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };
  
  const getGradeColor = (grade: string) => {
    const gradeMap: Record<string, string> = {
      'A+': 'bg-green-100 text-green-700 border-green-200',
      'A': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'A-': 'bg-teal-100 text-teal-700 border-teal-200',
      'B': 'bg-blue-100 text-blue-700 border-blue-200',
      'C': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'D': 'bg-orange-100 text-orange-700 border-orange-200',
      'F': 'bg-red-100 text-red-700 border-red-200'
    };
    return gradeMap[grade] || 'bg-gray-100 text-gray-600 border-gray-200';
  };
  
  return (
    <div className={`inline-flex items-center gap-1 rounded-md border font-medium ${sizeClasses[size]} ${getGradeColor(grade)}`}>
      <span className="font-bold">{grade}</span>
      {gpa !== undefined && (
        <span className="text-xs opacity-75">(GPA: {gpa.toFixed(2)})</span>
      )}
    </div>
  );
}