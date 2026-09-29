'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

async function fetchClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('numeric_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
    staleTime: 10 * 60 * 1000,
  });
}