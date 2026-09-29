// src/lib/api/discount-utils.ts
// Discount Application Logic - Support for All Scopes

import { createClient } from '@/lib/supabase/server'

export interface DiscountWithScope {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  applicable_categories: string[]
  applicable_on: string
  is_active: boolean
  created_at?: string
  scope_type: 'all' | 'class' | 'section' | 'student' | 'sibling'
  scope_class_id?: string | null
  scope_section_id?: string | null
  scope_student_ids?: string[] | null
  sibling_group_id?: string | null
  valid_from?: string | null
  valid_to?: string | null
}

export interface StudentInfo {
  id: string
  name: string
  student_id: string
  class_id: string
  section_id: string
  academic_year_id?: string
}

/**
 * Check if a discount is applicable to a specific student
 */
export async function isDiscountApplicable(
  discount: DiscountWithScope,
  student: StudentInfo
): Promise<boolean> {
  // 1. Check if discount is active
  if (!discount.is_active) {
    return false
  }

  // 2. Check validity period
  if (discount.valid_from) {
    const validFrom = new Date(discount.valid_from)
    const today = new Date()
    validFrom.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    if (validFrom > today) {
      return false
    }
  }

  if (discount.valid_to) {
    const validTo = new Date(discount.valid_to)
    const today = new Date()
    validTo.setHours(23, 59, 59, 999)
    if (validTo < today) {
      return false
    }
  }

  // 3. Check scope type
  switch (discount.scope_type) {
    case 'all':
      return true

    case 'class':
      return discount.scope_class_id === student.class_id

    case 'section':
      return discount.scope_section_id === student.section_id

    case 'student':
      return discount.scope_student_ids?.includes(student.id) || false

    case 'sibling':
      return await isStudentInSiblingGroup(discount.sibling_group_id, student.id)

    default:
      return false
  }
}

/**
 * Check if a student belongs to a sibling group
 */
export async function isStudentInSiblingGroup(
  siblingGroupId: string | null | undefined,
  studentId: string
): Promise<boolean> {
  if (!siblingGroupId || !studentId) {
    return false
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('student_siblings')
      .select('student_id')
      .eq('sibling_group_id', siblingGroupId)
      .eq('student_id', studentId)
      .maybeSingle()

    return !!data
  } catch (error) {
    console.error('Error checking sibling group:', error)
    return false
  }
}

/**
 * Get all students in a sibling group
 */
export async function getStudentsInSiblingGroup(
  siblingGroupId: string
): Promise<string[]> {
  if (!siblingGroupId) {
    return []
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('student_siblings')
      .select('student_id')
      .eq('sibling_group_id', siblingGroupId)

    if (error) {
      console.error('Error fetching sibling group students:', error)
      return []
    }

    return data?.map(item => item.student_id) || []
  } catch (error) {
    console.error('Error fetching sibling group students:', error)
    return []
  }
}

/**
 * Get all applicable discounts for a student
 */
export async function getApplicableDiscounts(
  student: StudentInfo
): Promise<DiscountWithScope[]> {
  try {
    const supabase = await createClient()
    // Get all active discounts
    const { data: discounts, error } = await supabase
      .from('fee_discounts')
      .select('*')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching discounts:', error)
      return []
    }

    if (!discounts || discounts.length === 0) {
      return []
    }

    // Filter applicable discounts
    const applicableDiscounts: DiscountWithScope[] = []
    
    for (const discount of discounts) {
      const isApplicable = await isDiscountApplicable(
        {
          ...discount,
          applicable_categories: Array.isArray(discount.applicable_categories)
            ? discount.applicable_categories
            : discount.applicable_categories
              ? JSON.parse(discount.applicable_categories)
              : [],
          scope_student_ids: discount.scope_student_ids || [],
        },
        student
      )

      if (isApplicable) {
        applicableDiscounts.push({
          ...discount,
          applicable_categories: Array.isArray(discount.applicable_categories)
            ? discount.applicable_categories
            : discount.applicable_categories
              ? JSON.parse(discount.applicable_categories)
              : [],
          scope_student_ids: discount.scope_student_ids || [],
        })
      }
    }

    return applicableDiscounts
  } catch (error) {
    console.error('Error getting applicable discounts:', error)
    return []
  }
}

