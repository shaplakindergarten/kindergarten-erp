import { useQuery } from '@tanstack/react-query';
import { getUnassignedStudents } from '@/lib/api/fee-assignments.service';

export function useUnassignedStudents(filters?: any) {
  return useQuery({
    queryKey: ['unassigned-students', filters],
    queryFn: () => getUnassignedStudents(filters),
    staleTime: 5 * 60 * 1000,
  });
}