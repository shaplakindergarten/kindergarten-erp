/**
 * Custom Hook: useFeeAssignments
 * Handles fee assignment state, queries, and mutations
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFeeAssignments,
  getFeeAssignmentStats,
  getUnassignedStudents,
  createFeeAssignment,
  updateFeeAssignment,
  deleteFeeAssignment,
  bulkAssignFeeStructure,
  getFeeAssignmentById,
  getAssignmentHistory,
} from '@/lib/api/fee-assignments.service';
import {
  FeeAssignmentFilters,
  FeeAssignmentWithDetails,
  FeeAssignmentStats,
  CreateFeeAssignmentData,
  UpdateFeeAssignmentData,
  BulkAssignData,
} from '@/types/fee-assignments';
import { toast } from 'sonner';

export function useFeeAssignments() {
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<FeeAssignmentFilters>({
    page: 1,
    limit: 20,
    status: 'all',
    assigned: 'all',
  });

  // ✅ Query: Get assignments with error handling
  const {
    data: assignmentsData,
    isLoading: isLoadingAssignments,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ['fee-assignments', filters],
    queryFn: () => getFeeAssignments(filters),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // ✅ Prevent errors from breaking the UI
    throwOnError: false,
  });

  // ✅ Query: Get stats with error handling
  const {
    data: stats,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['fee-assignment-stats'],
    queryFn: () => getFeeAssignmentStats(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    throwOnError: false,
  });

  // ✅ Query: Get unassigned students with error handling
  const {
    data: unassignedData,
    isLoading: isLoadingUnassigned,
    refetch: refetchUnassigned,
  } = useQuery({
    queryKey: ['unassigned-students', filters],
    queryFn: () =>
      getUnassignedStudents({
        class_id: filters.class_id,
        section_id: filters.section_id,
        search: filters.search,
        academic_year_id: filters.academic_year_id,
        page: 1,
        limit: 100,
      }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    throwOnError: false,
  });

  // ✅ Mutation: Create assignment
  const createMutation = useMutation({
    mutationFn: (data: CreateFeeAssignmentData) => createFeeAssignment(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Fee assignment created successfully');
        queryClient.invalidateQueries({ queryKey: ['fee-assignments'] });
        queryClient.invalidateQueries({ queryKey: ['fee-assignment-stats'] });
        queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
      } else {
        toast.error(result.error || 'Failed to create assignment');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create assignment');
    },
  });

  // ✅ Mutation: Update assignment
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFeeAssignmentData }) =>
      updateFeeAssignment(id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Fee assignment updated successfully');
        queryClient.invalidateQueries({ queryKey: ['fee-assignments'] });
        queryClient.invalidateQueries({ queryKey: ['fee-assignment-stats'] });
      } else {
        toast.error(result.error || 'Failed to update assignment');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update assignment');
    },
  });

  // ✅ Mutation: Delete assignment
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFeeAssignment(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Fee assignment deleted successfully');
        queryClient.invalidateQueries({ queryKey: ['fee-assignments'] });
        queryClient.invalidateQueries({ queryKey: ['fee-assignment-stats'] });
        queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
      } else {
        toast.error(result.error || 'Failed to delete assignment');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete assignment');
    },
  });

  // ✅ Mutation: Bulk assign
  const bulkAssignMutation = useMutation({
    mutationFn: (data: BulkAssignData) => bulkAssignFeeStructure(data),
    onSuccess: (result) => {
      if (result.success) {
        const successCount = result.results.filter(r => r.success).length;
        const failCount = result.results.filter(r => !r.success).length;
        toast.success(
          `Bulk assignment completed: ${successCount} assigned, ${failCount} failed`
        );
        queryClient.invalidateQueries({ queryKey: ['fee-assignments'] });
        queryClient.invalidateQueries({ queryKey: ['fee-assignment-stats'] });
        queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
      } else {
        toast.error('Bulk assignment failed');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Bulk assignment failed');
    },
  });

  const getAssignment = useCallback(
    async (id: string) => {
      try {
        return await getFeeAssignmentById(id);
      } catch (error) {
        console.error('Error fetching assignment:', error);
        toast.error('Failed to fetch assignment details');
        return null;
      }
    },
    []
  );

  const getHistory = useCallback(
    async (studentId: string) => {
      try {
        return await getAssignmentHistory(studentId);
      } catch (error) {
        console.error('Error fetching history:', error);
        toast.error('Failed to fetch assignment history');
        return [];
      }
    },
    []
  );

  const refreshAll = useCallback(() => {
    refetchAssignments();
    refetchStats();
    refetchUnassigned();
  }, [refetchAssignments, refetchStats, refetchUnassigned]);

  return {
    // ✅ Data with safe fallbacks
    assignments: assignmentsData?.data || [],
    totalAssignments: assignmentsData?.total || 0,
    totalPages: assignmentsData?.totalPages || 0,
    
    stats: stats || {
      total_students: 0,
      assigned_students: 0,
      unassigned_students: 0,
      assignment_percentage: 0,
      total_structures_used: 0,
      by_class: [],
    },
    
    unassignedStudents: unassignedData?.data || [],
    totalUnassigned: unassignedData?.total || 0,

    // ✅ Loading states
    isLoading: isLoadingAssignments || isLoadingStats || isLoadingUnassigned,
    isLoadingAssignments,
    isLoadingStats,
    isLoadingUnassigned,

    // ✅ Error state (safe to use)
    error: assignmentsError,

    // ✅ Filters
    filters,
    setFilters,

    // ✅ Mutations
    createAssignment: createMutation.mutateAsync,
    updateAssignment: updateMutation.mutateAsync,
    deleteAssignment: deleteMutation.mutateAsync,
    bulkAssign: bulkAssignMutation.mutateAsync,

    // ✅ Helper functions
    getAssignment,
    getHistory,
    refreshAll,
    refetchAssignments,
    refetchStats,
    refetchUnassigned,

    // ✅ Loading states for mutations
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkAssigning: bulkAssignMutation.isPending,
  };
}