/**
 * Calculate discount amount for a student
 */
export async function calculateDiscountAmount(
  student: StudentInfo,
  categoryId: string,
  amount: number
): Promise<{ discountAmount: number; appliedDiscounts: DiscountWithScope[] }> {
  const applicableDiscounts = await getApplicableDiscounts(student)
  
  let totalDiscount = 0
  const appliedDiscounts: DiscountWithScope[] = []

  for (const discount of applicableDiscounts) {
    // Check if this discount applies to this category
    if (
      discount.applicable_categories.length > 0 &&
      !discount.applicable_categories.includes(categoryId)
    ) {
      continue
    }

    // Calculate discount
    let discountAmount = 0
    if (discount.type === 'percentage') {
      discountAmount = (amount * discount.value) / 100
    } else if (discount.type === 'fixed') {
      discountAmount = Math.min(discount.value, amount - totalDiscount)
    }

    if (discountAmount > 0) {
      totalDiscount += discountAmount
      appliedDiscounts.push(discount)
    }
  }

  // Cap discount at amount
  totalDiscount = Math.min(totalDiscount, amount)

  return {
    discountAmount: totalDiscount,
    appliedDiscounts,
  }
}

/**
 * Create a sibling group
 */
export async function createSiblingGroup(
  groupName: string,
  studentIds: string[]
): Promise<{ success: boolean; groupId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    // 1. Create sibling group
    const { data: group, error: groupError } = await supabase
      .from('sibling_groups')
      .insert({ group_name: groupName })
      .select()
      .single()

    if (groupError) {
      return { success: false, error: groupError.message }
    }

    // 2. Add students to sibling group
    const siblingData = studentIds.map(studentId => ({
      student_id: studentId,
      sibling_group_id: group.id,
    }))

    const { error: siblingError } = await supabase
      .from('student_siblings')
      .insert(siblingData)

    if (siblingError) {
      // Rollback: delete the group
      await supabase
        .from('sibling_groups')
        .delete()
        .eq('id', group.id)

      return { success: false, error: siblingError.message }
    }

    return { success: true, groupId: group.id }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get all sibling groups
 */
export async function getSiblingGroups() {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('sibling_groups')
      .select(`
        *,
        student_siblings (
          student_id,
          students:student_id (id, name, student_id)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sibling groups:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching sibling groups:', error)
    return []
  }
}

/**
 * Get sibling group by student ID
 */
export async function getSiblingGroupByStudent(studentId: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('student_siblings')
      .select('sibling_group_id, sibling_groups:group_id(*)')
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching sibling group:', error)
      return null
    }

    return data?.sibling_groups || null
  } catch (error) {
    console.error('Error fetching sibling group:', error)
    return null
  }
}

/**
 * Remove student from sibling group
 */
export async function removeStudentFromSiblingGroup(
  studentId: string,
  siblingGroupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('student_siblings')
      .delete()
      .eq('student_id', studentId)
      .eq('sibling_group_id', siblingGroupId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Check if group is empty
    const { data: remaining, error: checkError } = await supabase
      .from('student_siblings')
      .select('student_id')
      .eq('sibling_group_id', siblingGroupId)

    if (checkError) {
      return { success: false, error: checkError.message }
    }

    // If group is empty, delete it
    if (!remaining || remaining.length === 0) {
      await supabase
        .from('sibling_groups')
        .delete()
        .eq('id', siblingGroupId)
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get students with their sibling info
 */
export async function getStudentsWithSiblingInfo() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        name,
        student_id,
        class_id,
        section_id,
        student_siblings (
          sibling_group_id,
          sibling_groups:group_id (group_name)
        )
      `)
      .eq('status', 'active')

    if (error) {
      console.error('Error fetching students with sibling info:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching students with sibling info:', error)
    return []
  }
}
