"use client";

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFeeAssignments } from '@/hooks/useFeeAssignments';
import { useFeeStructures } from '@/hooks/useFeeStructures';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useClasses } from '@/hooks/useClasses';
import { useSections } from '@/hooks/useSections';
import { AssignmentScopeSelector } from './components/AssignmentScopeSelector';
import { AssignmentStats } from './components/AssignmentStats';
import { BulkAssignDialog } from './components/BulkAssignDialog';

export default function FeeAssignmentsPage() {
  const {
    stats,
    unassignedStudents,
    setFilters,
    isLoading,
    isLoadingStats,
    isLoadingUnassigned,
    refreshAll,
  } = useFeeAssignments();

  const { data: structures = [] } = useFeeStructures();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: classes = [] } = useClasses();
  const { data: sections = [] } = useSections();

  const [scope, setScope] = useState<any>({
    mode: 'whole_section',
    academic_year_id: '',
    class_id: '',
    section_id: '',
  });
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      academic_year_id: scope.academic_year_id || undefined,
      class_id: scope.class_id || undefined,
      section_id:
        scope.mode === 'whole_section' || scope.mode === 'selected_students' || scope.mode === 'individual'
          ? scope.section_id || undefined
          : undefined,
      search: undefined,
      page: 1,
    }));
  }, [scope, setFilters]);

  const scopeDescription = useMemo(() => {
    const selectedClass = classes.find((cls) => cls.id === scope.class_id)?.name || 'Class not selected';
    const selectedSection = sections.find((sec) => sec.id === scope.section_id)?.name || 'Section not selected';

    switch (scope.mode) {
      case 'whole_class':
        return scope.class_id ? `Assign to all students in ${selectedClass}` : 'Select a class to assign the whole class';
      case 'whole_section':
        return scope.class_id && scope.section_id
          ? `Assign to all students in ${selectedSection} of ${selectedClass}`
          : 'Select a class and section to assign the whole section';
      case 'selected_students':
        return 'Pick students from the list below and assign a fee structure';
      case 'individual':
        return 'Search and select one student for individual assignment';
      default:
        return 'Choose a scope to begin assignment';
    }
  }, [scope, classes, sections]);

  const canOpenAssignDialog = !!scope.academic_year_id && (scope.mode !== 'whole_class' || !!scope.class_id) && (scope.mode !== 'whole_section' || !!scope.class_id) && (scope.mode !== 'whole_section' || !!scope.section_id);

  return (
    <ResponsiveLayout>
      <div className="space-y-4 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-linear-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-lg shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-white">Fee Structure Assignments</h1>
            <p className="text-sm text-white/80">Assign fee structures to students across classes, sections, or individually.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              onClick={refreshAll}
              disabled={isLoading}
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setAssignDialogOpen(true)}
              disabled={!canOpenAssignDialog}
              className="bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg"
            >
              <Users className="h-4 w-4 mr-2" />
              Assign Fee Structure
            </Button>
          </div>
        </div>

        <AssignmentStats stats={stats} isLoading={isLoadingStats} />

        <AssignmentScopeSelector
          academicYears={academicYears}
          classes={classes}
          sections={sections}
          onScopeChange={setScope}
          isLoading={false}
        />

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="text-sm text-muted-foreground">{scopeDescription}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-muted/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Academic Year</p>
                <p className="mt-2 font-medium">{academicYears.find((year) => year.id === scope.academic_year_id)?.year_name || 'Not selected'}</p>
              </div>
              <div className="rounded-xl border border-muted/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Scope Mode</p>
                <p className="mt-2 font-medium capitalize">{scope.mode.replace('_', ' ')}</p>
              </div>
              <div className="rounded-xl border border-muted/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Unassigned Students</p>
                <p className="mt-2 font-medium">{isLoadingUnassigned ? 'Loading…' : unassignedStudents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <BulkAssignDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onSuccess={() => {
            setAssignDialogOpen(false);
            refreshAll();
          }}
          structures={structures}
          academicYears={academicYears}
          scope={scope}
          classes={classes}
          sections={sections}
          students={unassignedStudents}
          isLoadingStudents={isLoadingUnassigned}
        />
      </div>
    </ResponsiveLayout>
  );
}


