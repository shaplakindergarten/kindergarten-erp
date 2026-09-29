"use client"

import { useState, useEffect, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"

export interface CustomSchedule {
  type: string
  months: number[]
  amount_per_month?: number
  total_amount?: number
  show?: boolean
}

export interface FeeCategory {
  id: string
  name: string
  description: string | null
  amount: number
  frequency: string
  custom_schedule?: CustomSchedule | null
  is_active: boolean
  created_at: string
  created_date: string
}

export function useFeeCategories() {
  const [categories, setCategories] = useState<FeeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const supabase = getSupabaseClient()
      const { data, error: supabaseError } = await supabase
        .from("fee_categories")
        .select("*")
        .order("created_at", { ascending: false })

      if (supabaseError) throw new Error(supabaseError.message)
      
      setCategories(data || [])
    } catch (err: any) {
      console.error("Fetch error:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const createCategory = useCallback(async (input: { 
    name: string
    amount: number
    frequency?: string
    custom_schedule?: CustomSchedule | null
    description?: string 
  }) => {
    try {
      const supabase = getSupabaseClient()
      
      let finalAmount = input.amount
      if (input.frequency === "custom" && input.custom_schedule) {
        finalAmount = input.custom_schedule.total_amount || 0
      }
      
      const { data, error } = await supabase
        .from("fee_categories")
        .insert({
          name: input.name,
          description: input.description || null,
          amount: finalAmount,
          frequency: input.frequency || "monthly",
          custom_schedule: input.frequency === "custom" ? input.custom_schedule : null,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      
      await fetchCategories()
      return { success: true, data }
    } catch (err: any) {
      console.error("Create error:", err)
      return { success: false, error: err.message }
    }
  }, [fetchCategories])

  const updateCategory = useCallback(async (id: string, updates: Partial<FeeCategory>) => {
    try {
      const supabase = getSupabaseClient()
      
      const updateData: any = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.amount !== undefined) updateData.amount = updates.amount
      if (updates.frequency !== undefined) updateData.frequency = updates.frequency
      if (updates.custom_schedule !== undefined) updateData.custom_schedule = updates.custom_schedule
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active
      
      const { error } = await supabase
        .from("fee_categories")
        .update(updateData)
        .eq("id", id)

      if (error) throw new Error(error.message)
      
      await fetchCategories()
      return { success: true }
    } catch (err: any) {
      console.error("Update error:", err)
      return { success: false, error: err.message }
    }
  }, [fetchCategories])

  const toggleActive = useCallback(async (id: string, currentStatus: boolean) => {
    return updateCategory(id, { is_active: !currentStatus })
  }, [updateCategory])

  const deleteCategory = useCallback(async (id: string) => {
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from("fee_categories")
        .delete()
        .eq("id", id)

      if (error) throw new Error(error.message)
      
      await fetchCategories()
      return { success: true }
    } catch (err: any) {
      console.error("Delete error:", err)
      return { success: false, error: err.message }
    }
  }, [fetchCategories])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  return {
    categories,
    loading,
    error,
    refresh: fetchCategories,
    createCategory,
    updateCategory,
    toggleActive,
    deleteCategory,
  }
}