'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

async function fetchSections() {
  const { data, error } = await supabase
    .from('sections')
    .select('*, class:class_id (id, name)')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function useSections() {
  return useQuery({
    queryKey: ['sections'],
    queryFn: fetchSections,
    staleTime: 10 * 60 * 1000,
  });
}