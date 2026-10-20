'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

async function fetchFeeStructures(academicYearId?: string) {
  let query = supabase
    .from('fee_structures')
    .select(`
      *,
      academic_year:academic_year_id (id, year_name, name),
      class:class_id (id, name),
      items:fee_structure_items (
        id,
        fee_structure_id,
        category_id,
        amount,
        frequency,
        name,
        is_optional
      )
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (academicYearId) {
    query = query.eq('academic_year_id', academicYearId)
  }

  const { data, error } = await query

  if (error) throw error;
  return data || [];
}

export function useFeeStructures(academicYearId?: string) {
  return useQuery({
    queryKey: ['fee-structures', academicYearId],
    queryFn: () => fetchFeeStructures(academicYearId),
    staleTime: 5 * 60 * 1000,
  });
}