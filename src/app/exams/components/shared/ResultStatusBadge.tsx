// src/app/exams/components/shared/ResultStatusBadge.tsx
'use client';

import { ResultStatus, PassFailStatus } from '@/types/exam';

interface ResultStatusBadgeProps {
  resultStatus?: ResultStatus;
  passFailStatus?: PassFailStatus;
  isPublished?: boolean;
}

export function ResultStatusBadge({ resultStatus, passFailStatus, isPublished }: ResultStatusBadgeProps) {
  // For result workflow status
  if (resultStatus) {
    const config = {
      pending: { label: 'পেন্ডিং', className: 'bg-gray-100 text-gray-600' },
      generated: { label: 'জেনারেটেড', className: 'bg-blue-100 text-blue-600' },
      published: { label: 'প্রকাশিত', className: 'bg-green-100 text-green-600' },
      archived: { label: 'আর্কাইভড', className: 'bg-gray-100 text-gray-500' }
    };
    
    const { label, className } = config[resultStatus] || config.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  }
  
  // For pass/fail status
  if (passFailStatus) {
    const config = {
      passed: { label: 'পাস', className: 'bg-green-100 text-green-700' },
      failed: { label: 'ফেল', className: 'bg-red-100 text-red-700' },
      passed_with_elective_fail: { label: 'পাস (ইলেকটিভ ফেল)', className: 'bg-yellow-100 text-yellow-700' }
    };
    
    const { label, className } = config[passFailStatus] || config.passed;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  }
  
  // For publish status
  if (isPublished !== undefined) {
    return isPublished ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        প্রকাশিত
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        প্রকাশিত হয়নি
      </span>
    );
  }
  
  return null;
}