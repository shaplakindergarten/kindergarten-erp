// src/hooks/useSchoolSettings.ts (আপডেটেড)
"use client"

import { useQuery } from '@tanstack/react-query'
import { getSchoolSettings } from '@/lib/api/settings'  // ← ✅ সঠিক
import type { SchoolSettings } from '@/types'

export function useSchoolSettings() {
  return useQuery({
    queryKey: ['school-settings'],
    queryFn: getSchoolSettings,  // ← ✅ ফাংশন নাম পরিবর্তন
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}

export type { SchoolSettings }