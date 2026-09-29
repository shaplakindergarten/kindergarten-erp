'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

async function fetchAcademicYears() {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('is_active', true)
    .order('year_name', { ascending: false });

  if (error) throw error;
  return data || [];
}

export function useAcademicYears() {
  return useQuery({
    queryKey: ['academic-years'],
    queryFn: fetchAcademicYears,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}