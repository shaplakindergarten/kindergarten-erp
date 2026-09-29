"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AssignmentStatsProps {
  stats: {
    total_students: number;
    assigned_students: number;
    unassigned_students: number;
    assignment_percentage: number;
    total_structures_used: number;
    by_class: any[];
  };
  isLoading?: boolean;
}

export function AssignmentStats({ stats, isLoading = false }: AssignmentStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="bg-blue-500 p-3 rounded-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total_students}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Total Students</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="bg-emerald-500 p-3 rounded-lg">
            <CheckCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.assigned_students}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Assigned</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="bg-amber-500 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.unassigned_students}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Unassigned</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="bg-purple-500 p-3 rounded-lg">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.assignment_percentage}%
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Coverage</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}